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
  const capituloLabel = document.getElementById('capituloLabel');
  const selectCapitulo = document.getElementById('selectCapitulo');
  let capituloActual = '';
  let empresaActual = null;
  const leerAnioSeleccionado = () => Number(selectAnio?.value) || new Date().getFullYear();
  const leerMesSeleccionado = () => Number(selectMes?.value) || (new Date().getMonth() + 1);
  const obtenerCapituloEmpresa = (empresaId) => {
    return window.CapitulosModulos?.obtenerCapituloPorEmpresa?.(empresaId) || null;
  };

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

  // Compatibilidad: algunos layouts antiguos esperaban esta función.
  // Hoy el capítulo se deriva de la empresa activa, pero aquí podemos
  // también mostrar y permitir cambiar la selección.
  const actualizarEtiquetaCapitulo = (texto) => {
    if (!capituloLabel) return;
    const valor = texto ? texto.toString() : '';
    capituloLabel.textContent = valor ? `Capítulo: ${valor}` : 'Capítulo: -';
  };

  const actualizarCapitulos = (capitulos = [], seleccionado = '') => {
    if (!selectCapitulo) {
      capituloActual = seleccionado || capituloActual;
      actualizarEtiquetaCapitulo(capituloActual);
      return;
    }

    selectCapitulo.innerHTML = '';
    if (!Array.isArray(capitulos) || !capitulos.length) {
      const option = document.createElement('option');
      option.value = '';
      option.textContent = 'Sin capítulos disponibles';
      selectCapitulo.appendChild(option);
      selectCapitulo.disabled = true;
      capituloActual = '';
      actualizarEtiquetaCapitulo('');
      return;
    }

    capitulos.forEach((item) => {
      const etiqueta = (item?.etiqueta ?? item?.clave ?? '').toString().trim();
      if (!etiqueta) return;
      const option = document.createElement('option');
      option.value = etiqueta;
      option.textContent = etiqueta;
      selectCapitulo.appendChild(option);
    });

    const preferido = capitulos.find((item) => (item?.etiqueta ?? '').toString().trim() === (seleccionado || '').toString().trim())
      ? (seleccionado || '')
      : (selectCapitulo.options[0]?.value || '');

    selectCapitulo.value = preferido;
    selectCapitulo.disabled = capitulos.length <= 1;
    capituloActual = preferido;
    actualizarEtiquetaCapitulo(preferido);
  };

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

  const extractTotals = (nodo = {}) => ({
    actualMonth: toNumber(nodo.actualMonth ?? nodo.totalActualMonth),
    planMonth: toNumber(nodo.planMonth ?? nodo.totalPlanMonth),
    prevMonth: toNumber(nodo.prevMonth ?? nodo.totalPrevMonth),
    actualYTD: toNumber(nodo.actualYTD ?? nodo.totalActualYTD),
    planYTD: toNumber(nodo.planYTD ?? nodo.totalPlanYTD),
    prevYTD: toNumber(nodo.prevYTD ?? nodo.totalPrevYTD)
  });

  const createTotalsRow = (nodo, options = {}) => {
    const {
      label = '',
      rowClass = '',
      labelClasses = 'text-center text-primary text-uppercase',
      boldNumbers = false
    } = options;

    const totals = extractTotals(nodo);
    const varMonthPlan = calculateVar(totals.actualMonth, totals.planMonth);
    const varMonthPrev = calculateVar(totals.actualMonth, totals.prevMonth);
    const varYTDPlan = calculateVar(totals.actualYTD, totals.planYTD);
    const varYTDPrev = calculateVar(totals.actualYTD, totals.prevYTD);

    const row = document.createElement('tr');
    row.className = rowClass || '';
    row.innerHTML = `
      <td></td>
      ${createCell(totals.actualMonth, boldNumbers)}
      ${createCell(totals.planMonth, boldNumbers)}
      ${createCell(totals.prevMonth, boldNumbers)}
      ${createPercentCell(varMonthPlan)}
      ${createPercentCell(varMonthPrev)}
      <td class="${labelClasses}">${label}</td>
      ${createCell(totals.actualYTD, boldNumbers)}
      ${createCell(totals.planYTD, boldNumbers)}
      ${createCell(totals.prevYTD, boldNumbers)}
      ${createPercentCell(varYTDPlan)}
      ${createPercentCell(varYTDPrev)}
    `;
    return row;
  };

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
    summaryBody.innerHTML = '';

    if (!resumen.length) {
      summaryBody.innerHTML = '<tr><td colspan="12" class="text-center">Sin datos disponibles.</td></tr>';
      return;
    }

    resumen.forEach((capitulo) => {
      summaryBody.appendChild(createTotalsRow(capitulo, {
        label: capitulo.label || '',
        rowClass: 'section-header-row table-secondary fw-bold text-center',
        labelClasses: 'text-center text-primary text-uppercase',
        boldNumbers: true
      }));

      const principales = Array.isArray(capitulo.children) ? capitulo.children : [];
      principales.forEach((principal) => {
        if (!principal) return;
        summaryBody.appendChild(createTotalsRow(principal, {
          label: principal.label || '',
          rowClass: 'section-header-row table-light fw-bold text-center',
          labelClasses: 'text-center text-secondary text-uppercase',
          boldNumbers: true
        }));

        const secciones = Array.isArray(principal.children) ? principal.children : [];
        secciones.forEach((seccion) => {
          (seccion.cuentas || []).forEach((cta) => {
            const ctaVarMonthPlan = calculateVar(cta.actualMonth, cta.planMonth);
            const ctaVarMonthPrev = calculateVar(cta.actualMonth, cta.prevMonth);
            const ctaVarYTDPlan = calculateVar(cta.actualYTD, cta.planYTD);
            const ctaVarYTDPrev = calculateVar(cta.actualYTD, cta.prevYTD);

            const ctaRow = document.createElement('tr');
            ctaRow.innerHTML = `
              <td class="font-monospace small text-start account-column">${cta.cuenta || ''}</td>
              ${createCell(cta.actualMonth)}
              ${createCell(cta.planMonth)}
              ${createCell(cta.prevMonth)}
              ${createPercentCell(ctaVarMonthPlan)}
              ${createPercentCell(ctaVarMonthPrev)}
              <td class="text-center">${cta.descripcion || ''}</td>
              ${createCell(cta.actualYTD)}
              ${createCell(cta.planYTD)}
              ${createCell(cta.prevYTD)}
              ${createPercentCell(ctaVarYTDPlan)}
              ${createPercentCell(ctaVarYTDPrev)}
            `;
            summaryBody.appendChild(ctaRow);
          });

          summaryBody.appendChild(createTotalsRow(seccion, {
            label: seccion.label || '',
            rowClass: 'subsection-row fw-semibold text-center',
            labelClasses: 'text-start text-primary',
            boldNumbers: true
          }));
        });
      });
    });

    if (mesSeleccionado) {
      actualizarEtiquetaMes(mesSeleccionado);
    }
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

  const aplicarEmpresa = async (empresaId) => {
    if (!empresaId) return;
    if (selectMes) {
      selectMes.value = String(new Date().getMonth() + 1);
    }
    capituloActual = '';
    if (selectCapitulo) {
      selectCapitulo.innerHTML = '<option value="">Cargando capítulos...</option>';
      selectCapitulo.disabled = true;
    }
    await cargarAniosDisponibles(empresaId);
    const anioSeleccionado = leerAnioSeleccionado();
    const mesSeleccionado = leerMesSeleccionado();
    const capituloPreferido = selectCapitulo?.value || capituloActual || '';
    await fetchSummary(empresaId, anioSeleccionado, mesSeleccionado, capituloPreferido);
  };

  const fetchSummary = async (empresaId, anio, mes, capitulo = '') => {
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
      const preferido = (capitulo || '').toString().trim() || obtenerCapituloEmpresa(empresaId) || '';
      if (preferido) {
        params.set('capitulo', preferido);
      }
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
      actualizarCapitulos(data.capitulosDisponibles || [], data.capituloSeleccionado || preferido);
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

    empresaActual = empresa;
    await aplicarEmpresa(empresaActual.id);

    const leerCapitulo = () => (selectCapitulo?.value || '').toString().trim();

    const handleAnioChange = () => {
      const anio = leerAnioSeleccionado();
      const mes = leerMesSeleccionado();
      actualizarEtiquetasAnio(anio, anio - 1);
      if (empresaActual?.id) {
        fetchSummary(empresaActual.id, anio, mes, leerCapitulo());
      }
    };

    const handleMesChange = () => {
      const anio = leerAnioSeleccionado();
      const mes = leerMesSeleccionado();
      actualizarEtiquetaMes(mes);
      if (empresaActual?.id) {
        fetchSummary(empresaActual.id, anio, mes, leerCapitulo());
      }
    };

    if (selectAnio) {
      selectAnio.addEventListener('change', handleAnioChange);
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
      selectMes.addEventListener('change', handleMesChange);
      actualizarEtiquetaMes(leerMesSeleccionado());
    }

    if (selectCapitulo) {
      selectCapitulo.addEventListener('change', () => {
        const anio = leerAnioSeleccionado();
        const mes = leerMesSeleccionado();
        capituloActual = selectCapitulo.value || '';
        if (empresaActual?.id) {
          fetchSummary(empresaActual.id, anio, mes, capituloActual);
        }
      });
    }

    window.addEventListener(Sesion.EVENTO_EMPRESA, async (event) => {
      const nuevaEmpresa = event?.detail?.empresa;
      if (!nuevaEmpresa?.id) return;
      empresaActual = nuevaEmpresa;
      await aplicarEmpresa(empresaActual.id);
    });
  });
})();
