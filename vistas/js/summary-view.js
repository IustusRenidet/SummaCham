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

  const createRow = (label, total, indent = false) => {
    const row = document.createElement('tr');
    const contenido = indent ? `↳ ${label}` : label;
    row.innerHTML = `
      <th scope="row">${contenido}</th>
      <td class="text-end">${formatNumber(total)}</td>
      ${emptyCells(10)}
    `;
    return row;
  };

  const renderSummary = (resumen = []) => {
    if (!summaryBody) return;
    summaryBody.innerHTML = '';
    if (!resumen.length) {
      summaryBody.innerHTML = '<tr><td colspan="12" class="text-center">Sin datos disponibles.</td></tr>';
      return;
    }
    resumen.forEach((nodo) => {
      summaryBody.appendChild(createRow(nodo.label, nodo.total));
      (nodo.children || []).forEach((child) => {
        summaryBody.appendChild(createRow(child.label, child.total, true));
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
