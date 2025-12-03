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

  const renderSummary = (resumen = []) => {
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

  const fetchSummary = async (empresaId, anio) => {
    if (!empresaId) return;
    showStatus('Cargando datos del reporte Summary...', 'info');
    try {
      const response = await fetch(`${API_ENDPOINT}?empresaId=${encodeURIComponent(empresaId)}&anio=${Number(anio)}`, {
        headers: Sesion.headersAutenticacion()
      });
      if (!response.ok) {
        throw new Error('No fue posible obtener el Summary.');
      }
      const data = await response.json();
      renderSummary(data.resumen || []);
      renderAggregateTable(data.resumen || []);
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
      const anios = data.anios || [];
      
      // Asegurar años vigentes (2024, 2025, 2026)
      const anoActual = new Date().getFullYear();
      const aniosVigentes = [anoActual - 1, anoActual, anoActual + 1];
      const aniosMerge = [...new Set([...anios, ...aniosVigentes])].filter(a => a >= 2000 && a <= 2100).sort((a, b) => b - a);
      
      // Poblar select
      selectAnio.innerHTML = '';
      aniosMerge.forEach(ano => {
        const option = document.createElement('option');
        option.value = ano;
        option.textContent = ano;
        selectAnio.appendChild(option);
      });
      
      // Seleccionar año actual
      selectAnio.value = anoActual;
      selectAnio.disabled = false;
      
      return aniosMerge;
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
    await cargarAniosDisponibles(empresa.id);
    
    // Cargar datos del año seleccionado
    const anioActual = Number(selectAnio?.value) || new Date().getFullYear();
    await fetchSummary(empresa.id, anioActual);
    
    // Event listener para cambios de año
    if (selectAnio) {
      selectAnio.addEventListener('change', () => {
        const anio = Number(selectAnio.value) || new Date().getFullYear();
        fetchSummary(empresa.id, anio);
      });
    }
  });
})();
