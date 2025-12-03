(() => {
  const base = window.location.protocol === 'file:' ? 'http://localhost:3000' : window.location.origin;
  const API_ENDPOINT = `${base}/api/reportes/summary`;
  const API_ANIOS = `${base}/api/saldos/anios`;

  const toNumber = (valor) => {
    const numero = Number(valor);
    return Number.isFinite(numero) ? numero : 0;
  };
  
  const formatNumber = (valor) => {
    const monto = Number(valor ?? 0);
    if (!Number.isFinite(monto)) return '0.00';
    return new Intl.NumberFormat('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(monto);
  };

  const summaryStatus = document.getElementById('summaryStatus');
  const summaryBody = document.getElementById('summaryTableBody');
  const aggregateBody = document.getElementById('summaryCityAggregates');
  const selectAnio = document.getElementById('selectAnio');
  const selectMes = document.getElementById('selectMes');
  const obtenerCapituloEmpresa = (empresaId) => {
    return window.CapitulosModulos?.obtenerCapituloPorEmpresa?.(empresaId) || null;
  };

  const cambiosPendientes = new Map();
  let editMode = false;

  const MESES = [
    { etiqueta: 'Enero', clave: 'ene', periodo: 1 },
    { etiqueta: 'Febrero', clave: 'feb', periodo: 2 },
    { etiqueta: 'Marzo', clave: 'mar', periodo: 3 },
    { etiqueta: 'Abril', clave: 'abr', periodo: 4 },
    { etiqueta: 'Mayo', clave: 'may', periodo: 5 },
    { etiqueta: 'Junio', clave: 'jun', periodo: 6 },
    { etiqueta: 'Julio', clave: 'jul', periodo: 7 },
    { etiqueta: 'Agosto', clave: 'ago', periodo: 8 },
    { etiqueta: 'Septiembre', clave: 'sep', periodo: 9 },
    { etiqueta: 'Octubre', clave: 'oct', periodo: 10 },
    { etiqueta: 'Noviembre', clave: 'nov', periodo: 11 },
    { etiqueta: 'Diciembre', clave: 'dic', periodo: 12 }
  ];

  const limpiarCambios = () => {
    cambiosPendientes.clear();
    editMode = false;
  };

  const claveCambio = (cuenta, columna) => `${cuenta}|${columna}`;

  const registrarCambio = (cuenta, columna, valor, original) => {
    if (!cuenta || !columna) return;
    cambiosPendientes.set(claveCambio(cuenta, columna), {
      cuenta,
      columna,
      valor,
      original
    });
  };

  const eliminarCambio = (cuenta, columna) => {
    cambiosPendientes.delete(claveCambio(cuenta, columna));
  };

  const obtenerCambiosPendientes = () => {
    const porCuenta = new Map();
    cambiosPendientes.forEach((registro) => {
      const valores = porCuenta.get(registro.cuenta) || {};
      valores[registro.columna] = registro.valor;
      porCuenta.set(registro.cuenta, valores);
    });

    const presupuesto = Array.from(porCuenta.entries()).map(([cuenta, valores]) => ({
      cuenta,
      valores
    }));

    return { presupuesto, hayCambios: presupuesto.length > 0 };
  };

  const notificarCambios = () => {
    const detalle = { ...obtenerCambiosPendientes(), borradorGuardado: false };
    window.dispatchEvent(new CustomEvent('modulo-planeacion:presupuesto-editado', { detail: detalle }));
  };

  const parseNumber = (texto) => {
    const limpio = String(texto || '')
      .replace(/[^0-9,.-]/g, '')
      .replace(/,/g, '');
    const numero = Number(limpio);
    return Number.isFinite(numero) ? numero : 0;
  };

  const restaurarValoresOriginales = () => {
    if (!summaryBody) return;
    Array.from(summaryBody.querySelectorAll('.editable-cell')).forEach((celda) => {
      const original = Number(celda.dataset.valorOriginal ?? 0);
      celda.textContent = formatNumber(original);
    });
  };

  const cancelarEdicion = () => {
    restaurarValoresOriginales();
    limpiarCambios();
    notificarCambios();
  };

  const manejarBlurCelda = (event) => {
    const celda = event.currentTarget;
    const fila = celda.closest('tr');
    const cuenta = fila?.dataset.cuenta;
    const columna = celda.dataset.columnaClave;
    const original = Number(celda.dataset.valorOriginal ?? 0);
    const nuevoValor = parseNumber(celda.textContent);

    if (!cuenta || !columna) return;

    if (nuevoValor !== original) {
      celda.textContent = formatNumber(nuevoValor);
      registrarCambio(cuenta, columna, nuevoValor, original);
    } else {
      celda.textContent = formatNumber(original);
      eliminarCambio(cuenta, columna);
    }

    notificarCambios();
  };

  const activarModoEdicion = () => {
    if (editMode || !summaryBody) return;
    editMode = true;
    const celdas = Array.from(summaryBody.querySelectorAll('.editable-cell'));
    celdas.forEach((celda) => {
      celda.contentEditable = 'true';
      celda.addEventListener('blur', manejarBlurCelda);
    });
  };

  window.CuentasModulo = window.CuentasModulo || {};
  window.CuentasModulo.cancelEdit = cancelarEdicion;
  window.CuentasModulo.getCambios = obtenerCambiosPendientes;

  // Compatibilidad: algunos layouts antiguos esperaban esta función.
  // Hoy el capítulo se deriva de la empresa activa, pero exponemos un
  // no-op para evitar referencias indefinidas en cargas previas.
  const actualizarCapitulos = () => {};

  const CITY_LABELS = {
    empresa1: 'Ciudad de México',
    empresa2: 'Guadalajara',
    empresa3: 'Noreste',
    empresa4: 'Noroeste'
  };

  const emptyCells = (count) => Array(count).fill('<td></td>').join('');

  const showStatus = (mensaje, tipo = 'info') => {
    if (!summaryStatus) return;
    summaryStatus.textContent = mensaje;
    summaryStatus.className = `alert alert-${tipo} mb-3`;
  };

  const hideStatus = () => {
    if (!summaryStatus) return;
    summaryStatus.textContent = '';
    summaryStatus.className = 'alert alert-info mb-3 visually-hidden';
  };

  const safeDiv = (numerador, denominador) => {
    const num = toNumber(numerador);
    const den = toNumber(denominador);
    if (!Number.isFinite(den) || Math.abs(den) === 0) return 0;
    return num / den;
  };

  const calculateVar = (actual, base) => {
    const actualNum = toNumber(actual);
    const baseNum = toNumber(base);
    return safeDiv(actualNum - baseNum, Math.abs(baseNum)) * 100;
  };

  const formatPercent = (val) => {
    if (!Number.isFinite(val)) return '0.00%';
    return val.toFixed(2) + '%';
  };

  const createCell = (val, isBold = false) => `<td class="text-end ${isBold ? 'fw-bold' : ''}">${formatNumber(val)}</td>`;
  const createPercentCell = (val) => `<td class="text-end">${formatPercent(val)}</td>`;

  const actualizarEtiquetaMes = (mesSeleccionado) => {
    const etiqueta = MESES.find((m) => m.periodo === mesSeleccionado)?.etiqueta || '';
    document.querySelectorAll('.mes').forEach((span) => {
      span.textContent = etiqueta.toUpperCase();
    });
  };

  const actualizarEtiquetasAnio = (anioActual, anioComparativo) => {
    const anioNum = Number(anioActual);
    const anioAnterior = Number.isFinite(Number(anioComparativo)) ? Number(anioComparativo) : anioNum - 1;
    const etiquetaActual = Number.isFinite(anioNum) ? anioNum : '—';
    const etiquetaAnterior = Number.isFinite(anioAnterior) ? anioAnterior : '—';

    document.querySelectorAll('.anio').forEach((span) => {
      span.textContent = etiquetaActual;
    });
    document.querySelectorAll('.anio-seleccionado').forEach((span) => {
      span.textContent = etiquetaActual;
    });
    document.querySelectorAll('.anio-seleccionado-anterior').forEach((span) => {
      span.textContent = etiquetaAnterior;
    });
  };

  const renderSummary = (resumen = [], mesSeleccionado) => {
    if (!summaryBody) return;
    limpiarCambios();
    summaryBody.innerHTML = '';

    if (!resumen.length) {
      summaryBody.innerHTML = '<tr><td colspan="12" class="text-center">Sin datos disponibles.</td></tr>';
      return;
    }
    
    resumen.forEach((capitulo) => {
      // 1. Fila de Capítulo (ej. CDMX Income)
      const capVarMonthPlan = calculateVar(capitulo.totalActualMonth, capitulo.totalPlanMonth);
      const capVarMonthPrev = calculateVar(capitulo.totalActualMonth, capitulo.totalPrevMonth);
      const capVarYTDPlan = calculateVar(capitulo.totalActualYTD, capitulo.totalPlanYTD);
      const capVarYTDPrev = calculateVar(capitulo.totalActualYTD, capitulo.totalPrevYTD);

      const capRow = document.createElement('tr');
      capRow.className = 'section-header-row table-secondary fw-bold text-center';
      capRow.innerHTML = `
        <td></td> <!-- Cuenta vacía -->
        ${createCell(capitulo.totalActualMonth, true)}
        ${createCell(capitulo.totalPlanMonth, true)}
        ${createCell(capitulo.totalPrevMonth, true)}
        ${createPercentCell(capVarMonthPlan)}
        ${createPercentCell(capVarMonthPrev)}
        <td class="text-center text-primary text-uppercase">${capitulo.label}</td>
        ${createCell(capitulo.totalActualYTD, true)}
        ${createCell(capitulo.totalPlanYTD, true)}
        ${createCell(capitulo.totalPrevYTD, true)}
        ${createPercentCell(capVarYTDPlan)}
        ${createPercentCell(capVarYTDPrev)}
      `;
      summaryBody.appendChild(capRow);

      (capitulo.children || []).forEach((seccion) => {
        // 2. Fila de Sección (ej. Membership)
        const secVarMonthPlan = calculateVar(seccion.totalActualMonth, seccion.totalPlanMonth);
        const secVarMonthPrev = calculateVar(seccion.totalActualMonth, seccion.totalPrevMonth);
        const secVarYTDPlan = calculateVar(seccion.totalActualYTD, seccion.totalPlanYTD);
        const secVarYTDPrev = calculateVar(seccion.totalActualYTD, seccion.totalPrevYTD);

        const secRow = document.createElement('tr');
        secRow.className = 'subsection-row fw-bold fst-italic text-center';
        secRow.style.backgroundColor = '#e9ecef';
        secRow.innerHTML = `
          <td></td>
          ${createCell(seccion.totalActualMonth)}
          ${createCell(seccion.totalPlanMonth)}
          ${createCell(seccion.totalPrevMonth)}
          ${createPercentCell(secVarMonthPlan)}
          ${createPercentCell(secVarMonthPrev)}
          <td class="text-center">${seccion.label}</td>
          ${createCell(seccion.totalActualYTD)}
          ${createCell(seccion.totalPlanYTD)}
          ${createCell(seccion.totalPrevYTD)}
          ${createPercentCell(secVarYTDPlan)}
          ${createPercentCell(secVarYTDPrev)}
        `;
        summaryBody.appendChild(secRow);

        // 3. Filas de Cuentas
        (seccion.cuentas || []).forEach((cta) => {
          const ctaVarMonthPlan = calculateVar(cta.actualMonth, cta.planMonth);
          const ctaVarMonthPrev = calculateVar(cta.actualMonth, cta.prevMonth);
          const ctaVarYTDPlan = calculateVar(cta.actualYTD, cta.planYTD);
          const ctaVarYTDPrev = calculateVar(cta.actualYTD, cta.prevYTD);

          const ctaRow = document.createElement('tr');
          ctaRow.className = 'data-row';
          ctaRow.dataset.cuenta = cta.cuenta;
          ctaRow.innerHTML = `
            <td class="font-monospace small text-start account-column">${cta.cuenta}</td>
            <td class="text-end editable-cell" data-columna-clave="actualMonth" data-valor-original="${Number(
              cta.actualMonth ?? 0
            )}">${formatNumber(cta.actualMonth)}</td>
            <td class="text-end editable-cell" data-columna-clave="planMonth" data-valor-original="${Number(
              cta.planMonth ?? 0
            )}">${formatNumber(cta.planMonth)}</td>
            <td class="text-end editable-cell" data-columna-clave="prevMonth" data-valor-original="${Number(
              cta.prevMonth ?? 0
            )}">${formatNumber(cta.prevMonth)}</td>
            ${createPercentCell(ctaVarMonthPlan)}
            ${createPercentCell(ctaVarMonthPrev)}
            <td class="text-center">${cta.descripcion}</td>
            <td class="text-end editable-cell" data-columna-clave="actualYTD" data-valor-original="${Number(
              cta.actualYTD ?? 0
            )}">${formatNumber(cta.actualYTD)}</td>
            <td class="text-end editable-cell" data-columna-clave="planYTD" data-valor-original="${Number(
              cta.planYTD ?? 0
            )}">${formatNumber(cta.planYTD)}</td>
            <td class="text-end editable-cell" data-columna-clave="prevYTD" data-valor-original="${Number(
              cta.prevYTD ?? 0
            )}">${formatNumber(cta.prevYTD)}</td>
            ${createPercentCell(ctaVarYTDPlan)}
            ${createPercentCell(ctaVarYTDPrev)}
          `;
          summaryBody.appendChild(ctaRow);
        });
      });
    });

    if (mesSeleccionado) {
      actualizarEtiquetaMes(mesSeleccionado);
    }

    activarModoEdicion();
  };

  const renderAggregateTable = (resumen = []) => {
    if (!aggregateBody) return;
    aggregateBody.innerHTML = '';
    const totals = {};
    resumen.forEach((nodo) => {
      (nodo.children || []).forEach((child) => {
        const clave = child.empresa || 'empresa1';
        totals[clave] = (totals[clave] || 0) + Number(child.total || 0);
      });
    });
    if (!Object.keys(totals).length) {
      aggregateBody.innerHTML = '<tr><td colspan="8" class="text-center">Sin datos consolidados.</td></tr>';
      return;
    }
    Object.entries(totals).forEach(([empresa, total]) => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${CITY_LABELS[empresa] || empresa}</td>
        <td class="text-end">${formatNumber(total)}</td>
        <td class="text-end">0.00</td>
        <td class="text-end">0.00</td>
        <td class="text-end">0.00</td>
        <td class="text-end">0.00</td>
        <td class="text-end">0.00</td>
        <td class="text-end">${formatNumber(total)}</td>
      `;
      aggregateBody.appendChild(row);
    });
  };

  const fetchSummary = async (empresaId, anio, mes) => {
    if (!empresaId) return;
    showStatus('Cargando datos del reporte Summary...', 'info');
    try {
      const params = new URLSearchParams({
        empresaId: empresaId,
        anio: Number(anio)
      });
      if (Number.isInteger(mes)) {
        params.set('mes', String(mes));
      }
      const capituloClave = obtenerCapituloEmpresa(empresaId);
      if (capituloClave) params.set('capitulo', capituloClave);
      const response = await fetch(`${API_ENDPOINT}?${params.toString()}`, {
        headers: Sesion.headersAutenticacion()
      });
      if (!response.ok) {
        throw new Error('No fue posible obtener el Summary.');
      }
      const data = await response.json();
      const anioReporte = Number.isFinite(Number(data?.anio)) ? Number(data.anio) : anio;
      const anioPrevio = Number.isFinite(Number(data?.anioComparativo)) ? Number(data.anioComparativo) : anioReporte - 1;

      renderSummary(data.resumen || [], mes);
      renderAggregateTable(data.resumen || []);
      actualizarCapitulos(data.capitulosDisponibles || [], data.capituloSeleccionado);
      actualizarEtiquetasAnio(anioReporte, anioPrevio);
      hideStatus();
    } catch (error) {
      console.error('Error Summary:', error);
      showStatus(error.message || 'Error cargando el Summary.', 'danger');
    }
  };

  const cargarAniosDisponibles = async (empresaId) => {
    if (!selectAnio) return [];
    
    try {
      const response = await fetch(`${API_ANIOS}?empresaId=${encodeURIComponent(empresaId)}`, {
        headers: Sesion.headersAutenticacion()
      });
      
      if (!response.ok) {
        throw new Error('No fue posible obtener años disponibles');
      }
      
      const data = await response.json();
      const anios = (data.anios || []).filter((a) => Number.isInteger(a)).sort((a, b) => b - a);

      selectAnio.innerHTML = '';
      if (!anios.length) {
        const option = document.createElement('option');
        option.value = '';
        option.textContent = 'Sin años disponibles';
        selectAnio.appendChild(option);
        selectAnio.disabled = true;
        return [];
      }

      anios.forEach((ano) => {
        const option = document.createElement('option');
        option.value = ano;
        option.textContent = ano;
        selectAnio.appendChild(option);
      });

      selectAnio.value = anios[0];
      selectAnio.disabled = false;

      return anios;
    } catch (error) {
      console.error('Error cargando años:', error);
      selectAnio.innerHTML = '<option value="">Error cargando años</option>';
      selectAnio.disabled = true;
      return [];
    }
  };

  document.addEventListener('DOMContentLoaded', async () => {
    const sesion = Sesion.requerirSesion();
    if (!sesion) return;

    const empresa = Sesion.obtenerEmpresaActiva(sesion);
    if (!empresa?.id) {
      showStatus('Selecciona una empresa para continuar.', 'warning');
      return;
    }

    // Cargar años disponibles
    const anios = await cargarAniosDisponibles(empresa.id);
    const mesActual = new Date().getMonth() + 1;
    const anioInicial = Number(selectAnio?.value) || anios[0] || new Date().getFullYear();
    const mesInicial = Number.isInteger(mesActual) ? mesActual : 1;
    const modulo = document.body?.dataset?.modulo || 'summary';

    window.dispatchEvent(
      new CustomEvent('planeacion:contexto-actualizado', {
        detail: { empresaId: empresa.id, anio: anioInicial, modulo }
      })
    );

    actualizarEtiquetasAnio(anioInicial, anioInicial - 1);
    await fetchSummary(empresa.id, anioInicial, mesInicial);

    if (selectAnio) {
      selectAnio.addEventListener('change', () => {
        const anio = Number(selectAnio.value) || anioInicial;
        const mes = Number(selectMes?.value) || mesInicial;
        actualizarEtiquetasAnio(anio, anio - 1);
        window.dispatchEvent(
          new CustomEvent('planeacion:contexto-actualizado', {
            detail: { empresaId: empresa.id, anio, modulo }
          })
        );
        fetchSummary(empresa.id, anio, mes);
      });
    }

    if (selectMes) {
      selectMes.querySelectorAll('option').forEach((opt, idx) => {
        if (idx >= MESES.length) {
          opt.remove();
          return;
        }
        opt.value = String(MESES[idx].periodo);
        opt.textContent = MESES[idx].etiqueta;
      });
      selectMes.value = String(mesInicial);
      selectMes.addEventListener('change', () => {
        const anio = Number(selectAnio?.value) || anioInicial;
        const mes = Number(selectMes.value) || mesInicial;
        window.dispatchEvent(
          new CustomEvent('planeacion:contexto-actualizado', {
            detail: { empresaId: empresa.id, anio, modulo }
          })
        );
        fetchSummary(empresa.id, anio, mes);
      });
      actualizarEtiquetaMes(mesInicial);
    }
  });
})();
