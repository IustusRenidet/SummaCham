(() => {
  const API_BASE = (() => {
    if (window.location.protocol === 'file:') return 'http://localhost:3005/api';
    return `${window.location.origin.replace(/\/$/, '')}/api`;
  })();
  const YEAR_SELECT = document.getElementById('resumenYearSelect');
  const MONTH_SELECT = document.getElementById('resumenMonthSelect');
  const TABLE_BODY = document.getElementById('tablaCuentasBody');
  const ESTADO_BIEN = 'Construyendo el resumen financiero, espera un momento...';
  const YEAR_ACTUAL_SPANS = document.querySelectorAll('.year-act');
  const YEAR_PREV_SPANS = document.querySelectorAll('.year-prev');
  const formatCurrency = new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
  const formatPercent = (valor) => {
    if (typeof valor !== 'number' || Number.isNaN(valor)) return '0%';
    return `${valor.toFixed(2)}%`;
  };

  const sanitizeCodigo = (cuenta) => {
    const soloNumeros = (cuenta || '').toString().replace(/\D/g, '');
    if (!soloNumeros) return '';
    return soloNumeros.padEnd(21, '0').slice(0, 21);
  };

  const determinTipoSeccion = (texto) => {
    const normalizado = (texto || '').toUpperCase();
    if (normalizado.includes('(INCOME)')) return 'ingreso';
    if (normalizado.includes('(EXPENSE)')) return 'gasto';
    if (normalizado.includes('OPERATING') || normalizado.includes('RESULTS')) return 'operativo';
    if (normalizado.includes('OTHER') || normalizado.includes('MORE')) return 'otros';
    return 'otros';
  };

  const construirEstructura = () => {
    const cuentas = window.CUENTAS_POR_MODULO?.resumen || [];
    const mapaCapitulos = new Map();
    cuentas.forEach((registro) => {
      const capitulo = registro.capitulo || 'General';
      const seccion = registro.seccion || 'Otros';
      const clave = `${capitulo}||${seccion}`;
      if (!mapaCapitulos.has(clave)) {
        mapaCapitulos.set(clave, {
          capitulo,
          seccion,
          tipo: determinTipoSeccion(seccion),
          cuentas: []
        });
      }
      mapaCapitulos.get(clave).cuentas.push({
        cuenta: registro.cuenta,
        nombre: registro.nombre
      });
    });
    const resultado = [];
    const agrupado = new Map();
    mapaCapitulos.forEach((valor) => {
      const capit = valor.capitulo;
      if (!agrupado.has(capit)) {
        agrupado.set(capit, []);
      }
      agrupado.get(capit).push(valor);
    });
    agrupado.forEach((secciones, capitulo) => {
      resultado.push({ capitulo, secciones });
    });
    return resultado;
  };

  const construirCodigos = () => {
    const secciones = construirEstructura();
    const codigos = new Set();
    secciones.forEach(({ secciones: lista }) => {
      lista.forEach(({ cuentas }) => {
        cuentas.forEach((item) => {
          const codigo = sanitizeCodigo(item.cuenta);
          if (codigo) {
            codigos.add(codigo);
          }
        });
      });
    });
    return Array.from(codigos);
  };

  const obtenerEmpresaActiva = () => {
    const sesion = Sesion.obtener();
    return Sesion.obtenerEmpresaActiva(sesion);
  };

  const vaciarTabla = (mensaje) => {
    if (!TABLE_BODY) return;
    TABLE_BODY.innerHTML = '';
    const fila = document.createElement('tr');
    fila.className = 'estado-tabla';
    const celda = document.createElement('td');
    celda.colSpan = 7;
    celda.textContent = mensaje || 'No se encontró información para este ejercicio.';
    fila.appendChild(celda);
    TABLE_BODY.appendChild(fila);
  };

  const calcularTotales = (descripcion, items, mapaDetalle) => {
    const resumen = {
      real: 0,
      plan: 0,
      anterior: 0
    };
    items.forEach(({ cuenta }) => {
      const clave = sanitizeCodigo(cuenta);
      const fila = mapaDetalle.get(clave);
      if (fila) {
        resumen.real += Number(fila.acumuladoActual || 0);
        resumen.plan += Number(fila.acumuladoPlan || 0);
        resumen.anterior += Number(fila.acumuladoAnterior || 0);
      }
    });
    return resumen;
  };

  const actualizarEncabezadosYears = (anio) => {
    const actual = Number.isInteger(anio) ? String(anio) : '-';
    const previo = Number.isInteger(anio) ? String(anio - 1) : '-';
    YEAR_ACTUAL_SPANS.forEach((span) => {
      span.textContent = actual;
    });
    YEAR_PREV_SPANS.forEach((span) => {
      span.textContent = previo;
    });
  };

  const variation = (actual, base) => {
    if (!Number.isFinite(base) || base === 0) return 0;
    return ((Number(actual || 0) - Number(base || 0)) / Math.abs(base)) * 100;
  };

  const renderizarResumen = (resumenData) => {
    if (!TABLE_BODY) return;
    TABLE_BODY.innerHTML = '';
    
    if (!resumenData || !resumenData.length) {
      vaciarTabla('No hay datos disponibles.');
      return;
    }

    resumenData.forEach((capitulo) => {
      // 1. Encabezado de Capítulo
      const header = document.createElement('tr');
      header.className = 'section-header-row table-primary fw-bold';
      header.innerHTML = `<td colspan="7" class="text-center text-uppercase">${capitulo.label}</td>`;
      TABLE_BODY.appendChild(header);

      (capitulo.children || []).forEach((seccion) => {
        // 2. Encabezado de Sección
        const subHeader = document.createElement('tr');
        subHeader.className = 'subsection-header-row table-light fw-bold fst-italic';
        subHeader.innerHTML = `<td colspan="7" class="ps-4">${seccion.label}</td>`;
        TABLE_BODY.appendChild(subHeader);

        // 3. Filas de Cuentas (LO QUE PEDÍA EL USUARIO)
        (seccion.cuentas || []).forEach((cta) => {
          const fila = document.createElement('tr');
          const varPlan = variation(cta.actualMonth, cta.planMonth);
          const varPrev = variation(cta.actualMonth, cta.prevMonth);
          
          fila.innerHTML = `
            <td class="font-monospace small">${cta.cuenta}</td>
            <td>${cta.descripcion}</td>
            <td class="text-end">${formatCurrency.format(cta.actualMonth)}</td>
            <td class="text-end">${formatCurrency.format(cta.planMonth)}</td>
            <td class="text-end">${formatCurrency.format(cta.prevMonth)}</td>
            <td class="text-end">${formatPercent(varPlan)}</td>
            <td class="text-end">${formatPercent(varPrev)}</td>
          `;
          TABLE_BODY.appendChild(fila);
        });

        // 4. Total de Sección
        const totalRow = document.createElement('tr');
        totalRow.className = 'sum-row fw-bold';
        totalRow.style.backgroundColor = '#f0f0f0';
        const secVarPlan = variation(seccion.totalActualMonth, seccion.totalPlanMonth);
        const secVarPrev = variation(seccion.totalActualMonth, seccion.totalPrevMonth);
        
        totalRow.innerHTML = `
          <td></td>
          <td class="text-end">Total ${seccion.label}</td>
          <td class="text-end">${formatCurrency.format(seccion.totalActualMonth)}</td>
          <td class="text-end">${formatCurrency.format(seccion.totalPlanMonth)}</td>
          <td class="text-end">${formatCurrency.format(seccion.totalPrevMonth)}</td>
          <td class="text-end">${formatPercent(secVarPlan)}</td>
          <td class="text-end">${formatPercent(secVarPrev)}</td>
        `;
        TABLE_BODY.appendChild(totalRow);
      });
    });
  };

  const fetchSummary = async (anio, mes) => {
    if (!anio) return;
    vaciarTabla(ESTADO_BIEN);
    try {
      const empresa = obtenerEmpresaActiva();
      const response = await fetch(`${API_BASE}/reportes/resumen?empresaId=${encodeURIComponent(empresa.id)}&anio=${Number(anio)}&mes=${mes || 'dic'}`, {
        headers: Sesion.headersAutenticacion()
      });
      if (!response.ok) {
        throw new Error('Error al cargar el resumen.');
      }
      const data = await response.json();
      renderizarResumen(data.resumen);
      actualizarEncabezadosYears(anio);
    } catch (error) {
      console.error(error);
      vaciarTabla('Ocurrió un error al cargar el reporte.');
    }
  };

  const poblarAnios = async () => {
    const empresa = obtenerEmpresaActiva();
    if (!empresa?.id) return [];
    try {
      const params = new URLSearchParams({ empresaId: empresa.id });
      const respuesta = await fetch(`${API_BASE}/modulos/summary-anios?${params}`, {
        headers: Sesion.headersAutenticacion()
      });
      const datos = await respuesta.json();
      if (!respuesta.ok) {
        throw new Error(datos.mensaje || 'No fue posible obtener los ejercicios.');
      }
      const anios = Array.isArray(datos.anios)
        ? [...new Set(datos.anios.filter((y) => Number.isFinite(Number(y))))].sort((a, b) => b - a)
        : [];
      return anios;
    } catch (error) {
      console.warn('Resumen: no se pudieron cargar los ejercicios disponibles.', error);
      return [];
    }
  };

    const inicializarSelectAnio = async () => {
      if (!YEAR_SELECT) return null;
      const lista = await poblarAnios();
      YEAR_SELECT.innerHTML = '';
    if (!lista.length) {
      const opt = document.createElement('option');
      opt.value = '';
      opt.textContent = 'Sin ejercicios disponibles';
      YEAR_SELECT.appendChild(opt);
      YEAR_SELECT.disabled = true;
      return null;
    }
    lista.forEach((anio) => {
      const opcion = document.createElement('option');
      opcion.value = String(anio);
      opcion.textContent = String(anio);
      YEAR_SELECT.appendChild(opcion);
    });
    YEAR_SELECT.disabled = false;
    const actual = lista[0];
    YEAR_SELECT.value = String(actual);
    return actual;
  };

    const iniciar = async () => {
      if (!TABLE_BODY) return;
      const valor = await inicializarSelectAnio();
      actualizarEncabezadosYears(valor);
      if (valor) {
        const periodo = Number(MONTH_SELECT?.value) || 12;
        await fetchSummary(Number(valor), periodo);
      }
    };

    const onChangeAnio = async () => {
      const valor = Number(YEAR_SELECT?.value);
      if (Number.isInteger(valor)) {
        actualizarEncabezadosYears(valor);
        const periodo = Number(MONTH_SELECT?.value) || 12;
        await fetchSummary(valor, periodo);
      }
    };

    const onChangeMonth = async () => {
      const anio = Number(YEAR_SELECT?.value);
      const periodo = Number(MONTH_SELECT?.value);
      if (Number.isInteger(anio) && Number.isInteger(periodo)) {
        await fetchSummary(anio, periodo);
      }
    };

  YEAR_SELECT?.addEventListener('change', onChangeAnio);
  MONTH_SELECT?.addEventListener('change', onChangeMonth);
  document.addEventListener('DOMContentLoaded', () => {
    iniciar();
  });
  window.addEventListener(Sesion.EVENTO_EMPRESA, async () => {
    await iniciar();
  });
})();
