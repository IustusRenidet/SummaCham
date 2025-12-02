(() => {
  const API_BASE = 'http://localhost:3000/api';
  const YEAR_SELECT = document.getElementById('resumenYearSelect');
  const TABLE_BODY = document.getElementById('tablaCuentasBody');
  const ESTADO_BIEN = 'Construyendo el resumen financiero, espera un momento...';
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

  const variation = (actual, base) => {
    if (!Number.isFinite(base) || base === 0) return 0;
    return ((Number(actual || 0) - Number(base || 0)) / Math.abs(base)) * 100;
  };

  const renderizarResumen = (detalle, seccionesPorCapitulo) => {
    if (!TABLE_BODY) return;
    TABLE_BODY.innerHTML = '';
    const mapaDetalle = new Map();
    detalle.forEach((fila) => {
      const codigo = sanitizeCodigo(fila.codigo);
      if (codigo) {
        mapaDetalle.set(codigo, fila);
      }
    });

    let totalIngresos = { real: 0, plan: 0, anterior: 0 };
    let totalGastos = { real: 0, plan: 0, anterior: 0 };

    seccionesPorCapitulo.forEach(({ capitulo, secciones }) => {
      const header = document.createElement('tr');
      header.className = 'section-header-row';
      const headerCelda = document.createElement('td');
      headerCelda.colSpan = 7;
      headerCelda.textContent = capitulo;
      header.appendChild(headerCelda);
      TABLE_BODY.appendChild(header);

      secciones.forEach((seccion) => {
        const totales = calcularTotales(seccion.seccion, seccion.cuentas, mapaDetalle);
        const fila = document.createElement('tr');
        fila.className = 'sum-row';
        fila.innerHTML = `
          <td></td>
          <td>${seccion.seccion}</td>
          <td class="budget-value">${formatCurrency.format(totales.real)}</td>
          <td class="budget-value">${formatCurrency.format(totales.plan)}</td>
          <td class="budget-value">${formatCurrency.format(totales.anterior)}</td>
          <td class="budget-value">${formatPercent(variation(totales.real, totales.plan))}</td>
          <td class="budget-value">${formatPercent(variation(totales.real, totales.anterior))}</td>
        `;
        TABLE_BODY.appendChild(fila);

        if (seccion.tipo === 'ingreso') {
          totalIngresos.real += totales.real;
          totalIngresos.plan += totales.plan;
          totalIngresos.anterior += totales.anterior;
        } else if (seccion.tipo === 'gasto') {
          totalGastos.real += totales.real;
          totalGastos.plan += totales.plan;
          totalGastos.anterior += totales.anterior;
        }
      });
    });

    const filaResultado = document.createElement('tr');
    filaResultado.className = 'result-row';
    const utilidadReal = totalIngresos.real - totalGastos.real;
    const utilidadPlan = totalIngresos.plan - totalGastos.plan;
    const utilidadAnterior = totalIngresos.anterior - totalGastos.anterior;
    filaResultado.innerHTML = `
      <td></td>
      <td>Utilidad Operativa</td>
      <td class="budget-value">${formatCurrency.format(utilidadReal)}</td>
      <td class="budget-value">${formatCurrency.format(utilidadPlan)}</td>
      <td class="budget-value">${formatCurrency.format(utilidadAnterior)}</td>
      <td class="budget-value">${formatPercent(variation(utilidadReal, utilidadPlan))}</td>
      <td class="budget-value">${formatPercent(variation(utilidadReal, utilidadAnterior))}</td>
    `;
    TABLE_BODY.appendChild(filaResultado);
  };

  const fetchSummary = async (anio) => {
    if (!TABLE_BODY) return;
    if (!Number.isInteger(anio)) {
      vaciarTabla('Selecciona un ejercicio válido para comenzar.');
      return;
    }
    const empresa = obtenerEmpresaActiva();
    if (!empresa?.id) {
      vaciarTabla('Selecciona una empresa válida.');
      return;
    }
    const codigos = construirCodigos();
    if (!codigos.length) {
      vaciarTabla('No existen cuentas mapeadas para este módulo.');
      return;
    }
    const payload = {
      anio,
      periodo: 12,
      empresaId: empresa.id,
      codigos,
      anioComparativo: anio - 1,
      usarAjusteEnYTD: true
    };
    vaciarTabla(ESTADO_BIEN);
    try {
      const respuesta = await fetch(`${API_BASE}/modulos/summary-resumen-e`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...Sesion.headersAutenticacion()
        },
        body: JSON.stringify(payload)
      });
      const datos = await respuesta.json();
      if (!respuesta.ok) {
        throw new Error(datos.mensaje || 'No fue posible obtener el resumen.');
      }
      const estructura = construirEstructura();
      renderizarResumen(datos.detalle || [], estructura);
    } catch (error) {
      console.error('Error al cargar resumen', error);
      vaciarTabla(error.message || 'No fue posible construir el resumen.');
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
    if (valor) {
      await fetchSummary(Number(valor));
    }
  };

  const onChangeAnio = async () => {
    const valor = Number(YEAR_SELECT?.value);
    if (Number.isInteger(valor)) {
      await fetchSummary(valor);
    }
  };

  YEAR_SELECT?.addEventListener('change', onChangeAnio);
  document.addEventListener('DOMContentLoaded', () => {
    iniciar();
  });
  window.addEventListener(Sesion.EVENTO_EMPRESA, async () => {
    await iniciar();
  });
})();
