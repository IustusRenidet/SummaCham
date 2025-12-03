(() => {
  const base = window.location.protocol === 'file:' ? 'http://localhost:3000' : window.location.origin;
  const API_ENDPOINT = `${base}/api/reportes/resumen`;
  const API_ANIOS = `${base}/api/saldos/anios`;
  
  const formatNumber = (valor) => {
    const monto = Number(valor ?? 0);
    if (!Number.isFinite(monto)) return '0.00';
    return new Intl.NumberFormat('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(monto);
  };

  const formatPercent = (numerador, denominador) => {
    const base = Number(denominador ?? 0);
    const num = Number(numerador ?? 0);
    if (!Number.isFinite(base) || base === 0) return '0%';
    const resultado = (num / Math.abs(base)) * 100;
    return `${resultado.toFixed(0)}%`;
  };

  const tablaBody = document.getElementById('tablaCuentasBody');
  const yearSelect = document.getElementById('resumenYearSelect');
  const monthSelect = document.getElementById('resumenMonthSelect');
  const yearLabel = document.getElementById('yearLabel');
  const empresaLabel = document.getElementById('empresaLabel');
  const obtenerCapituloEmpresa = (empresaId) =>
    window.CapitulosModulos?.obtenerCapituloPorEmpresa?.(empresaId) || null;
  const obtenerEtiquetaEmpresa = (empresaId) =>
    window.CapitulosModulos?.EMPRESA_CONFIG?.[empresaId]?.etiqueta || '';
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
      const anios = (data.anios || []).filter((a) => Number.isInteger(a)).sort((a, b) => b - a);

      yearSelect.innerHTML = '';
      if (!anios.length) {
        const option = document.createElement('option');
        option.value = '';
        option.textContent = 'Sin años disponibles';
        yearSelect.appendChild(option);
        return [];
      }

      anios.forEach((ano) => {
        const option = document.createElement('option');
        option.value = ano;
        option.textContent = ano;
        yearSelect.appendChild(option);
      });

      yearSelect.value = anios[0];

      return anios;
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

  const actualizarEtiquetasAnio = (anio) => {
    const yearAct = document.querySelectorAll('.year-act');
    const yearPrev = document.querySelectorAll('.year-prev');
    yearAct.forEach((el) => (el.textContent = anio));
    yearPrev.forEach((el) => (el.textContent = anio - 1));
    if (yearLabel) {
      yearLabel.textContent = anio;
    }
  };

  const actualizarEncabezado = (empresaId, anio) => {
    if (yearLabel && Number.isInteger(anio)) {
      yearLabel.textContent = anio;
    }
    const etiqueta = obtenerCapituloEmpresa(empresaId) || obtenerEtiquetaEmpresa(empresaId);
    if (empresaLabel) {
      empresaLabel.textContent = etiqueta || '';
    }
  };

  const renderTable = (nodos = [], anioActual) => {
    if (!tablaBody) return;
    if (!nodos.length) {
      setStatusRow('No hay datos disponibles para este año.');
      return;
    }
    tablaBody.innerHTML = '';
    nodos.forEach((nodo) => {
      const header = document.createElement('tr');
      header.className = 'section-header-row';
      header.dataset.section = nodo.key;
      header.innerHTML = `<td colspan="7">${nodo.label}</td>`;
      tablaBody.appendChild(header);

      (nodo.children || []).forEach((seccion) => {
        const totalesRow = document.createElement('tr');
        totalesRow.className = 'sum-row data-row';
        totalesRow.dataset.section = nodo.key;
        const variacionPlan = formatPercent(seccion.totalActualMonth - seccion.totalPlanMonth, seccion.totalPlanMonth);
        const variacionPrev = formatPercent(seccion.totalActualMonth - seccion.totalPrevMonth, seccion.totalPrevMonth);
        totalesRow.innerHTML = `
          <td>${seccion.label}</td>
          <td>Total sección</td>
          <td class="text-end">${formatNumber(seccion.totalActualMonth)}</td>
          <td class="text-end">${formatNumber(seccion.totalPlanMonth)}</td>
          <td class="text-end">${formatNumber(seccion.totalPrevMonth)}</td>
          <td class="text-end">${variacionPlan}</td>
          <td class="text-end">${variacionPrev}</td>
        `;
        tablaBody.appendChild(totalesRow);

        (seccion.cuentas || []).forEach((cuenta) => {
          const variacionCuentaPlan = formatPercent(cuenta.actualMonth - cuenta.planMonth, cuenta.planMonth);
          const variacionCuentaPrev = formatPercent(cuenta.actualMonth - cuenta.prevMonth, cuenta.prevMonth);
          const row = document.createElement('tr');
          row.className = 'data-row';
          row.dataset.section = nodo.key;
          row.innerHTML = `
            <td>${cuenta.cuenta}</td>
            <td>${cuenta.descripcion || ''}</td>
            <td class="text-end">${formatNumber(cuenta.actualMonth)}</td>
            <td class="text-end">${formatNumber(cuenta.planMonth)}</td>
            <td class="text-end">${formatNumber(cuenta.prevMonth)}</td>
            <td class="text-end">${variacionCuentaPlan}</td>
            <td class="text-end">${variacionCuentaPrev}</td>
          `;
          tablaBody.appendChild(row);
        });
      });
    });

    if (anioActual) {
      actualizarEtiquetasAnio(anioActual);
    }
  };

  const filterRows = (termino) => {
    if (!tablaBody) return;
    const text = (termino || '').toLowerCase();
    const datarows = Array.from(tablaBody.querySelectorAll('tr.data-row'));
    datarows.forEach((fila) => {
      const contenido = (fila.textContent || '').toLowerCase();
      fila.classList.toggle('d-none', text && !contenido.includes(text));
    });
    const headers = Array.from(tablaBody.querySelectorAll('tr.section-header-row'));
    headers.forEach((encabezado) => encabezado.classList.remove('d-none'));
  };

  const fetchResumen = async (empresaId, anio, mes) => {
    if (!empresaId || !anio) return;
    setStatusRow('Cargando resumen financiero...');
    try {
      const params = new URLSearchParams({ empresaId: empresaId, anio: Number(anio) });
      if (Number.isInteger(mes)) {
        params.set('mes', String(mes));
      }
      const capitulo = obtenerCapituloEmpresa(empresaId);
      if (capitulo) params.set('capitulo', capitulo);
      const respuesta = await fetch(`${API_ENDPOINT}?${params.toString()}`, {
        headers: Sesion.headersAutenticacion()
      });
      if (!respuesta.ok) {
        throw new Error('No fue posible obtener el resumen.');
      }
      const datos = await respuesta.json();
      renderTable(datos.resumen || [], Number(anio));
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
    const anios = await cargarAniosDisponibles(empresa.id);

    const valorInicial = Number(yearSelect?.value) || anios[0] || new Date().getFullYear();
    const mesInicial = Number(monthSelect?.value) || new Date().getMonth() + 1;
    actualizarEncabezado(empresa.id, valorInicial);
    window.dispatchEvent(
      new CustomEvent('planeacion:contexto-actualizado', {
        detail: { empresaId: empresa.id, anio: valorInicial, modulo: document.body.dataset.modulo || 'resumen' }
      })
    );
    fetchResumen(empresa.id, valorInicial, mesInicial);
    if (yearSelect) {
      yearSelect.addEventListener('change', () => {
        const anio = Number(yearSelect.value) || new Date().getFullYear();
        const mes = Number(monthSelect?.value) || mesInicial;
        actualizarEncabezado(empresa.id, anio);
        window.dispatchEvent(
          new CustomEvent('planeacion:contexto-actualizado', {
            detail: { empresaId: empresa.id, anio, modulo: document.body.dataset.modulo || 'resumen' }
          })
        );
        fetchResumen(empresa.id, anio, mes);
      });
    }
    if (monthSelect) {
      monthSelect.addEventListener('change', () => {
        const anio = Number(yearSelect?.value) || valorInicial;
        const mes = Number(monthSelect.value) || mesInicial;
        actualizarEncabezado(empresa.id, anio);
        window.dispatchEvent(
          new CustomEvent('planeacion:contexto-actualizado', {
            detail: { empresaId: empresa.id, anio, modulo: document.body.dataset.modulo || 'resumen' }
          })
        );
        fetchResumen(empresa.id, anio, mes);
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
