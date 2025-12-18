(() => {
  const base = window.location.protocol === 'file:' ? 'http://localhost:3005' : window.location.origin;
  const API_ENDPOINT = `${base}/api/reportes/resumen`;
  const API_ANIOS = `${base}/api/saldos/anios`;

  const formatNumber = (valor) => {
    const monto = Number(valor ?? 0);
    if (!Number.isFinite(monto)) return '0.00';
    return new Intl.NumberFormat('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(monto);
  };

  const formatPercentValue = (valor) => {
    if (!Number.isFinite(valor)) return '0.00 %';
    return `${valor.toFixed(2)} %`;
  };

  const toNumber = (valor) => {
    const numero = Number(valor);
    return Number.isFinite(numero) ? numero : 0;
  };

  /**
   * Calcula porcentaje de variación según fórmula Excel
   * Fórmula: (real / base - 1) * 100
   * 
   * Ejemplos:
   * - Real: 100, Base: 100 → (100/100 - 1) * 100 = 0%
   * - Real: 110, Base: 100 → (110/100 - 1) * 100 = 10%
   * - Real: 90, Base: 100 → (90/100 - 1) * 100 = -10%
   * - Real: 100, Base: 0 → 0% (división por cero)
   */
  const calculateVar = (actual, base) => {
    const actualNum = toNumber(actual);
    const baseNum = toNumber(base);
    
    // División por cero o base inválida → 0%
    if (baseNum === 0 || baseNum == null || Number.isNaN(baseNum)) return 0;
    if (!Number.isFinite(baseNum) || Math.abs(baseNum) === 0) return 0;
    
    const division = actualNum / baseNum;
    
    // Si división da resultado inválido, retornar 0%
    if (!Number.isFinite(division) || division === 0) return 0;
    
    // Fórmula Excel: (real / base - 1) * 100
    const porcentaje = (division - 1) * 100;
    
    return Number.isFinite(porcentaje) ? porcentaje : 0;
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
  const periodLabel = document.getElementById('periodLabel');
  const empresaLabel = document.getElementById('empresaLabel');
  const searchInput = document.getElementById('accountSearch');

  const manejarSesionExpirada = (resp) => {
    if (resp?.status === 401) {
      // Usar Sesion.cerrar() que maneja correctamente la redirección desde iframes
      try { Sesion.cerrar(); } catch (_) { /* ignore */ }
      return true;
    }
    return false;
  };
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

  const parseText = (texto) => (texto || '').toString().trim();

  const COLUMN_TOOLTIPS = {
    actualMonth: 'Real del mes consultado segun el layout RESUMEN. Se alimenta de los saldos reales del servicio de planeacion para las cuentas mapeadas en "CUENTAS SUMMARY Y RESUMEN.xlsx".',
    planMonth: 'Presupuesto del mes (PRESUP01..12 de la tabla PRESUPYY) para las cuentas del bloque seleccionado.',
    prevMonth: 'Real del mes anterior del mismo ejercicio; compara contra el periodo inmediato anterior.',
    varMonthPlan: 'Variacion mensual vs plan: ((Real / Plan) - 1) * 100 con los valores de la fila. Ejemplo: Real=110, Plan=100 → 10%',
    varMonthPrev: 'Variacion mensual vs mes anterior: ((Real / Real mes anterior) - 1) * 100. Ejemplo: Real=110, Previo=100 → 10%'
  };

  const ROW_TOOLTIPS = {
    account: 'Cuenta individual del catalogo RESUMEN. Real y presupuesto provienen de los mismos origenes que SUMMARY; la descripcion libre no se guarda en Firebird.',
    section: 'Total de seccion ("sum-row" del Excel). Suma todas las cuentas hijas antes de presentar el bloque principal.',
    principal: 'Subtotal del bloque principal (Income, Expense, Operating, etc.) definido en el libro maestro.',
    group: 'Fila consolidada (CONSOLIDATED INCOME/EXPENSES u Operating Results) que agrupa varios principales.',
    result: 'Operating/Net Results definidos en "SUMA DE VARIAS SECCIONES"; combinan ingresos, gastos y otros ajustes segun el mapeo.'
  };

  const collapsedSections = new Set();
  let allCollapsed = false;
  const collapseButtons = Array.from(document.querySelectorAll('#collapseAllBtn, #collapseAllBtnSecondary'));
  const expandButtons = Array.from(document.querySelectorAll('#expandAllBtn, #expandAllBtnSecondary'));

  const obtenerNombreSeccion = (row) => (row?.dataset?.sectionName || '').trim();

  function setSectionCollapseState(row, collapsed) {
    if (!row) return;
    const sectionName = obtenerNombreSeccion(row);
    if (!sectionName) return;

    const icono = row.querySelector('.collapse-icon');
    if (collapsed) {
      collapsedSections.add(sectionName);
      if (icono) {
        icono.className = 'bi bi-chevron-right collapse-icon me-2';
      }
    } else {
      collapsedSections.delete(sectionName);
      if (icono) {
        icono.className = 'bi bi-chevron-down collapse-icon me-2';
      }
    }

    let siguiente = row.nextElementSibling;
    const esCorte = (r) => {
      if (!r) return true;
      if (r.classList.contains('collapsible-section')) return true;
      const rol = (r.dataset?.rowRole || '').toLowerCase();
      return ['principal', 'group', 'result', 'net', 'final'].includes(rol);
    };
    while (siguiente && !esCorte(siguiente)) {
      siguiente.style.display = collapsed ? 'none' : '';
      siguiente = siguiente.nextElementSibling;
    }
  }

  function syncCollapseAllState() {
    const allSections = document.querySelectorAll('.collapsible-section');
    if (!allSections.length) {
      allCollapsed = false;
      return;
    }
    const totalCollapsed = Array.from(allSections).filter((row) => collapsedSections.has(obtenerNombreSeccion(row))).length;
    allCollapsed = totalCollapsed === allSections.length;
  }

  function autoCollapseExcludedSections() {
    const filas = document.querySelectorAll('.collapsible-section.excluded-expense');
    if (!filas.length) {
      syncCollapseAllState();
      return;
    }
    filas.forEach((row) => setSectionCollapseState(row, true));
    syncCollapseAllState();
  }

  function habilitarColapsoGastosAdministrativos() {
    const filas = tablaBody?.querySelectorAll('tr') || [];
    filas.forEach((row) => {
      const descripcionCell = row.cells && row.cells[6];
      const texto = (row.dataset?.sectionName || descripcionCell?.textContent || '').trim();
      if (!texto || !/GASTOS\s+ADMINISTRATIVOS/i.test(texto)) return;

      row.dataset.sectionName = texto;
      if (!row.classList.contains('collapsible-section')) {
        row.classList.add('collapsible-section');
      }
      if (descripcionCell && !row.querySelector('.collapse-icon')) {
        descripcionCell.innerHTML = '';
        const icon = document.createElement('i');
        icon.className = 'bi bi-chevron-down collapse-icon me-2';
        icon.style.cursor = 'pointer';
        descripcionCell.style.cursor = 'pointer';
        descripcionCell.appendChild(icon);
        descripcionCell.appendChild(document.createTextNode(texto));
      }
      if (collapsedSections.has(texto)) {
        setSectionCollapseState(row, true);
      }
    });
    syncCollapseAllState();
  }

  const escapeAttr = (texto = '') => texto.toString().replace(/"/g, '&quot;');

  const formatList = (lista = [], limite = 5) => {
    const valores = (Array.isArray(lista) ? lista : [])
      .map((item) => (item || '').toString().trim())
      .filter(Boolean);
    if (!valores.length) return '';
    if (valores.length <= limite) {
      return valores.join(', ');
    }
    return `${valores.slice(0, limite).join(', ')} y ${valores.length - limite} mas`;
  };

  const describirFactor = (factor) => {
    const numero = Number.isFinite(Number(factor)) ? Number(factor) : 1;
    if (numero === 1) return 'Suma';
    if (numero === -1) return 'Resta';
    if (numero === 0.5) return 'Divide entre 2';
    if (numero === 2) return 'Duplica';
    if (numero === 0) return 'Ignora';
    return numero > 0 ? `Escala x${numero}` : `Escala x${numero}`;
  };

  const describirOperaciones = (operaciones = []) => {
    const fragmentos = (Array.isArray(operaciones) ? operaciones : [])
      .filter((op) => op && op.principal)
      .map((op) => {
        const accion = describirFactor(op.factor);
        const secciones = formatList(op.sections || [], 4);
        return `${accion} ${op.principal}${secciones ? ` (secciones: ${secciones})` : ''}`;
      });
    return fragmentos.join('; ');
  };

  const buildRowContextTooltip = (role, context = {}) => {
    switch (role) {
      case 'section': {
        const cuentas = Array.isArray(context.cuentas) ? context.cuentas : [];
        const nombres = cuentas
          .map((cta) => cta.descripcion || cta.cuenta || cta.cuentaCanonica || '')
          .filter(Boolean);
        const listado = formatList(nombres, 4);
        const principal = context.principal ? ` del principal "${context.principal}"` : '';
        return `Seccion "${context.label || ''}"${principal} acumula reales (servicio de planeacion) y presupuestos (PRESUPYY) de ${cuentas.length} cuentas${listado ? ` (${listado})` : ''}.`;
      }
      case 'principal': {
        const secciones = formatList(context.sections || [], 5);
        const signo = Number(context.sign) < 0 ? 'resta (gastos)' : 'suma (ingresos)';
        return `Principal "${context.label || ''}" ${signo} los totales de las secciones ${secciones || 'definidas en el capitulo'} antes de consolidarse.`;
      }
      case 'group': {
        const detalle = describirOperaciones(context.operaciones || []);
        if (detalle) {
          return `Grupo "${context.label || ''}" consolida los principales indicados: ${detalle}.`;
        }
        const lista = formatList(context.principals || [], 6);
        return `Grupo "${context.label || ''}" consolida los principales ${lista || ''} mediante sumatoria directa.`;
      }
      case 'result':
        return describirOperaciones(context.operaciones || []) || ROW_TOOLTIPS.result;
      default:
        return ROW_TOOLTIPS[role] || '';
    }
  };

  const resumenTooltipAttr = (key) => (key && COLUMN_TOOLTIPS[key]
    ? ` title="${escapeAttr(COLUMN_TOOLTIPS[key])}" data-bs-toggle="tooltip"`
    : '');
  const resumenRowTooltipAttr = (role) => (role ? ` data-row-role="${role}"` : '');

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
  const resumenLayoutCache = new Map();

  const clonarLayout = (layout) => JSON.parse(JSON.stringify(layout || []));

  const obtenerClaveLayoutCache = (empresaId, anio) => {
    const empresa = empresaId || 'sin-empresa';
    const ejercicio = Number.isFinite(Number(anio)) ? Number(anio) : 'sin-anio';
    return `${empresa}:${ejercicio}`;
  };

  const aplicarLayoutPersistente = (empresaId, anio, resumen = []) => {
    if (!empresaId || !Number.isFinite(Number(anio)) || !Array.isArray(resumen)) {
      return;
    }
    const cacheKey = obtenerClaveLayoutCache(empresaId, anio);
    let cache = resumenLayoutCache.get(cacheKey);
    if (!cache) {
      cache = new Map();
      resumenLayoutCache.set(cacheKey, cache);
    }
    resumen.forEach((capitulo) => {
      const capituloName = (capitulo.label || capitulo.capitulo || '').toString().trim().toUpperCase();
      if (!capitulo || typeof capitulo !== 'object') return;
      const nombreCapitulo = capitulo.capitulo || capitulo.nombre || capitulo.label;
      if (!nombreCapitulo) return;
      if (Array.isArray(capitulo.layout) && capitulo.layout.length) {
        cache.set(nombreCapitulo, clonarLayout(capitulo.layout));
      } else if (cache.has(nombreCapitulo)) {
        capitulo.layout = clonarLayout(cache.get(nombreCapitulo));
      }
    });
  };

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
    
    // ⚠️ NOTA: Como usamos ModoEdicionPresupuesto con soloLayout: true,
    // NO necesitamos contentEditable aquí - ModoEdicionPresupuesto maneja TODA la edición
    // (cuentas/descripciones con inputs manuales)
    
    // ELIMINADO: contentEditable que causaba conflictos con ModoEdicionPresupuesto
    // Ya no seteamos contentEditable porque ModoEdicionPresupuesto maneja los clicks
    
    console.log('✅ Resumen: ModoEdicionPresupuesto maneja edición (soloLayout)');
  };

  const restaurarValoresOriginales = () => {
    if (!tablaBody) return;
    Array.from(tablaBody.querySelectorAll('.editable-cell')).forEach((celda) => {
      const columna = celda.dataset.columnaClave;
      const esTexto = columna === 'cuenta' || columna === 'descripcion' || columna === 'nombre';
      const originalRaw = celda.dataset.valorOriginal ?? '';
      if (esTexto) {
        celda.textContent = parseText(originalRaw);
      } else {
        const original = Number(originalRaw ?? 0);
        celda.textContent = formatNumber(original);
      }
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
      if (window.ModoEdicionPresupuesto?.activar) {
        try { window.ModoEdicionPresupuesto.activar(); } catch (e) { /* ignore */ }
      }
    } else if (editMode) {
      cancelarEdicion();
      if (window.ModoEdicionPresupuesto?.desactivar) {
        try { window.ModoEdicionPresupuesto.desactivar(); } catch (e) { /* ignore */ }
      }
    }
  };

  const manejarBlurCelda = (event) => {
    const celda = event.currentTarget;
    const fila = celda.closest('tr');
    const cuenta = fila?.dataset.cuenta21 || fila?.dataset.cuenta;
    const columna = celda.dataset.columnaClave;
    if (!cuenta || !columna) return;

    const esTexto = columna === 'cuenta' || columna === 'descripcion' || columna === 'nombre';
    const originalRaw = celda.dataset.valorOriginal ?? '';

    if (esTexto) {
      const originalTexto = parseText(originalRaw);
      const nuevoTexto = parseText(celda.textContent);
      if (nuevoTexto !== originalTexto) {
        celda.textContent = nuevoTexto;
        registrarCambio(cuenta, columna, nuevoTexto, originalTexto);
        // Si se editó la cuenta, actualizar dataset en la fila para persistencia
        if (columna === 'cuenta' && fila) {
          fila.dataset.cuenta = nuevoTexto || '';
          fila.dataset.cuentaVisible = nuevoTexto || '';
        }
        // Si es columna de layout persistir layout local
        if ((columna === 'cuenta' || columna === 'descripcion') && window.ModoEdicionPresupuesto?.guardarLayout) {
          try { window.ModoEdicionPresupuesto.guardarLayout(); } catch (err) { /* ignore */ }
        }
      } else {
        celda.textContent = originalTexto;
        eliminarCambio(cuenta, columna);
      }
    } else {
      const original = Number(originalRaw ?? 0);
      const nuevoValor = parseNumber(celda.textContent);
      if (nuevoValor !== original) {
        celda.textContent = formatNumber(nuevoValor);
        registrarCambio(cuenta, columna, nuevoValor, original);
      } else {
        celda.textContent = formatNumber(original);
        eliminarCambio(cuenta, columna);
      }
    }

    notificarCambios();
  };

  window.CuentasModulo = window.CuentasModulo || {};
  window.CuentasModulo.cancelEdit = cancelarEdicion;
  window.CuentasModulo.getCambios = obtenerCambiosPendientes;
  window.CuentasModulo.setEditMode = establecerModoEdicion;
  window.CuentasModulo.guardarLayout = () => window.ModoEdicionPresupuesto?.guardarLayout?.() || false;
  window.CuentasModulo.cargarLayoutLocal = () => window.ModoEdicionPresupuesto?.cargarLayoutLocal?.() || null;
  window.CuentasModulo.aplicarLayoutLocal = (l) => window.ModoEdicionPresupuesto?.aplicarLayoutLocal?.(l) || false;

  /**
   * Crea una celda HTML <td> con valor numérico formateado para Resumen
   * 
   * Similar a la función de Summary pero adaptada a Resumen.
   * Genera celdas numéricas con formato de miles y decimales.
   * 
   * @param {number} val - Valor numérico a mostrar
   * @param {Object} options - Opciones
   * @param {string} options.rowRole - Rol de la fila (account, section, etc.)
   * @param {string} options.classes - Clases CSS adicionales
   * @param {string} options.tooltipKey - Clave del tooltip
   * @returns {string} HTML de la celda <td>
   */
  const createCell = (val, { rowRole = '', classes = '', tooltipKey = '' } = {}) => {
    const classList = ['text-end'];
    if (classes) classList.push(classes);
    return `<td class="${classList.join(' ')}"${resumenTooltipAttr(tooltipKey)}${resumenRowTooltipAttr(rowRole)}>${formatNumber(val)}</td>`;
  };

  /**
   * Crea una celda HTML <td> con valor porcentual formateado para Resumen
   * 
   * Genera celdas para las columnas de variaciones porcentuales.
   * Formato: "+5.2%" o "-3.8%" con color según signo.
   * 
   * @param {number} val - Valor decimal (ej: 0.052 para 5.2%)
   * @param {Object} options - Opciones
   * @param {string} options.rowRole - Rol de la fila
   * @param {string} options.tooltipKey - Clave del tooltip
   * @returns {string} HTML de la celda <td>
   */
  const createPercentCell = (val, { rowRole = '', tooltipKey = '' } = {}) => `<td class="text-end percent-cell"${resumenTooltipAttr(tooltipKey)}${resumenRowTooltipAttr(rowRole)}>${formatPercentValue(val)}</td>`;

  /**
   * Crea una celda HTML <td> editable o de solo lectura para Resumen
   * 
   * Igual que en Summary: SOLO cuenta y descripcion son editables.
   * Estos campos son visuales y no se guardan en Firebird.
   * 
   * @param {string|number} val - Valor a mostrar
   * @param {Object} options - Opciones
   * @param {string} options.columnKey - Clave de columna
   * @param {string} options.rowRole - Rol de la fila
   * @param {string} options.tooltipKey - Clave del tooltip
   * @param {boolean} options.text - Si true es texto, si false es número
   * @param {string} options.classes - Clases CSS adicionales
   * @returns {string} HTML de la celda <td>
   */
  const createEditableCell = (val, {
    columnKey = '',
    rowRole = '',
    tooltipKey = '',
    text = false,
    classes = ''
  } = {}) => {
    const esEditableReal = columnKey === 'cuenta' || columnKey === 'descripcion' || columnKey === 'nombre';
    const classList = ['editable-cell'];
    classList.push(text ? 'text-start' : 'text-end');
    if (esEditableReal) classList.push('editable-real'); else classList.push('read-only-cell');
    if (classes) classList.push(classes);
    const attrs = [
      `class="${classList.join(' ')}"`,
      `data-valor-original="${text ? escapeAttr(val ?? '') : Number(val ?? 0)}"`,
      `data-editable-real="${esEditableReal}"`
    ];
    if (columnKey) {
      attrs.push(`data-columna-clave="${columnKey}"`);
      attrs.push(`data-role="${columnKey}"`);
    }
    if (!esEditableReal && tooltipKey) {
      attrs.push(`title="Columna de solo lectura (${columnKey})"`);
      attrs.push(`data-bs-toggle="tooltip"`);
    }
    const contenido = text ? escapeAttr(val ?? '') : formatNumber(val);
    return `<td ${attrs.join(' ')}${resumenTooltipAttr(tooltipKey)}${resumenRowTooltipAttr(rowRole)}>${contenido}</td>`;
  };

  /**
   * Crea una fila de totales para el módulo Resumen
   * 
   * Similar a createTotalsRow de Summary, pero adaptada a la estructura
   * jerárquica de Resumen (Empresa → División → Comité → Cuenta).
   * 
   * Genera filas que muestran totales acumulados por nivel jerárquico,
   * por ejemplo: total de una división, total de un comité, etc.
   * 
   * Las 12 columnas son idénticas a Summary:
   * - Actual Month, Plan Month, Prev Month
   * - Var% Month Plan, Var% Month Prev
   * - Actual YTD, Plan YTD, Prev YTD
   * - Var% YTD Plan, Var% YTD Prev
   * 
   * @param {Object} nodo - Nodo jerárquico con valores totales calculados
   * @param {Object} options - Opciones (label, rowRole, rowClass, etc.)
   * @returns {HTMLTableRowElement} Fila HTML con los totales formateados
   */
  const createResumenTotalsRow = (nodo, options = {}) => {
    const { label = '', rowRole = 'section', rowClass = '', rowContext = null, labelClasses = 'text-center fw-semibold' } = options;
    const totals = {
      actualMonth: toNumber(nodo.actualMonth ?? nodo.totalActualMonth),
      planMonth: toNumber(nodo.planMonth ?? nodo.totalPlanMonth),
      prevMonth: toNumber(nodo.prevMonth ?? nodo.totalPrevMonth),
      actualYTD: toNumber(nodo.actualYTD ?? nodo.totalActualYTD),
      planYTD: toNumber(nodo.planYTD ?? nodo.totalPlanYTD),
      prevYTD: toNumber(nodo.prevYTD ?? nodo.totalPrevYTD)
    };
    const varPlan = calculateVar(totals.actualMonth, totals.planMonth);
    const varPrev = calculateVar(totals.actualMonth, totals.prevMonth);
    const varPlanYTD = calculateVar(totals.actualYTD, totals.planYTD);
    const varPrevYTD = calculateVar(totals.actualYTD, totals.prevYTD);
    const row = document.createElement('tr');
    row.className = rowClass;
    row.dataset.rowRole = rowRole;
    let tooltip = buildRowContextTooltip(rowRole, rowContext || {}) || ROW_TOOLTIPS[rowRole];
    if (nodo && nodo.excludeFromExpense) {
      const aviso = 'Excluido de SUMAS de gastos para este capítulo.';
      tooltip = tooltip ? `${tooltip} · ${aviso}` : aviso;
    }
    if (tooltip) {
      row.setAttribute('title', tooltip);
      row.setAttribute('data-bs-toggle', 'tooltip');
    }
    row.innerHTML = `
      <td class="account-column"></td>
      ${createCell(totals.actualMonth, { rowRole, tooltipKey: 'actualMonth' })}
      ${createCell(totals.planMonth, { rowRole, tooltipKey: 'planMonth' })}
      ${createCell(totals.prevMonth, { rowRole, tooltipKey: 'prevMonth' })}
      ${createPercentCell(varPlan, { rowRole, tooltipKey: 'varMonthPlan' })}
      ${createPercentCell(varPrev, { rowRole, tooltipKey: 'varMonthPrev' })}
      <td class="${labelClasses} text-start"${resumenRowTooltipAttr(rowRole)}>${label}</td>
      ${createCell(totals.actualYTD, { rowRole, tooltipKey: 'actualYTD' })}
      ${createCell(totals.planYTD, { rowRole, tooltipKey: 'planYTD' })}
      ${createCell(totals.prevYTD, { rowRole, tooltipKey: 'prevYTD' })}
      ${createPercentCell(varPlanYTD, { rowRole, tooltipKey: 'varYtdPlan' })}
      ${createPercentCell(varPrevYTD, { rowRole, tooltipKey: 'varYtdPrev' })}
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
    tablaBody.innerHTML = `<tr class="estado-tabla"><td colspan="12">${mensaje}</td></tr>`;
  };

  const ordenarPorOrden = (items = [], extractor) => {
    return (Array.isArray(items) ? items : []).map((item, idx) => ({
      item,
      idx,
      orden: extractor(item, idx)
    })).sort((a, b) => a.orden - b.orden).map(({ item }) => item);
  };

  /**
   * Renderiza/pinta la tabla de Resumen con jerarquía multi-nivel
   * 
   * Resumen muestra el mismo tipo de datos que Summary pero organizado
   * por división jerárquica interna de la empresa:
   * Empresa → División → Comité → Sección → Cuenta
   * 
   * JERARQUÍA DE RESUMEN:
   * - Empresa: EMPRESA01, EMPRESA02, etc.
   * - División: CONSTRUCCIÓN, PROMOCIÓN, etc.
   * - Comité: Subgrupo dentro de división
   * - Sección: Categoría de cuentas (INGRESOS, GASTOS, etc.)
   * - Cuenta: Cuenta contable individual
   * 
   * DIFERENCIA CON SUMMARY:
   * - Summary: Vista consolidada por tipo de cuenta (Revenue, Expenses)
   * - Resumen: Vista por estructura organizacional (Divisiones/Comités)
   * 
   * LAYOUT PERSONALIZADO:
   * Similar a Summary, soporta agrupaciones y resultados especiales:
   * - type: 'group' → Agrupa principals (divisiones)
   * - type: 'net'/'final' → Resultados calculados
   * 
   * COLUMNAS: Las mismas 12 columnas que Summary
   * (Actual Month, Plan, Prev, variaciones, YTD, etc.)
   * 
   * @param {Array} resumen - Array de empresas con estructura jerárquica
   * @param {number} mesSeleccionado - Mes seleccionado (1-12)
   */
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
    const normalizarEtiqueta = (texto = '') => texto.toString().trim().toUpperCase().replace(/\s+/g, ' ');
    const etiquetasOcultas = new Set(['INCOME', 'EXPENSE', 'OPERATING RESULTS']);
    const debeOmitirEtiqueta = (texto = '') => etiquetasOcultas.has(normalizarEtiqueta(texto));
    const normalizarLabel = (texto = '') =>
      texto
        .toString()
        .trim()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toUpperCase()
        .replace(/\s+/g, ' ');

    const totalesCero = () => ({
      actualMonth: 0, planMonth: 0, prevMonth: 0, actualYTD: 0, planYTD: 0, prevYTD: 0
    });

    const recalcularPrincipales = (layoutArr = []) => {
      if (!Array.isArray(layoutArr) || !layoutArr.length) return;
      let principalActual = null;
      let acumulado = totalesCero();
      const applySign = (valor, signo = 1) => Number.isFinite(signo) ? signo : 1;
      const asignarAcumulado = () => {
        if (principalActual) {
          principalActual.totals = { ...acumulado };
        }
      };
      layoutArr.forEach((block) => {
        const tipo = (block.type || '').toLowerCase();
        if (tipo === 'principal') {
          // Cierra el anterior y abre uno nuevo
          asignarAcumulado();
          principalActual = block;
          acumulado = totalesCero();
          return;
        }
        if (!principalActual) return;
        if (tipo === 'secundaria') {
          const sign = applySign(block.sign, 1);
          // Respetar exclusiones de gasto marcadas en el layout
          if (block.totals && block.totals.excludeFromExpense) {
            return;
          }
          const t = block.totals || {};
          acumulado.actualMonth += toNumber(t.actualMonth) * sign;
          acumulado.planMonth += toNumber(t.planMonth) * sign;
          acumulado.prevMonth += toNumber(t.prevMonth) * sign;
          acumulado.actualYTD += toNumber(t.actualYTD) * sign;
          acumulado.planYTD += toNumber(t.planYTD) * sign;
          acumulado.prevYTD += toNumber(t.prevYTD) * sign;
        }
        // Si aparece otra consolidación de nivel superior, no cerramos aquí; se recalcula después.
      });
      asignarAcumulado();
    };

    const recalcularConsolidados = (layoutArr = []) => {
      if (!Array.isArray(layoutArr) || !layoutArr.length) return;
      const labelMap = new Map(layoutArr.map((b) => [normalizarLabel(b.label || ''), b]));
      const obtenerPorLabels = (candidatos = []) => {
        for (const lbl of candidatos) {
          const block = labelMap.get(normalizarLabel(lbl));
          if (block) return block.totals || totalesCero();
        }
        return totalesCero();
      };
      const asignarPrimero = (labels = [], totals) => {
        for (const lbl of labels) {
          const block = labelMap.get(normalizarLabel(lbl));
          if (block && totals) {
            block.totals = totals;
            return block;
          }
        }
        return null;
      };

      const INCOME_LABELS = {
        mex: ['CDMX INCOME', 'MEXICO INCOME'],
        gdl: ['GUADALAJARA INCOME', 'GDL INCOME'],
        mty: ['MONTERREY INCOME', 'MTY INCOME'],
        nw: ['NORTHWEST INCOME', 'NW INCOME', 'NOROESTE INCOME', 'NO INCOME'],
        ne: ['NE INCOME', 'NORESTE INCOME']
      };
      const EXPENSE_LABELS = {
        mex: ['CDMX EXPENSE', 'MEXICO EXPENSE'],
        gdl: ['GUADALAJARA EXPENSE', 'GDL EXPENSE'],
        mty: ['MONTERREY EXPENSE', 'MTY EXPENSE'],
        nw: ['NORTHWEST EXPENSE', 'NW EXPENSE', 'NOROESTE EXPENSE', 'NO EXPENSE'],
        ne: ['NE EXPENSE', 'NORESTE EXPENSE']
      };
      const sumaTotales = (dest, src, signo = 1) => {
        if (!src) return;
        dest.actualMonth += toNumber(src.actualMonth) * signo;
        dest.planMonth += toNumber(src.planMonth) * signo;
        dest.prevMonth += toNumber(src.prevMonth) * signo;
        dest.actualYTD += toNumber(src.actualYTD) * signo;
        dest.planYTD += toNumber(src.planYTD) * signo;
        dest.prevYTD += toNumber(src.prevYTD) * signo;
      };
      const totalesCero = () => ({
        actualMonth: 0, planMonth: 0, prevMonth: 0, actualYTD: 0, planYTD: 0, prevYTD: 0
      });
      const combinar = (sumarLabels = [], restarLabels = []) => {
        const res = totalesCero();
        sumarLabels.forEach((lbl) => sumaTotales(res, labelMap.get(normalizarLabel(lbl))?.totals, 1));
        restarLabels.forEach((lbl) => sumaTotales(res, labelMap.get(normalizarLabel(lbl))?.totals, -1));
        return res;
      };
      const asignar = (label, totals) => {
        const block = labelMap.get(normalizarLabel(label));
        if (block && totals) {
          block.totals = totals;
        }
      };

      // Operating Results por plaza antes de los consolidados globales
      const opResults = {
        mex: combinar(INCOME_LABELS.mex, EXPENSE_LABELS.mex),
        gdl: combinar(INCOME_LABELS.gdl, EXPENSE_LABELS.gdl),
        mty: combinar(INCOME_LABELS.mty, EXPENSE_LABELS.mty),
        nw: combinar(INCOME_LABELS.nw, EXPENSE_LABELS.nw),
        ne: combinar(INCOME_LABELS.ne, EXPENSE_LABELS.ne)
      };
      asignarPrimero(['OPERATING RESULTS MEXICO'], opResults.mex);
      asignarPrimero(['OPERATING RESULTS GUADALAJARA', 'GDL OPERATING RESULTS'], opResults.gdl);
      asignarPrimero(['OPERATING RESULTS MONTERREY', 'MTY OPERATING RESULTS'], opResults.mty);
      asignarPrimero(['OPERATING RESULTS NORTHWEST', 'OPERATING RESULTS NO', 'OPERATING RESULTS NOROESTE'], opResults.nw);
      asignarPrimero(['OPERATING RESULTS NE', 'NE OPERATING RESULTS', 'OPERATING RESULTS NORESTE'], opResults.ne);

      // NET RESULTS por plaza según la lógica indicada
      const memberCentricityMx = obtenerPorLabels(['MEMBER CENTRICITY', 'Member Centricity', 'Member Centricity CDMX', 'Member Centricity Mexico']);
      const memberCentricityGdl = obtenerPorLabels(['Member Centricity GDL', 'Member Centricity Guadalajara', 'GDL Member Centricity', 'Guadalajara Member Centricity', 'Member Centricity']);
      const memberCentricityNe = obtenerPorLabels(['Member Centricity NE', 'Member Centricity Noreste', 'NE Member Centricity', 'NORESTE Member Centricity', 'Member Centricity']);
      const otherMx = obtenerPorLabels(['Other (MEXICO)', 'Other Income Mexico']);
      const otherGdl = obtenerPorLabels([
        'Guadalajara Other Income',
        'GDL Other Income',
        'Other Guadalajara',
        'Other GDL',
        'Other',
        'Otros ingresos',
        'OTROS INGRESOS'
      ]);
      const otherMty = obtenerPorLabels(['Monterrey Other Income', 'MTY Other Income']);
      const otherNw = obtenerPorLabels(['Northwest Other Income', 'NW Other Income', 'NO Other Income', 'NOROESTE Other Income']);
      const otherNe = obtenerPorLabels([
        'NE Other Income',
        'Noreste Other Income',
        'NE Other',
        'NORESTE Other Income',
        'Other',
        'Otros ingresos',
        'OTROS INGRESOS'
      ]);

      const netResultsCalc = {
        // MX: resta Member Centricity y suma Other (MEXICO)
        mx: { op: ['OPERATING RESULTS MEXICO'], mc: memberCentricityMx, other: otherMx, labels: ['NET RESULTS MEXICO'] },
        // GDL: (OPERATING RESULTS GDL) + Other (sin restar Member Centricity)
        gdl: { op: ['OPERATING RESULTS GUADALAJARA', 'GDL OPERATING RESULTS'], mc: totalesCero(), other: otherGdl, labels: ['NET RESULTS GUADALAJARA', 'GDL NET RESULTS'] },
        // MTY: solo suma Other Income
        mty: { op: ['OPERATING RESULTS MONTERREY', 'MTY OPERATING RESULTS'], mc: totalesCero(), other: otherMty, labels: ['NET RESULTS MONTERREY', 'MTY NET RESULTS'] },
        // NW: solo suma Other Income
        nw: { op: ['OPERATING RESULTS NORTHWEST', 'OPERATING RESULTS NO', 'OPERATING RESULTS NOROESTE'], mc: totalesCero(), other: otherNw, labels: ['NET RESULTS NORTHWEST', 'NET RESULTS NO', 'NET RESULTS NOROESTE'] },
        // NE: resta Member Centricity y suma Other Income
        ne: { op: ['OPERATING RESULTS NE', 'NE OPERATING RESULTS', 'OPERATING RESULTS NORESTE'], mc: memberCentricityNe, other: otherNe, labels: ['NET RESULTS NE', 'NET RESULTS NORESTE'] }
      };

      Object.values(netResultsCalc).forEach(({ op, mc, other, labels }) => {
        const totals = combinar(op, []);
        const bloque = asignarPrimero(labels, totals);
        if (bloque) {
          bloque.totals = bloque.totals || totalesCero();
          sumaTotales(bloque.totals, mc, -1);
          sumaTotales(bloque.totals, other, 1);
        }
      });

      asignar('CONSOLIDATED INCOME', combinar(
        [...INCOME_LABELS.mex, ...INCOME_LABELS.gdl, ...INCOME_LABELS.mty, ...INCOME_LABELS.nw]
      ));
      asignar('CONSOLIDATED EXPENSES', combinar(
        [...EXPENSE_LABELS.mex, ...EXPENSE_LABELS.gdl, ...EXPENSE_LABELS.mty, ...EXPENSE_LABELS.nw]
      ));
      asignar('CONSOLIDATED OPERATING RESULTS', combinar(
        ['OPERATING RESULTS MEXICO', 'OPERATING RESULTS GUADALAJARA', 'OPERATING RESULTS MONTERREY', 'OPERATING RESULTS NORTHWEST']
      ));
      asignar('CONSOLIDATED NET RESULTS', combinar(
        ['NET RESULTS MEXICO', 'NET RESULTS GUADALAJARA', 'NET RESULTS MONTERREY', 'NET RESULTS NORTHWEST']
      ));
    };

    resumen.forEach((capitulo) => {
      const capituloName = (capitulo.label || capitulo.capitulo || '').toString().trim().toUpperCase();
      const layout = Array.isArray(capitulo.layout) ? capitulo.layout.slice() : null;
      const principales = Array.isArray(capitulo.children) ? capitulo.children.slice() : [];
      const principalLookup = new Map(principales.map((principal) => [principal.label, principal]));

      const renderPrincipal = (principal) => {
        if (!principal) return;
        const seccionesOrdenadas = ordenarPorOrden(principal.children || [], (sec, idx) => {
          const orden = Number.isFinite(Number(sec?.orden)) ? Number(sec.orden) : Number.isFinite(Number(sec?.order)) ? Number(sec.order) : null;
          return orden != null ? orden : idx;
        });

        seccionesOrdenadas.forEach((seccion) => {
          (seccion.cuentas || []).forEach((cta) => {
            const varPlan = calculateVar(cta.actualMonth, cta.planMonth);
            const varPrev = calculateVar(cta.actualMonth, cta.prevMonth);
            const varPlanYTD = calculateVar(cta.actualYTD, cta.planYTD);
            const varPrevYTD = calculateVar(cta.actualYTD, cta.prevYTD);
            const row = document.createElement('tr');
            row.className = 'data-row';
            row.dataset.cuenta = cta.cuentaCanonica || cta.cuenta || '';
            row.dataset.cuenta21 = cta.cuentaCanonica || '';
            row.dataset.rowRole = 'account';
            const detalleCuenta = [
              `Cuenta ${cta.cuenta || 'sin codigo'} - Sección ${seccion.label || 'sin sección'}${principal.label ? ` - Principal ${principal.label}` : ''}`,
              'Real: saldos COI via planeación',
              `Presupuesto: ${planColumnKey.toUpperCase()} / PRESUP01-12 (tabla PRESUPYY)`
            ].join(' - ');
            row.setAttribute('title', detalleCuenta);
            row.setAttribute('data-bs-toggle', 'tooltip');
            row.innerHTML = `
              ${createEditableCell(cta.cuenta || '', { columnKey: 'cuenta', rowRole: 'account', tooltipKey: 'account', text: true, classes: 'account-column font-monospace small text-start' })}
              ${createCell(cta.actualMonth, { rowRole: 'account', tooltipKey: 'actualMonth' })}
              ${createCell(cta.planMonth, { rowRole: 'account', tooltipKey: 'planMonth' })}
              ${createCell(cta.prevMonth, { rowRole: 'account', tooltipKey: 'prevMonth' })}
              ${createPercentCell(varPlan, { rowRole: 'account', tooltipKey: 'varMonthPlan' })}
              ${createPercentCell(varPrev, { rowRole: 'account', tooltipKey: 'varMonthPrev' })}
              ${createEditableCell(cta.descripcion || '', { columnKey: 'descripcion', rowRole: 'account', tooltipKey: 'account', text: true, classes: 'text-center' })}
              ${createCell(cta.actualYTD, { rowRole: 'account', tooltipKey: 'actualYTD' })}
              ${createCell(cta.planYTD, { rowRole: 'account', tooltipKey: 'planYTD' })}
              ${createCell(cta.prevYTD, { rowRole: 'account', tooltipKey: 'prevYTD' })}
              ${createPercentCell(varPlanYTD, { rowRole: 'account', tooltipKey: 'varYtdPlan' })}
              ${createPercentCell(varPrevYTD, { rowRole: 'account', tooltipKey: 'varYtdPrev' })}
            `;
            tablaBody.appendChild(row);
          });

          tablaBody.appendChild(createResumenTotalsRow(seccion, {
            label: seccion.label || '',
            rowRole: 'section',
            rowClass: 'sum-row fw-semibold',
            rowContext: {
              label: seccion.label || '',
              principal: principal.label || '',
              cuentas: seccion.cuentas || []
            }
          }));
        });

        tablaBody.appendChild(createResumenTotalsRow(principal, {
          label: principal.label || '',
          rowRole: 'principal',
          rowClass: 'section-header-row table-light fw-bold',
          rowContext: {
            label: principal.label || '',
            sections: seccionesOrdenadas.map((sec) => sec.label || ''),
            sign: principal.sign
          }
        }));
      };

      // Renderizar usando SOLO el layout (que ya tiene todo en orden correcto)
      if (layout && layout.length) {
        recalcularPrincipales(layout);
        recalcularConsolidados(layout);
        layout.forEach((block) => {
          const blockType = block.type || '';
          
          // PRINCIPAL: Header de sección principal
          if (blockType === 'principal') {
            const principalRow = createResumenTotalsRow(block.totals || {}, {
              label: block.label || '',
              rowRole: 'principal',
              rowClass: 'section-header-row table-info fw-bold text-center',
              rowContext: {
                label: block.label || '',
                sections: (block.children || []).map(ch => ch.label || ''),
                sign: 1
              }
            });
            tablaBody.appendChild(principalRow);
          }
          // SECUNDARIA: Header de subsección
          else if (blockType === 'secundaria') {
            let secRowClass = 'subsection-row bg-light fw-semibold text-center collapsible-section';
            if (block.totals && block.totals.excludeFromExpense) {
              secRowClass += ' excluded-expense';
            }
            const secRow = createResumenTotalsRow(block.totals || {}, {
              label: block.label || '',
              rowRole: 'section',
              rowClass: secRowClass,
              rowContext: {
                label: block.label || '',
                principal: '',
                cuentas: block.cuentas || []
              }
            });
            // Agregar icono de colapso en la primera celda con texto
            const cells = secRow.querySelectorAll('td');
            if (cells[6]) {
              cells[6].innerHTML = `<i class="bi bi-chevron-down collapse-icon me-2" style="cursor:pointer;"></i>${block.label || ''}`;
              cells[6].style.cursor = 'pointer';
              secRow.dataset.sectionName = block.label || '';
            }
            tablaBody.appendChild(secRow);
          }
          // CUENTA: Fila de datos
          else if (blockType === 'cuenta') {
            const cta = block.totals || {};
            const varPlan = calculateVar(cta.actualMonth, cta.planMonth);
            const varPrev = calculateVar(cta.actualMonth, cta.prevMonth);
            const varPlanYTD = calculateVar(cta.actualYTD, cta.planYTD);
            const varPrevYTD = calculateVar(cta.actualYTD, cta.prevYTD);

            const row = document.createElement('tr');
            row.className = 'account-row section-child';
            row.dataset.cuenta = block.cuenta || '';
            row.dataset.cuenta21 = block.cuenta || '';
            row.dataset.rowRole = 'account';
            
            // Usar block.nombre (del JSON NOMBRE) en vez de block.label
            const nombreCuenta = block.descripcion || block.nombre || block.label || '';
            
            row.innerHTML = `
              ${createEditableCell(block.cuenta || '', { columnKey: 'cuenta', rowRole: 'account', tooltipKey: 'account', text: true, classes: 'account-column font-monospace small text-start ps-4' })}
              ${createCell(cta.actualMonth, { rowRole: 'account', tooltipKey: 'actualMonth' })}
              ${createCell(cta.planMonth, { rowRole: 'account', tooltipKey: 'planMonth' })}
              ${createCell(cta.prevMonth, { rowRole: 'account', tooltipKey: 'prevMonth' })}
              ${createPercentCell(varPlan, { rowRole: 'account', tooltipKey: 'varMonthPlan' })}
              ${createPercentCell(varPrev, { rowRole: 'account', tooltipKey: 'varMonthPrev' })}
              ${createEditableCell(nombreCuenta, { columnKey: 'descripcion', rowRole: 'account', tooltipKey: 'account', text: true, classes: 'text-center' })}
              ${createCell(cta.actualYTD, { rowRole: 'account', tooltipKey: 'actualYTD' })}
              ${createCell(cta.planYTD, { rowRole: 'account', tooltipKey: 'planYTD' })}
              ${createCell(cta.prevYTD, { rowRole: 'account', tooltipKey: 'prevYTD' })}
              ${createPercentCell(varPlanYTD, { rowRole: 'account', tooltipKey: 'varYtdPlan' })}
              ${createPercentCell(varPrevYTD, { rowRole: 'account', tooltipKey: 'varYtdPrev' })}
            `;
            tablaBody.appendChild(row);
          }
          // CONSOLIDACIONES: Filas de suma con jerarquía visual
          else if (['group', 'result', 'net', 'final'].includes(blockType)) {
            // Determinar clase CSS según tipo y label
            let rowClass = '';
            const label = (block.label || '').toUpperCase();

            if (debeOmitirEtiqueta(label)) {
              return;
            }

            // Para GUADALAJARA: solo mostrar la fila de OPERATING RESULTS específica de GDL
            if (label.includes('OPERATING RESULTS') && capituloName.includes('GUADALAJARA') && !label.includes('GDL') && !label.includes('GUADALAJARA')) {
              // Omitir filas genéricas de Operating Results cuando hay una específica de GDL
              return;
            }
            
            // Nivel 5: NET RESULTS (máxima jerarquía)
            if (blockType === 'final' || label.includes('NET RESULTS') || label.includes('CONSOLIDATED NET')) {
              rowClass = 'highlight-bright text-white fw-bold';
            }
            // Nivel 4: OPERATING RESULTS
            else if (label.includes('OPERATING RESULTS') || label.includes('OPERATING INCOME')) {
              rowClass = 'highlight-secondary fw-bold';
            }
            // Nivel 3: CONSOLIDATED INCOME/EXPENSES
            else if (label.includes('CONSOLIDATED') && (label.includes('INCOME') || label.includes('EXPENSE'))) {
              rowClass = 'highlight-primary fw-bold text-uppercase';
            }
            // Nivel 2: Principal (INCOME, EXPENSE sin CONSOLIDATED)
            else if ((label.includes('INCOME') || label.includes('EXPENSE')) && !label.includes('CONSOLIDATED')) {
              rowClass = 'sum-row-principal fw-bold';
            }
            // Nivel 1: Sumas de sección
            else {
              rowClass = 'sum-row fw-semibold';
            }
            
            // Si la sección/operación está marcada para excluirse de expenses, anotar clase
            const extras = {};
            if (block.totals && block.totals.excludeFromExpense) {
              extras.rowClass = `${rowClass} excluded-expense`;
            }

            const consolidationRow = createResumenTotalsRow(block.totals || {}, {
              label: block.label || '',
              rowRole: blockType,
              rowClass: extras.rowClass || rowClass,
              rowContext: {
                label: block.label || '',
                type: blockType,
                principals: block.principals || [],
                operaciones: block.operaciones || []
              }
            });
            tablaBody.appendChild(consolidationRow);
          }
        });
      } else {
        // Fallback: renderizar usando children (comportamiento anterior)
        ordenarPorOrden(principales, (p, idx) => {
          const orden = Number.isFinite(Number(p?.orden)) ? Number(p.orden) : Number.isFinite(Number(p?.order)) ? Number(p.order) : null;
          return orden != null ? orden : idx;
        }).forEach(renderPrincipal);
      }
    });

    sincronizarCeldasEditables();
    activateTooltips();
    autoCollapseExcludedSections();
    habilitarColapsoGastosAdministrativos();
    wireCollapseControls();
  };

  const actualizarEtiquetasAnio = (anio) => {
    const yearAct = document.querySelectorAll('.year-act');
    const yearPrev = document.querySelectorAll('.year-prev');
    const anioNum = Number(anio);
    const anioAnterior = Number.isFinite(anioNum) ? anioNum - 1 : anio;
    
    yearAct.forEach((el) => (el.textContent = anio));
    yearPrev.forEach((el) => (el.textContent = anioAnterior));
    if (yearLabel) {
      yearLabel.textContent = anio;
    }
  };

  const actualizarEtiquetaMes = (mesSeleccionado) => {
    const mesInfo = MESES.find((m) => m.periodo === mesSeleccionado);
    const clave = mesInfo?.clave || 'DIC';
    
    // Actualizar etiquetas del mes actual en mayúsculas
    document.querySelectorAll('.mes-actual').forEach((span) => {
      span.textContent = clave.toUpperCase();
    });

    if (periodLabel) {
      const nombreMes = (mesInfo?.etiqueta || clave).toUpperCase();
      const anioActual = leerAnioSeleccionado();
      periodLabel.textContent = anioActual ? `${nombreMes} ${anioActual}` : nombreMes;
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

      if (manejarSesionExpirada(response)) return [];

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
    
    // Usar capítulo derivado de la empresa activa
    const capitulo = obtenerCapituloEmpresa(empresaId);
    if (capitulo) params.set('capitulo', capitulo);
    
    const respuesta = await fetch(`${API_ENDPOINT}?${params.toString()}`, {
      headers: Sesion.headersAutenticacion()
    });
    if (manejarSesionExpirada(respuesta)) return;
    if (!respuesta.ok) {
      throw new Error('No fue posible obtener el resumen.');
    }
      const datos = await respuesta.json();
      const anioNumero = Number(anio);
      aplicarLayoutPersistente(empresaId, anioNumero, datos?.resumen || []);
      renderResumen(datos.resumen || [], mes);
      actualizarEtiquetasAnio(anioNumero);
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
    actualizarEtiquetaMes(mesInicial);
    window.dispatchEvent(new CustomEvent('planeacion:contexto-actualizado', {
      detail: { empresaId, anio: valorInicial, periodo: mesInicial, modulo: (document.body.dataset.modulo || 'RESUMEN').toUpperCase() }
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
    try { window.ModoEdicionPresupuesto?.inicializar?.(); } catch (e) { /* ignore */ }
    const sesion = Sesion.requerirSesion();
    if (!sesion) return;
    const empresa = Sesion.obtenerEmpresaActiva(sesion);
    if (!empresa?.id) {
      setStatusRow('Selecciona una empresa para continuar.');
      return;
    }

    empresaActual = empresa;
    await aplicarEmpresaResumen(empresaActual.id);
    
    // 🔄 Cargar layout desde servidor (layout_templates) primero
    const anio = leerAnioSeleccionado();
    const moduloClave = 'RESUMEN';
    
    try {
      const layoutServidor = await fetch(`${base}/api/layouts?empresaId=${empresa.id}&modulo=${moduloClave}&anio=${anio}`)
        .then(r => r.ok ? r.json() : null)
        .catch(() => null);
      
      if (layoutServidor?.datos) {
        console.log('✅ Layout cargado desde servidor (RESUMEN):', layoutServidor);
        if (window.ModoEdicionPresupuesto?.aplicarLayoutLocal) {
          window.ModoEdicionPresupuesto.aplicarLayoutLocal(layoutServidor.datos);
        }
      } else {
        // Fallback: cargar desde localStorage
        console.log('📦 No hay layout en servidor, intentando localStorage...');
        const layoutLocal = window.ModoEdicionPresupuesto?.cargarLayoutLocal?.();
        if (layoutLocal && window.ModoEdicionPresupuesto?.aplicarLayoutLocal) {
          window.ModoEdicionPresupuesto.aplicarLayoutLocal(layoutLocal);
          console.log('✅ Layout aplicado desde localStorage');
        }
      }
    } catch (err) {
      console.warn('⚠️ Error cargando layout en RESUMEN:', err);
    }

    sincronizarSelectorEmpresaGlobal();

    const handleYearChange = () => {
      const anio = leerAnioSeleccionado();
      const mes = leerMesSeleccionado();
      if (!empresaActual?.id) return;
      actualizarEncabezado(empresaActual.id, anio);
      window.dispatchEvent(new CustomEvent('planeacion:contexto-actualizado', {
        detail: { empresaId: empresaActual.id, anio, periodo: mes, modulo: (document.body.dataset.modulo || 'RESUMEN').toUpperCase() }
      }));
      fetchResumen(empresaActual.id, anio, mes);
    };

    const handleMonthChange = () => {
      const anio = leerAnioSeleccionado();
      const mes = leerMesSeleccionado();
      actualizarMesContexto(mes);
      actualizarEtiquetaMes(mes);
      if (!empresaActual?.id) return;
      actualizarEncabezado(empresaActual.id, anio);
      window.dispatchEvent(new CustomEvent('planeacion:contexto-actualizado', {
        detail: { empresaId: empresaActual.id, anio, periodo: mes, modulo: (document.body.dataset.modulo || 'RESUMEN').toUpperCase() }
      }));
      fetchResumen(empresaActual.id, anio, mes);
    };

    if (yearSelect) {
      yearSelect.addEventListener('change', handleYearChange);
    }
    if (monthSelect) {
      monthSelect.addEventListener('change', handleMonthChange);
    }
    // Ya no hay selector local de capítulo - se usa companyFilter global
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

  // --- Workflow / COI bridge (ligero) ---
  const workflowBadge = document.getElementById('workflowBadge');
  const workflowMeta = document.getElementById('workflowMeta');
  const workflowHistory = document.getElementById('workflowHistory');
  const btnBorrador = document.getElementById('btnGuardarBorrador');
  const btnRevisar = document.getElementById('btnMarcarRevisado');
  const btnAutorizar = document.getElementById('btnAutorizar');
  const btnGuardarCoi = document.getElementById('saveBudgetBtn');
  const toastEl = document.getElementById('actionToast');
  const toastBody = document.getElementById('actionToastBody');
  const toastInst = toastEl ? window.bootstrap?.Toast.getOrCreateInstance(toastEl, { delay: 3000 }) : null;
  
  // Normalizar estado del backend (MAYÚSCULAS) a formato frontend (minúsculas-guiones)
  const normalizarEstado = (estado) => {
    if (!estado) return 'sin-cargar';
    const mapa = {
      'SIN_CARGAR': 'sin-cargar',
      'EDITANDO': 'editando',
      'REVISADO': 'revisado',
      'APROBADO': 'autorizado',
      'GUARDADO': 'guardado',
      'PENDIENTE': 'pendiente',
      'RECHAZADO': 'rechazado'
    };
    return mapa[estado] || estado.toLowerCase().replace(/_/g, '-');
  };
  
  const WORKFLOW_LABEL = {
    'sin-cargar': 'Sin cargar',
    'borrador': 'Borrador',
    'editando': 'Editando',
    'revisado': 'Revisado',
    'autorizado': 'Autorizado',
    'aprobado': 'Aprobado',
    'guardado': 'Guardado en COI',
    'pendiente': 'Pendiente',
    'rechazado': 'Rechazado'
  };

  const showToast = (msg, variant = 'text-bg-success') => {
    if (!toastEl || !toastInst) return;
    toastEl.className = `toast align-items-center border-0 ${variant}`;
    if (toastBody) toastBody.textContent = msg;
    toastInst.show();
  };

  const workflowEstado = {
    estado: 'sin-cargar',
    actualizadoEn: null,
    actualizadoPor: '',
    historial: []
  };

  const renderWorkflow = () => {
    if (workflowBadge) {
      workflowBadge.textContent = WORKFLOW_LABEL[workflowEstado.estado] || workflowEstado.estado;
    }
    if (workflowMeta) {
      const fecha = workflowEstado.actualizadoEn ? new Date(workflowEstado.actualizadoEn).toLocaleString('es-MX') : '';
      const usuario = workflowEstado.actualizadoPor ? ` por ${workflowEstado.actualizadoPor}` : '';
      workflowMeta.textContent = fecha ? `${fecha}${usuario}` : '';
    }
    if (workflowHistory) {
      workflowHistory.innerHTML = '';
      const lista = workflowEstado.historial || [];
      if (!lista.length) {
        const li = document.createElement('li');
        li.className = 'list-group-item small text-muted';
        li.textContent = 'Sin movimientos registrados.';
        workflowHistory.appendChild(li);
      } else {
        lista.forEach((item) => {
          const li = document.createElement('li');
          li.className = 'list-group-item small';
          const fecha = item.fecha ? new Date(item.fecha).toLocaleString('es-MX') : '';
          li.textContent = `${WORKFLOW_LABEL[item.estado] || item.estado}${fecha ? ` · ${fecha}` : ''}${item.usuario ? ` · ${item.usuario}` : ''}`;
          workflowHistory.appendChild(li);
        });
      }
    }
  };

  const obtenerContexto = () => {
    const empresa = Sesion.obtenerEmpresaActiva();
    return {
      empresaId: empresa?.id || '',
      anio: leerAnioSeleccionado()
    };
  };

  const API_WORKFLOW_ESTADO = `${base}/api/presupuestos/estado`;
  const API_WORKFLOW_GUARDAR = `${base}/api/presupuestos/guardar`;

  const cargarWorkflow = async (modulo) => {
    const ctx = obtenerContexto();
    if (!ctx.empresaId || !ctx.anio) return;
    try {
      const params = new URLSearchParams({ modulo, anio: ctx.anio });
      const resp = await fetch(`${API_WORKFLOW_ESTADO}?${params.toString()}`, {
        headers: Sesion.headersAutenticacion()
      });
      if (manejarSesionExpirada(resp)) return;
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(data.mensaje || 'No fue posible obtener el estado.');
      workflowEstado.estado = normalizarEstado(data.estado);
      workflowEstado.actualizadoEn = data.actualizadoEn || null;
      workflowEstado.actualizadoPor = data.actualizadoPor || '';
      workflowEstado.historial = (data.historial || []).map(h => ({
        ...h,
        estado: normalizarEstado(h.estado)
      }));
      renderWorkflow();
    } catch (err) {
      console.warn('Workflow Resumen', err);
      showToast(err.message || 'No fue posible actualizar el flujo.', 'text-bg-danger');
    }
  };

  const postAccionWorkflow = async (accion, modulo) => {
    const ctx = obtenerContexto();
    if (!ctx.empresaId || !ctx.anio) {
      showToast('Selecciona empresa y año.', 'text-bg-warning');
      return;
    }
    try {
      const resp = await fetch(API_WORKFLOW_ESTADO, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...Sesion.headersAutenticacion() },
        body: JSON.stringify({ accion, modulo, anio: ctx.anio })
      });
      if (manejarSesionExpirada(resp)) return;
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(data.mensaje || 'No fue posible registrar la acción.');
      workflowEstado.estado = normalizarEstado(data.estado) || workflowEstado.estado;
      workflowEstado.actualizadoEn = data.actualizadoEn || null;
      workflowEstado.actualizadoPor = data.actualizadoPor || '';
      workflowEstado.historial = (data.historial || workflowEstado.historial).map(h => ({
        ...h,
        estado: normalizarEstado(h.estado)
      }));
      renderWorkflow();
      showToast(data.mensaje || 'Acción registrada.');
    } catch (err) {
      console.error('postAccionWorkflow', err);
      showToast(err.message || 'No fue posible completar la acción.', 'text-bg-danger');
    }
  };

  const guardarEnCoi = async (modulo) => {
    const ctx = obtenerContexto();
    if (!ctx.empresaId || !ctx.anio) {
      showToast('Selecciona empresa y año.', 'text-bg-warning');
      return;
    }
    try {
      if (window.ModoEdicionPresupuesto?.guardarLayout) {
        window.ModoEdicionPresupuesto.guardarLayout();
      } else if (window.CuentasModulo?.guardarLayout) {
        window.CuentasModulo.guardarLayout();
      }
    } catch (err) {
      console.warn('guardarLayout (no crítico) falló', err);
    }

    const cambios = window.CuentasModulo?.getCambios?.() || { presupuesto: [], hayCambios: false };
    try {
      const resp = await fetch(API_WORKFLOW_GUARDAR, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...Sesion.headersAutenticacion() },
        body: JSON.stringify({
          modulo,
          empresaId: ctx.empresaId,
          anio: ctx.anio,
          datos: cambios
        })
      });
      if (manejarSesionExpirada(resp)) return;
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(data.mensaje || 'No fue posible guardar en COI.');
      showToast(data.mensaje || 'Guardado en COI.');
      await postAccionWorkflow('guardar', modulo);
    } catch (err) {
      console.error('guardarEnCoi', err);
      showToast(err.message || 'No fue posible guardar en COI.', 'text-bg-danger');
    }
  };

  const initWorkflowBridge = (modulo) => {
    cargarWorkflow(modulo);
    if (btnBorrador) {
      btnBorrador.addEventListener('click', () => postAccionWorkflow('cargar', modulo));
    }
    if (btnRevisar) {
      btnRevisar.addEventListener('click', () => postAccionWorkflow('revisar', modulo));
    }
    if (btnAutorizar) {
      btnAutorizar.addEventListener('click', () => postAccionWorkflow('autorizar', modulo));
    }
    if (btnGuardarCoi) {
      btnGuardarCoi.addEventListener('click', () => guardarEnCoi(modulo));
    }
    window.addEventListener('planeacion:contexto-actualizado', (evt) => {
      const det = evt?.detail || {};
      if (det?.modulo && det.modulo !== modulo) return;
      cargarWorkflow(modulo);
    });
    window.addEventListener(Sesion.EVENTO_EMPRESA, () => cargarWorkflow(modulo));
  };

  const wireCollapseControls = () => {
    if (collapseButtons.length) {
      collapseButtons.forEach((btn) => {
        btn.addEventListener('click', () => {
          const allSections = document.querySelectorAll('.collapsible-section');
          if (!allSections.length) return;
          allSections.forEach((row) => setSectionCollapseState(row, true));
          syncCollapseAllState();
        });
      });
    }

    if (expandButtons.length) {
      expandButtons.forEach((btn) => {
        btn.addEventListener('click', () => {
          const allSections = document.querySelectorAll('.collapsible-section');
          if (!allSections.length) return;
          allSections.forEach((row) => setSectionCollapseState(row, false));
          syncCollapseAllState();
        });
      });
    }
  };

  document.addEventListener('click', (e) => {
    const collapseIcon = e.target.closest('.collapse-icon');
    if (!collapseIcon) return;

    const row = collapseIcon.closest('.collapsible-section');
    if (!row) return;

    const sectionName = obtenerNombreSeccion(row);
    if (!sectionName) return;

    e.stopPropagation();

    const debeColapsar = !collapsedSections.has(sectionName);
    setSectionCollapseState(row, debeColapsar);
    syncCollapseAllState();
  });

  // Controles de zoom y visibilidad de columnas
  const table = document.getElementById('tablaComparacion');
  const tableWrapper = document.getElementById('tableWrapper');
  const zoomInBtn = document.getElementById('zoomIn');
  const zoomOutBtn = document.getElementById('zoomOut');
  const zoomResetBtn = document.getElementById('zoomReset');
  const zoomDisplay = document.getElementById('zoomDisplay');
  const toggleAccountColumnBtn = document.getElementById('toggleAccountColumnBtn');
  const ACCOUNT_COLUMN_STORAGE_KEY = 'resumen_ocultar_cuentas';

  let selectedCell = null;
  let zoomLevel = 1;

  const clampZoom = (value) => Math.min(1.5, Math.max(0.6, value));
  const renderZoom = () => {
    if (tableWrapper) {
      tableWrapper.style.transform = `scale(${zoomLevel})`;
    }
    if (zoomDisplay) {
      zoomDisplay.textContent = `${Math.round(zoomLevel * 100)}%`;
    }
  };

  if (zoomInBtn) {
    zoomInBtn.addEventListener('click', () => {
      zoomLevel = clampZoom(zoomLevel + 0.1);
      renderZoom();
    });
  }

  if (zoomOutBtn) {
    zoomOutBtn.addEventListener('click', () => {
      zoomLevel = clampZoom(zoomLevel - 0.1);
      renderZoom();
    });
  }

  if (zoomResetBtn) {
    zoomResetBtn.addEventListener('click', () => {
      zoomLevel = 1;
      renderZoom();
    });
  }

  const actualizarBotonColumnas = (ocultar) => {
    if (!toggleAccountColumnBtn) return;
    const etiqueta = toggleAccountColumnBtn.querySelector('.toggle-account-label');
    if (etiqueta) {
      etiqueta.textContent = ocultar ? 'Mostrar cuentas' : 'Ocultar cuentas';
    }
    toggleAccountColumnBtn.setAttribute('aria-pressed', ocultar ? 'true' : 'false');
  };

  const aplicarVisibilidadCuentas = (ocultar) => {
    document.body.classList.toggle('ocultar-cuentas', Boolean(ocultar));
    actualizarBotonColumnas(Boolean(ocultar));
  };

  const inicializarToggleColumnas = () => {
    if (!toggleAccountColumnBtn) {
      aplicarVisibilidadCuentas(false);
      return;
    }

    const preferencia = localStorage.getItem(ACCOUNT_COLUMN_STORAGE_KEY) === '1';
    aplicarVisibilidadCuentas(preferencia);

    toggleAccountColumnBtn.addEventListener('click', () => {
      const ocultar = !document.body.classList.contains('ocultar-cuentas');
      aplicarVisibilidadCuentas(ocultar);
      localStorage.setItem(ACCOUNT_COLUMN_STORAGE_KEY, ocultar ? '1' : '0');
    });
  };

  if (table) {
    table.addEventListener('click', (event) => {
      const cell = event.target.closest('td, th');
      if (!cell) return;
      if (selectedCell) {
        selectedCell.classList.remove('selected');
      }
      selectedCell = cell;
      selectedCell.classList.add('selected');
    });
  }

  document.addEventListener('click', (event) => {
    if (!table || !selectedCell) return;
    if (!table.contains(event.target)) {
      selectedCell.classList.remove('selected');
      selectedCell = null;
    }
  });

  inicializarToggleColumnas();
  renderZoom();

  // NOTA: initWorkflowBridge comentado porque ahora usamos FlujoAutorizacion
  // que maneja todo el workflow automáticamente desde RESUMEN.html
  // initWorkflowBridge('RESUMEN');
})();
