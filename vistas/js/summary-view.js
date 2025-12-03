(() => {
  const base = window.location.protocol === 'file:' ? 'http://localhost:3000' : window.location.origin;
  const API_ENDPOINT = `${base}/api/reportes/summary`;
  const API_ANIOS = `${base}/api/saldos/anios`;
  
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
  const selectCapitulo = document.getElementById('selectCapitulo');

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

  const calculateVar = (actual, budget) => {
    if (!budget) return 0;
    return ((actual - budget) / budget) * 100;
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

  const renderSummary = (resumen = [], mesSeleccionado) => {
    if (!summaryBody) return;
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
          ctaRow.innerHTML = `
            <td class="font-monospace small text-start">${cta.cuenta}</td>
            ${createCell(cta.actualMonth)}
            ${createCell(cta.planMonth)}
            ${createCell(cta.prevMonth)}
            ${createPercentCell(ctaVarMonthPlan)}
            ${createPercentCell(ctaVarMonthPrev)}
            <td class="text-center">${cta.descripcion}</td>
            ${createCell(cta.actualYTD)}
            ${createCell(cta.planYTD)}
            ${createCell(cta.prevYTD)}
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

  const actualizarCapitulos = (capitulos = [], seleccionado) => {
    if (!selectCapitulo) return;
    selectCapitulo.innerHTML = '';
    if (!capitulos.length) {
      const option = document.createElement('option');
      option.value = '';
      option.textContent = 'Sin capítulos';
      selectCapitulo.appendChild(option);
      selectCapitulo.disabled = true;
      return;
    }
    capitulos.forEach(({ clave, etiqueta }) => {
      const option = document.createElement('option');
      option.value = clave;
      option.textContent = etiqueta;
      selectCapitulo.appendChild(option);
    });
    if (seleccionado) {
      const claveSel = capitulos.find((c) => c.etiqueta === seleccionado)?.clave || seleccionado;
      selectCapitulo.value = claveSel;
    }
    if (!selectCapitulo.value) {
      selectCapitulo.value = capitulos[0].clave;
    }
    selectCapitulo.disabled = false;
  };

  const fetchSummary = async (empresaId, anio, mes, capituloClave) => {
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
      if (capituloClave) {
        params.set('capitulo', capituloClave);
      }
      const response = await fetch(`${API_ENDPOINT}?${params.toString()}`, {
        headers: Sesion.headersAutenticacion()
      });
      if (!response.ok) {
        throw new Error('No fue posible obtener el Summary.');
      }
      const data = await response.json();
      renderSummary(data.resumen || [], mes);
      renderAggregateTable(data.resumen || []);
      actualizarCapitulos(data.capitulosDisponibles || [], data.capituloSeleccionado);
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

    await fetchSummary(empresa.id, anioInicial, mesInicial, selectCapitulo?.value);

    if (selectAnio) {
      selectAnio.addEventListener('change', () => {
        const anio = Number(selectAnio.value) || anioInicial;
        const mes = Number(selectMes?.value) || mesInicial;
        const cap = selectCapitulo?.value || undefined;
        fetchSummary(empresa.id, anio, mes, cap);
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
        const cap = selectCapitulo?.value || undefined;
        fetchSummary(empresa.id, anio, mes, cap);
      });
      actualizarEtiquetaMes(mesInicial);
    }

    if (selectCapitulo) {
      selectCapitulo.addEventListener('change', () => {
        const anio = Number(selectAnio?.value) || anioInicial;
        const mes = Number(selectMes?.value) || mesInicial;
        const cap = selectCapitulo.value || undefined;
        fetchSummary(empresa.id, anio, mes, cap);
      });
    }
  });
})();
