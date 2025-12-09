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
    return (actualNum / baseNum) * 100;
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

  const parseText = (texto) => (texto || '').toString().trim();

  const COLUMN_TOOLTIPS = {
    actualMonth: 'Real del mes consultado segun el layout RESUMEN. Se alimenta de los saldos reales del servicio de planeacion para las cuentas mapeadas en "CUENTAS SUMMARY Y RESUMEN.xlsx".',
    planMonth: 'Presupuesto del mes (PRESUP01..12 de la tabla PRESUPYY) para las cuentas del bloque seleccionado.',
    prevMonth: 'Real del mes anterior del mismo ejercicio; compara contra el periodo inmediato anterior.',
    varMonthPlan: 'Variacion mensual vs plan: ((Real - Plan) / |Plan|) x 100 con los valores de la fila.',
    varMonthPrev: 'Variacion mensual vs mes anterior: ((Real - Real mes anterior) / |Real mes anterior|) x 100.'
  };

  const ROW_TOOLTIPS = {
    account: 'Cuenta individual del catalogo RESUMEN. Real y presupuesto provienen de los mismos origenes que SUMMARY; la descripcion libre no se guarda en Firebird.',
    section: 'Total de seccion ("sum-row" del Excel). Suma todas las cuentas hijas antes de presentar el bloque principal.',
    principal: 'Subtotal del bloque principal (Income, Expense, Operating, etc.) definido en el libro maestro.',
    group: 'Fila consolidada (CONSOLIDATED INCOME/EXPENSES u Operating Results) que agrupa varios principales.',
    result: 'Operating/Net Results definidos en "SUMA DE VARIAS SECCIONES"; combinan ingresos, gastos y otros ajustes segun el mapeo.'
  };

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
  const createPercentCell = (val, { rowRole = '', tooltipKey = '' } = {}) => `<td class="text-end"${resumenTooltipAttr(tooltipKey)}${resumenRowTooltipAttr(rowRole)}>${formatPercentValue(val)}</td>`;

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
    if (columnKey) attrs.push(`data-columna-clave="${columnKey}"`);
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
    const { label = '', rowRole = 'section', rowClass = '', rowContext = null, labelClasses = 'text-start fw-semibold' } = options;
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
    const tooltip = buildRowContextTooltip(rowRole, rowContext || {}) || ROW_TOOLTIPS[rowRole];
    if (tooltip) {
      row.setAttribute('title', tooltip);
      row.setAttribute('data-bs-toggle', 'tooltip');
    }
    row.innerHTML = `
      <td></td>
      <td class="${labelClasses}"${resumenRowTooltipAttr(rowRole)}>${label}</td>
      ${createCell(totals.actualMonth, { rowRole, tooltipKey: 'actualMonth' })}
      ${createCell(totals.planMonth, { rowRole, tooltipKey: 'planMonth' })}
      ${createCell(totals.prevMonth, { rowRole, tooltipKey: 'prevMonth' })}
      ${createPercentCell(varPlan, { rowRole, tooltipKey: 'varMonthPlan' })}
      ${createPercentCell(varPrev, { rowRole, tooltipKey: 'varMonthPrev' })}
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

    resumen.forEach((capitulo) => {
      const layout = Array.isArray(capitulo.layout) ? capitulo.layout.slice().sort((a, b) => (a.order || 0) - (b.order || 0)) : null;
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
              ${createEditableCell(cta.cuenta || '', { columnKey: 'cuenta', rowRole: 'account', tooltipKey: 'account', text: true, classes: 'font-monospace small text-start' })}
              ${createEditableCell(cta.descripcion || '', { columnKey: 'descripcion', rowRole: 'account', tooltipKey: 'account', text: true, classes: 'text-start' })}
              ${createCell(cta.actualMonth, { rowRole: 'account', tooltipKey: 'actualMonth' })}
              ${createCell(cta.planMonth, { rowRole: 'account', tooltipKey: 'planMonth' })}
              ${createCell(cta.prevMonth, { rowRole: 'account', tooltipKey: 'prevMonth' })}
              ${createPercentCell(varPlan, { rowRole: 'account', tooltipKey: 'varMonthPlan' })}
              ${createPercentCell(varPrev, { rowRole: 'account', tooltipKey: 'varMonthPrev' })}
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
        layout.forEach((block) => {
          const blockType = block.type || '';
          
          // PRINCIPAL: Header de sección principal
          if (blockType === 'principal') {
            tablaBody.appendChild(createResumenTotalsRow(block.totals || {}, {
              label: block.label || '',
              rowRole: 'principal',
              rowClass: 'section-header-row table-info fw-bold text-center',
              rowContext: {
                label: block.label || '',
                sections: (block.children || []).map(ch => ch.label || ''),
                sign: 1
              }
            }));
          }
          // SECUNDARIA: Header de subsección
          else if (blockType === 'secundaria') {
            tablaBody.appendChild(createResumenTotalsRow(block.totals || {}, {
              label: block.label || '',
              rowRole: 'section',
              rowClass: 'subsection-row bg-light fw-semibold text-center',
              rowContext: {
                label: block.label || '',
                principal: '',
                cuentas: block.cuentas || []
              }
            }));
          }
          // CUENTA: Fila de datos
          else if (blockType === 'cuenta') {
            const cta = block.totals || {};
            const varPlan = calculateVar(cta.actualMonth, cta.planMonth);
            const varPrev = calculateVar(cta.actualMonth, cta.prevMonth);
            const varPlanYTD = calculateVar(cta.actualYTD, cta.planYTD);
            const varPrevYTD = calculateVar(cta.actualYTD, cta.prevYTD);

            const row = document.createElement('tr');
            row.className = 'account-row';
            row.dataset.cuenta = block.cuenta || '';
            row.dataset.cuenta21 = block.cuenta || '';
            row.dataset.rowRole = 'account';
            
            row.innerHTML = `
              ${createEditableCell(block.cuenta || '', { columnKey: 'cuenta', rowRole: 'account', tooltipKey: 'account', text: true, classes: 'font-monospace small text-start ps-4' })}
              ${createEditableCell(block.label || '', { columnKey: 'descripcion', rowRole: 'account', tooltipKey: 'account', text: true, classes: 'text-start' })}
              ${createCell(cta.actualMonth, { rowRole: 'account', tooltipKey: 'actualMonth' })}
              ${createCell(cta.planMonth, { rowRole: 'account', tooltipKey: 'planMonth' })}
              ${createCell(cta.prevMonth, { rowRole: 'account', tooltipKey: 'prevMonth' })}
              ${createPercentCell(varPlan, { rowRole: 'account', tooltipKey: 'varMonthPlan' })}
              ${createPercentCell(varPrev, { rowRole: 'account', tooltipKey: 'varMonthPrev' })}
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
            
            tablaBody.appendChild(createResumenTotalsRow(block.totals || {}, {
              label: block.label || '',
              rowRole: blockType,
              rowClass,
              rowContext: {
                label: block.label || '',
                type: blockType,
                principals: block.principals || [],
                operaciones: block.operaciones || []
              }
            }));
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
  };

  const actualizarEtiquetasAnio = (anio) => {
    const yearAct = document.querySelectorAll('.year-act');
    const yearPrev = document.querySelectorAll('.year-prev');
    yearAct.forEach((el) => (el.textContent = anio));
    yearPrev.forEach((el) => (el.textContent = anio));
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
      detail: { empresaId, anio: valorInicial, modulo: (document.body.dataset.modulo || 'RESUMEN').toUpperCase() }
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
    // Aplicar layout guardado localmente (si existe)
    try {
      const layoutLocal = window.CuentasModulo?.cargarLayoutLocal?.();
      if (layoutLocal && window.CuentasModulo?.aplicarLayoutLocal) {
        window.CuentasModulo.aplicarLayoutLocal(layoutLocal);
      } else if (layoutLocal && window.ModoEdicionPresupuesto?.aplicarLayoutLocal) {
        window.ModoEdicionPresupuesto.aplicarLayoutLocal(layoutLocal);
      }
    } catch (err) {
      console.warn('Error aplicando layout local en Resumen', err);
    }

    sincronizarSelectorEmpresaGlobal();

    const handleYearChange = () => {
      const anio = leerAnioSeleccionado();
      const mes = leerMesSeleccionado();
      if (!empresaActual?.id) return;
      actualizarEncabezado(empresaActual.id, anio);
      window.dispatchEvent(new CustomEvent('planeacion:contexto-actualizado', {
        detail: { empresaId: empresaActual.id, anio, modulo: (document.body.dataset.modulo || 'RESUMEN').toUpperCase() }
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
        detail: { empresaId: empresaActual.id, anio, modulo: (document.body.dataset.modulo || 'RESUMEN').toUpperCase() }
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
  const WORKFLOW_LABEL = {
    'sin-cargar': 'Sin cargar',
    borrador: 'Borrador',
    revisado: 'Revisado',
    autorizado: 'Autorizado',
    guardado: 'Guardado en COI'
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
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(data.mensaje || 'No fue posible obtener el estado.');
      workflowEstado.estado = data.estado || 'sin-cargar';
      workflowEstado.actualizadoEn = data.actualizadoEn || null;
      workflowEstado.actualizadoPor = data.actualizadoPor || '';
      workflowEstado.historial = data.historial || [];
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
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(data.mensaje || 'No fue posible registrar la acción.');
      workflowEstado.estado = data.estado || workflowEstado.estado;
      workflowEstado.actualizadoEn = data.actualizadoEn || null;
      workflowEstado.actualizadoPor = data.actualizadoPor || '';
      workflowEstado.historial = data.historial || workflowEstado.historial;
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

  initWorkflowBridge('RESUMEN');
})();
