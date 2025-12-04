(() => {
  const base = window.location.protocol === 'file:' ? 'http://localhost:3000' : window.location.origin;
  const API_ENDPOINT = `${base}/api/reportes/resumen`;
  const API_ANIOS = `${base}/api/saldos/anios`;

  const formatNumber = (valor) => {
    const monto = Number(valor ?? 0);
    if (!Number.isFinite(monto)) return '0.00';
    return new Intl.NumberFormat('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(monto);
  };

  const formatPercentValue = (valor) => {
    if (!Number.isFinite(valor)) return '0.00%';
    return `${valor.toFixed(2)}%`;
  };

  const toNumber = (valor) => {
    const numero = Number(valor);
    return Number.isFinite(numero) ? numero : 0;
  };

  const calculateVar = (actual, base) => {
    const actualNum = toNumber(actual);
    const baseNum = toNumber(base);
    if (Math.abs(baseNum) === 0) return 0;
    return ((actualNum - baseNum) / Math.abs(baseNum)) * 100;
  };

  const parseNumber = (texto) => {
    const limpio = String(texto || '').replace(/[^0-9,.-]/g, '').replace(/,/g, '');
    const numero = Number(limpio);
    return Number.isFinite(numero) ? numero : 0;
  };

  const tablaBody = document.getElementById('tablaCuentasBody');
  const yearSelect = document.getElementById('resumenYearSelect');
  const monthSelect = document.getElementById('resumenMonthSelect');
  const yearLabel = document.getElementById('yearLabel');
  const empresaLabel = document.getElementById('empresaLabel');
  const searchInput = document.getElementById('accountSearch');
  const toggleBtn = document.getElementById('toggleAccountsBtn');

  const obtenerCapituloEmpresa = (empresaId) => window.CapitulosModulos?.obtenerCapituloPorEmpresa?.(empresaId) || null;
  const obtenerEtiquetaEmpresa = (empresaId) => window.CapitulosModulos?.EMPRESA_CONFIG?.[empresaId]?.etiqueta || '';

  const leerAnioSeleccionado = () => Number(yearSelect?.value) || new Date().getFullYear();
  const leerMesSeleccionado = () => Number(monthSelect?.value) || new Date().getMonth() + 1;

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

  const SECTION_PRIORITY = [
    'MEMBERSHIP',
    'EVENTS',
    'COMMITTEES',
    'SERVICES TO MEMBERS',
    'GUADALAJARA',
    'MONTERREY',
    'NORTHWEST',
    'ADMIN',
    'OTHER'
  ];

  const SECTION_DEFAULT_ORDER = SECTION_PRIORITY.length;
  const normalizeText = (texto) => (texto || '').toString().normalize('NFD').replace(/\p{Diacritic}/gu, '').toUpperCase();
  const sectionPriority = (label) => {
    const text = normalizeText(label);
    for (let idx = 0; idx < SECTION_PRIORITY.length; idx += 1) {
      if (text.includes(SECTION_PRIORITY[idx])) {
        return idx;
      }
    }
    return SECTION_DEFAULT_ORDER;
  };

  const PRINCIPAL_PRIORITY = ['INCOME', 'EXPENSE', 'OPERATING', 'OTHER'];
  const principalPriority = (label) => {
    const text = normalizeText(label);
    for (let idx = 0; idx < PRINCIPAL_PRIORITY.length; idx += 1) {
      if (text.includes(PRINCIPAL_PRIORITY[idx])) {
        return idx;
      }
    }
    return PRINCIPAL_PRIORITY.length;
  };

  const COLUMN_TOOLTIPS = {
    actualMonth: 'Real del mes consultado según el layout RESUMEN.',
    planMonth: 'Presupuesto del mes (columna PRESUPXX).',
    prevMonth: 'Real del mismo mes pero del año anterior.',
    varMonthPlan: 'Variación mensual vs plan: ((Real - Plan) / |Plan|) × 100.',
    varMonthPrev: 'Variación mensual interanual: ((Real - Real año anterior) / |Real año anterior|) × 100.'
  };

  const ROW_TOOLTIPS = {
    account: 'Cuenta individual del catálogo RESUMEN. La descripción es libre y no se guarda en Firebird.',
    section: 'Total de sección mostrado en el Excel (“sum-row”).',
    principal: 'Subtotal del bloque principal (Income, Expense, Operating, etc.).',
    group: 'Fila consolidada (CONSOLIDATED INCOME/EXPENSES u Operating Results).',
    result: 'Operating/Net Results definidos en “SUMA DE VARIAS SECCIONES”.'
  };

  const tooltipAttr = (key) => (key && COLUMN_TOOLTIPS[key]
    ? ` title="${COLUMN_TOOLTIPS[key].replace(/"/g, '&quot;')}" data-bs-toggle="tooltip"`
    : '');
  const rowTooltipAttr = (role) => (role ? ` data-row-role="${role}"` : '');

  const disposeTooltips = () => {
    if (!window.bootstrap?.Tooltip) return;
    document.querySelectorAll('[data-bs-toggle="tooltip"]').forEach((el) => {
      const instance = window.bootstrap.Tooltip.getInstance(el);
      if (instance) instance.dispose();
    });
  };

  const activateTooltips = () => {
    if (!window.bootstrap?.Tooltip) return;
    document.querySelectorAll('[data-bs-toggle="tooltip"]').forEach((el) => {
      window.bootstrap.Tooltip.getOrCreateInstance(el);
    });
  };

  const cambiosPendientes = new Map();
  let editMode = false;
  let empresaActual = null;
  let mesClaveActual = 'dic';

  const limpiarCambios = () => {
    cambiosPendientes.clear();
  };

  const claveCambio = (cuenta, columna) => `${cuenta}|${columna}`;

  const registrarCambio = (cuenta, columna, valor, original) => {
    if (!cuenta || !columna) return;
    cambiosPendientes.set(claveCambio(cuenta, columna), { cuenta, columna, valor, original });
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

    const presupuesto = Array.from(porCuenta.entries()).map(([cuenta, valores]) => ({ cuenta, valores }));
    return { presupuesto, hayCambios: presupuesto.length > 0 };
  };

  const notificarCambios = () => {
    const detalle = { ...obtenerCambiosPendientes(), borradorGuardado: false };
    window.dispatchEvent(new CustomEvent('modulo-planeacion:presupuesto-editado', { detail: detalle }));
  };

  const sincronizarCeldasEditables = () => {
    if (!tablaBody) return;
    const celdas = Array.from(tablaBody.querySelectorAll('.editable-cell'));
    celdas.forEach((celda) => {
      celda.removeEventListener('blur', manejarBlurCelda);
      if (editMode) {
        celda.contentEditable = 'true';
        celda.addEventListener('blur', manejarBlurCelda);
      } else {
        celda.contentEditable = 'false';
      }
    });
  };

  const restaurarValoresOriginales = () => {
    if (!tablaBody) return;
    Array.from(tablaBody.querySelectorAll('.editable-cell')).forEach((celda) => {
      const original = Number(celda.dataset.valorOriginal ?? 0);
      celda.textContent = formatNumber(original);
    });
  };

  const cancelarEdicion = () => {
    restaurarValoresOriginales();
    limpiarCambios();
    editMode = false;
    sincronizarCeldasEditables();
    notificarCambios();
  };

  const establecerModoEdicion = (flag) => {
    const habilitar = Boolean(flag);
    if (habilitar) {
      if (editMode) return;
      editMode = true;
      sincronizarCeldasEditables();
    } else if (editMode) {
      cancelarEdicion();
    }
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

  window.CuentasModulo = window.CuentasModulo || {};
  window.CuentasModulo.cancelEdit = cancelarEdicion;
  window.CuentasModulo.getCambios = obtenerCambiosPendientes;
  window.CuentasModulo.setEditMode = establecerModoEdicion;

  const createCell = (val, { rowRole = '', classes = '' } = {}) => {
    const classList = ['text-end'];
    if (classes) classList.push(classes);
    return `<td class="${classList.join(' ')}"${rowTooltipAttr(rowRole)}>${formatNumber(val)}</td>`;
  };

  const createPercentCell = (val, rowRole = '') => `<td class="text-end"${rowTooltipAttr(rowRole)}>${formatPercentValue(val)}</td>`;

  const createEditableCell = (val, { columnKey = '', rowRole = '' } = {}) => {
    const attrs = [
      'class="text-end editable-cell"',
      `data-valor-original="${Number(val ?? 0)}"`
    ];
    if (columnKey) {
      attrs.push(`data-columna-clave="${columnKey}"`);
    }
    return `<td ${attrs.join(' ')}${tooltipAttr('planMonth')}${rowTooltipAttr(rowRole)}>${formatNumber(val)}</td>`;
  };

  const createResumenTotalsRow = (nodo, options = {}) => {
    const { label = '', rowRole = 'section', rowClass = '' } = options;
    const totals = {
      actualMonth: toNumber(nodo.actualMonth ?? nodo.totalActualMonth),
      planMonth: toNumber(nodo.planMonth ?? nodo.totalPlanMonth),
      prevMonth: toNumber(nodo.prevMonth ?? nodo.totalPrevMonth)
    };
    const varPlan = calculateVar(totals.actualMonth, totals.planMonth);
    const varPrev = calculateVar(totals.actualMonth, totals.prevMonth);
    const row = document.createElement('tr');
    row.className = rowClass;
    row.dataset.rowRole = rowRole;
    if (ROW_TOOLTIPS[rowRole]) {
      row.setAttribute('title', ROW_TOOLTIPS[rowRole]);
      row.setAttribute('data-bs-toggle', 'tooltip');
    }
    row.innerHTML = `
      <td></td>
      <td class="text-start fw-semibold">${label}</td>
      ${createCell(totals.actualMonth, { rowRole })}
      ${createCell(totals.planMonth, { rowRole })}
      ${createCell(totals.prevMonth, { rowRole })}
      ${createPercentCell(varPlan, rowRole)}
      ${createPercentCell(varPrev, rowRole)}
    `;
    return row;
  };

  const actualizarMesContexto = (mesSeleccionado) => {
    const info = MESES.find((item) => item.periodo === Number(mesSeleccionado));
    if (info) {
      mesClaveActual = info.clave;
    }
  };

  const disposeStatus = () => {
    if (!tablaBody) return;
    const estado = tablaBody.querySelector('.estado-tabla');
    if (estado) estado.remove();
  };

  const setStatusRow = (mensaje) => {
    if (!tablaBody) return;
    disposeTooltips();
    tablaBody.innerHTML = `<tr class="estado-tabla"><td colspan="7">${mensaje}</td></tr>`;
  };

  const sortSections = (secciones = []) => {
    return (Array.isArray(secciones) ? secciones : []).slice().sort((a, b) => {
      if (Number.isFinite(a?.orden) || Number.isFinite(b?.orden)) {
        const ordenA = Number.isFinite(a?.orden) ? a.orden : Number.POSITIVE_INFINITY;
        const ordenB = Number.isFinite(b?.orden) ? b.orden : Number.POSITIVE_INFINITY;
        if (ordenA !== ordenB) return ordenA - ordenB;
      }
      const orden = sectionPriority(a.label) - sectionPriority(b.label);
      if (orden !== 0) return orden;
      return normalizeText(a.label).localeCompare(normalizeText(b.label));
    });
  };

  const sortPrincipals = (principales = []) => {
    return (Array.isArray(principales) ? principales : []).slice().sort((a, b) => {
      if (Number.isFinite(a?.orden) || Number.isFinite(b?.orden)) {
        const ordenA = Number.isFinite(a?.orden) ? a.orden : Number.POSITIVE_INFINITY;
        const ordenB = Number.isFinite(b?.orden) ? b.orden : Number.POSITIVE_INFINITY;
        if (ordenA !== ordenB) return ordenA - ordenB;
      }
      const orden = principalPriority(a.label) - principalPriority(b.label);
      if (orden !== 0) return orden;
      return normalizeText(a.label).localeCompare(normalizeText(b.label));
    });
  };

  const renderResumen = (resumen = [], mesSeleccionado) => {
    if (!tablaBody) return;
    limpiarCambios();
    editMode = false;
    disposeTooltips();
    tablaBody.innerHTML = '';

    if (!resumen.length) {
      setStatusRow('Sin datos disponibles para este periodo.');
      return;
    }

    const mesInfo = MESES.find((item) => item.periodo === Number(mesSeleccionado));
    const claveMes = mesInfo?.clave || mesClaveActual;
    const planColumnKey = `budget-${claveMes}`;

    resumen.forEach((capitulo) => {
      const layout = Array.isArray(capitulo.layout) ? capitulo.layout.slice().sort((a, b) => (a.order || 0) - (b.order || 0)) : null;
      const principales = Array.isArray(capitulo.children) ? capitulo.children.slice() : [];
      const principalLookup = new Map(principales.map((principal) => [principal.label, principal]));

      const renderPrincipal = (principal) => {
        if (!principal) return;
        const seccionesOrdenadas = sortSections(principal.children || []);

        seccionesOrdenadas.forEach((seccion) => {
          (seccion.cuentas || []).forEach((cta) => {
            const varPlan = calculateVar(cta.actualMonth, cta.planMonth);
            const varPrev = calculateVar(cta.actualMonth, cta.prevMonth);
            const row = document.createElement('tr');
            row.className = 'data-row';
            row.dataset.cuenta = cta.cuentaCanonica || cta.cuenta || '';
            row.dataset.rowRole = 'account';
            row.innerHTML = `
              <td class="font-monospace small">${cta.cuenta || ''}</td>
              <td class="text-start">${cta.descripcion || ''}</td>
              ${createCell(cta.actualMonth, { rowRole: 'account' })}
              ${createEditableCell(cta.planMonth, { columnKey: planColumnKey, rowRole: 'account' })}
              ${createCell(cta.prevMonth, { rowRole: 'account' })}
              ${createPercentCell(varPlan, 'account')}
              ${createPercentCell(varPrev, 'account')}
            `;
            tablaBody.appendChild(row);
          });

          tablaBody.appendChild(createResumenTotalsRow(seccion, {
            label: seccion.label || '',
            rowRole: 'section',
            rowClass: 'sum-row fw-semibold'
          }));
        });

        tablaBody.appendChild(createResumenTotalsRow(principal, {
          label: principal.label || '',
          rowRole: 'principal',
          rowClass: 'section-header-row table-light fw-bold'
        }));
      };

      if (layout && layout.length) {
        layout.forEach((block) => {
          if (block.type === 'group') {
            (block.principals || []).forEach((label) => {
              renderPrincipal(principalLookup.get(label));
            });
            tablaBody.appendChild(createResumenTotalsRow(block.totals || {}, {
              label: block.label || '',
              rowRole: 'group',
              rowClass: 'fw-bold text-uppercase'
            }));
          } else {
            const role = block.type || 'result';
            tablaBody.appendChild(createResumenTotalsRow(block.totals || {}, {
              label: block.label || '',
              rowRole: role,
              rowClass: role === 'final' ? 'highlight-bright text-white fw-bold' : 'highlight-secondary fw-bold'
            }));
          }
        });
      } else {
        sortPrincipals(principales).forEach(renderPrincipal);
      }
    });

    sincronizarCeldasEditables();
    activateTooltips();
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

  const obtenerSelectorEmpresaGlobal = () => window.parent?.document?.getElementById('companyFilter') || null;
  const sincronizarSelectorEmpresaGlobal = () => {
    const selector = obtenerSelectorEmpresaGlobal();
    if (!selector) return;
    selector.addEventListener('change', async () => {
      const nuevoId = selector.value;
      if (!nuevoId) return;
      const empresaLocal = Sesion.obtenerEmpresaActiva();
      if (empresaLocal?.id === nuevoId) return;
      Sesion.establecerEmpresaActiva(nuevoId);
      empresaActual = Sesion.obtenerEmpresaActiva();
      await aplicarEmpresaResumen(empresaActual?.id);
    });
  };

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
      yearSelect.disabled = false;

      return anios;
    } catch (error) {
      console.error('Error cargando años:', error);
      yearSelect.innerHTML = '<option value="">Error cargando años</option>';
      yearSelect.disabled = true;
      return [];
    }
  };

  const fetchResumen = async (empresaId, anio, mes) => {
    if (!empresaId || !anio) return;
    setStatusRow('Cargando resumen financiero...');
    actualizarMesContexto(mes);
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
      renderResumen(datos.resumen || [], mes);
      actualizarEtiquetasAnio(Number(anio));
      disposeStatus();
    } catch (error) {
      console.error('Error resumen:', error);
      setStatusRow(error.message || 'No fue posible cargar el resumen.');
    }
  };

  const aplicarEmpresaResumen = async (empresaId) => {
    if (!empresaId) return;
    const anios = await cargarAniosDisponibles(empresaId);
    const valorInicial = Number(yearSelect?.value) || anios[0] || new Date().getFullYear();
    const mesInicial = Number(monthSelect?.value) || new Date().getMonth() + 1;
    if (yearSelect) yearSelect.value = String(valorInicial);
    if (monthSelect) monthSelect.value = String(mesInicial);
    actualizarEncabezado(empresaId, valorInicial);
    window.dispatchEvent(new CustomEvent('planeacion:contexto-actualizado', {
      detail: { empresaId, anio: valorInicial, modulo: document.body.dataset.modulo || 'resumen' }
    }));
    await fetchResumen(empresaId, valorInicial, mesInicial);
  };

  const filterRows = (termino) => {
    if (!tablaBody) return;
    const texto = (termino || '').toLowerCase();
    const filas = Array.from(tablaBody.querySelectorAll('tr'));
    filas.forEach((fila) => {
      const contenido = (fila.textContent || '').toLowerCase();
      fila.classList.toggle('d-none', texto && !contenido.includes(texto));
    });
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
      } else {
        toggleBtn.textContent = oculto ? 'Mostrar cuentas' : 'Ocultar cuentas';
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

    empresaActual = empresa;
    await aplicarEmpresaResumen(empresaActual.id);

    sincronizarSelectorEmpresaGlobal();

    const handleYearChange = () => {
      const anio = leerAnioSeleccionado();
      const mes = leerMesSeleccionado();
      if (!empresaActual?.id) return;
      actualizarEncabezado(empresaActual.id, anio);
      window.dispatchEvent(new CustomEvent('planeacion:contexto-actualizado', {
        detail: { empresaId: empresaActual.id, anio, modulo: document.body.dataset.modulo || 'resumen' }
      }));
      fetchResumen(empresaActual.id, anio, mes);
    };

    const handleMonthChange = () => {
      const anio = leerAnioSeleccionado();
      const mes = leerMesSeleccionado();
      actualizarMesContexto(mes);
      if (!empresaActual?.id) return;
      actualizarEncabezado(empresaActual.id, anio);
      window.dispatchEvent(new CustomEvent('planeacion:contexto-actualizado', {
        detail: { empresaId: empresaActual.id, anio, modulo: document.body.dataset.modulo || 'resumen' }
      }));
      fetchResumen(empresaActual.id, anio, mes);
    };

    if (yearSelect) {
      yearSelect.addEventListener('change', handleYearChange);
    }
    if (monthSelect) {
      monthSelect.addEventListener('change', handleMonthChange);
    }
    if (searchInput) {
      searchInput.addEventListener('input', (event) => {
        filterRows(event.target.value);
      });
    }
    initToggleColumns();

    window.addEventListener(Sesion.EVENTO_EMPRESA, async (event) => {
      const nuevaEmpresa = event?.detail?.empresa;
      if (!nuevaEmpresa?.id) return;
      empresaActual = nuevaEmpresa;
      await aplicarEmpresaResumen(empresaActual.id);
    });
  });
})();
