(() => {
  const base = window.location.protocol === 'file:' ? 'http://localhost:3000' : window.location.origin;
  const API_ENDPOINT = `${base}/api/reportes/resumen`;
  const API_ANIOS = `${base}/api/saldos/anios`;
  
  const formatNumber = (valor) => {
    const monto = Number(valor ?? 0);
    if (!Number.isFinite(monto)) return '0.00';
    return new Intl.NumberFormat('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(monto);
  };

  const tablaBody = document.getElementById('tablaCuentasBody');
  const yearSelect = document.getElementById('resumenYearSelect');
  const searchInput = document.getElementById('accountSearch');
  const toggleBtn = document.getElementById('toggleAccountsBtn');

  const cargarAniosDisponibles = async (empresaId) => {
    if (!yearSelect) return [];
    
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
      yearSelect.innerHTML = '';
      aniosMerge.forEach(ano => {
        const option = document.createElement('option');
        option.value = ano;
        option.textContent = ano;
        yearSelect.appendChild(option);
      });
      
      // Seleccionar año actual
      yearSelect.value = anoActual;
      
      return aniosMerge;
    } catch (error) {
      console.error('Error cargando años:', error);
      yearSelect.innerHTML = '<option value="">Error cargando años</option>';
      return [];
    }
  };

  const setStatusRow = (mensaje) => {
    if (!tablaBody) return;
    tablaBody.innerHTML = `<tr class="estado-tabla"><td colspan="7">${mensaje}</td></tr>`;
  };

  const groupFilas = (filas = []) => {
    const grupos = {};
    filas.forEach((fila) => {
      const clave = fila.grupo || 'GENERAL';
      if (!grupos[clave]) {
        grupos[clave] = [];
      }
      grupos[clave].push(fila);
    });
    return grupos;
  };

  const renderTable = (filas = []) => {
    if (!tablaBody) return;
    if (!filas.length) {
      setStatusRow('No hay datos disponibles para este año.');
      return;
    }
    tablaBody.innerHTML = '';
    const grupos = groupFilas(filas);
    Object.keys(grupos).forEach((grupo) => {
      const header = document.createElement('tr');
      header.className = 'section-header-row';
      header.dataset.section = grupo;
      header.innerHTML = `<td colspan="7">${grupo}</td>`;
      tablaBody.appendChild(header);
      grupos[grupo].forEach((fila) => {
        const varPlan = Number(fila.anual || 0);
        const varReal = Number(fila.anual || 0) - Number(fila.dic ?? 0);
        const row = document.createElement('tr');
        row.className = 'data-row';
        row.dataset.section = grupo;
        row.innerHTML = `
          <td>${fila.cuenta}</td>
          <td>${fila.descripcion}</td>
          <td class="text-end">${formatNumber(fila.anual)}</td>
          <td class="text-end">0.00</td>
          <td class="text-end">${formatNumber(fila.dic)}</td>
          <td class="text-end">${formatNumber(varPlan)}</td>
          <td class="text-end">${formatNumber(varReal)}</td>
        `;
        tablaBody.appendChild(row);
      });
    });
  };

  const filterRows = (termino) => {
    if (!tablaBody) return;
    const texto = (termino || '').toLowerCase();
    const rows = Array.from(tablaBody.querySelectorAll('tr.data-row'));
    rows.forEach((fila) => {
      const contenido = (fila.textContent || '').toLowerCase();
      fila.classList.toggle('d-none', texto && !contenido.includes(texto));
    });
    const headers = Array.from(tablaBody.querySelectorAll('tr.section-header-row'));
    headers.forEach((encabezado) => {
      const seccion = encabezado.dataset.section;
      const hijos = Array.from(tablaBody.querySelectorAll(`tr.data-row[data-section="${seccion}"]`));
      const visible = hijos.some((fila) => !fila.classList.contains('d-none'));
      encabezado.classList.toggle('d-none', texto && !visible);
    });
  };

  const fetchResumen = async (empresaId, anio) => {
    if (!empresaId || !anio) return;
    setStatusRow('Cargando resumen financiero...');
    try {
      const respuesta = await fetch(`${API_ENDPOINT}?empresaId=${encodeURIComponent(empresaId)}&anio=${Number(anio)}`, {
        headers: Sesion.headersAutenticacion()
      });
      if (!respuesta.ok) {
        throw new Error('No fue posible obtener el resumen.');
      }
      const datos = await respuesta.json();
      renderTable(datos.filas || []);
    } catch (error) {
      console.error('Error resumen:', error);
      setStatusRow(error.message || 'No fue posible cargar el resumen.');
    }
  };

  const initToggleColumns = () => {
    if (!toggleBtn) return;
    const tabla = document.getElementById('tablaComparacion');
    toggleBtn.addEventListener('click', () => {
      if (!tabla) return;
      tabla.classList.toggle('sin-cuentas');
      const oculto = tabla.classList.contains('sin-cuentas');
      toggleBtn.setAttribute('aria-pressed', oculto ? 'true' : 'false');
      const etiqueta = toggleBtn.querySelector('.toggle-account-label');
      if (etiqueta) {
        etiqueta.textContent = oculto ? 'Mostrar cuentas' : 'Ocultar cuentas';
      }
    });
  };

  document.addEventListener('DOMContentLoaded', async () => {
    const sesion = Sesion.requerirSesion();
    if (!sesion) return;
    const empresa = Sesion.obtenerEmpresaActiva(sesion);
    if (!empresa?.id) {
      setStatusRow('Selecciona una empresa para continuar.');
      return;
    }
    
    // Cargar años disponibles
    await cargarAniosDisponibles(empresa.id);
    
    const valorInicial = Number(yearSelect?.value) || new Date().getFullYear();
    fetchResumen(empresa.id, valorInicial);
    if (yearSelect) {
      yearSelect.addEventListener('change', () => {
        const anio = Number(yearSelect.value) || new Date().getFullYear();
        fetchResumen(empresa.id, anio);
      });
    }
    if (searchInput) {
      searchInput.addEventListener('input', (event) => {
        filterRows(event.target.value);
      });
    }
    initToggleColumns();
  });
})();
