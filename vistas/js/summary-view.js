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
  let mesClaveActual = 'dic';
  let mesNumeroActual = 12;
  const leerAnioSeleccionado = () => Number(selectAnio?.value) || new Date().getFullYear();
  const leerMesSeleccionado = () => Number(selectMes?.value) || (new Date().getMonth() + 1);
  const obtenerSelectorGlobalEmpresa = () => window.parent?.document?.getElementById('companyFilter') || null;
  const sincronizarSelectorEmpresaGlobal = () => {
    const selector = obtenerSelectorGlobalEmpresa();
    if (!selector) return;
    selector.addEventListener('change', async () => {
      const nuevoId = selector.value;
      if (!nuevoId) return;
      const empresaLocal = Sesion.obtenerEmpresaActiva();
      if (empresaLocal?.id === nuevoId) return;
      Sesion.establecerEmpresaActiva(nuevoId);
      empresaActual = Sesion.obtenerEmpresaActiva();
      await aplicarEmpresa(empresaActual?.id);
    });
  };
  const obtenerCapituloEmpresa = (empresaId) => {
    return window.CapitulosModulos?.obtenerCapituloPorEmpresa?.(empresaId) || null;
  };

  const actualizarMesContexto = (mesSeleccionado) => {
    const numero = Number(mesSeleccionado);
    const info = MESES.find((item) => item.periodo === numero);
    if (info) {
      mesClaveActual = info.clave;
      mesNumeroActual = info.periodo;
    }
  };

  const cambiosPendientes = new Map();
  let editMode = false;

  const normalizeText = (texto) => (texto || '').toString().normalize('NFD').replace(/\p{Diacritic}/gu, '').toUpperCase();

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

  const escapeAttr = (texto = '') => texto.toString().replace(/"/g, '&quot;');

  const limpiarCambios = () => {
    cambiosPendientes.clear();
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

  const sincronizarCeldasEditables = () => {
    if (!summaryBody) return;
    const celdas = Array.from(summaryBody.querySelectorAll('.editable-cell'));
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

  const establecerModoEdicion = (flag) => {
    const habilitar = Boolean(flag);
    if (habilitar) {
      if (editMode) return;
      editMode = true;
      sincronizarCeldasEditables();
      if (window.ModoEdicionPresupuesto?.activar) {
        try { window.ModoEdicionPresupuesto.activar(); } catch (e) { /* ignore */ }
      }
      return;
    }
    if (editMode) {
      cancelarEdicion();
      if (window.ModoEdicionPresupuesto?.desactivar) {
        try { window.ModoEdicionPresupuesto.desactivar(); } catch (e) { /* ignore */ }
      }
    }
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

  const parseText = (texto) => (texto || '').toString().trim();

  const restaurarValoresOriginales = () => {
    if (!summaryBody) return;
    Array.from(summaryBody.querySelectorAll('.editable-cell')).forEach((celda) => {
      const columna = celda.dataset.columnaClave;
      const esTexto = columna === 'cuenta' || columna === 'descripcion' || columna === 'nombre';
      const originalRaw = celda.dataset.valorOriginal ?? '';
      
      if (esTexto) {
        // Campos de texto
        celda.textContent = originalRaw;
      } else {
        // Campos numéricos
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

  const manejarBlurCelda = (event) => {
    const celda = event.currentTarget;
    const fila = celda.closest('tr');
    const cuenta = fila?.dataset.cuenta21 || fila?.dataset.cuenta;
    const columna = celda.dataset.columnaClave;
    if (!cuenta || !columna) return;

    const esTexto = columna === 'cuenta' || columna === 'descripcion' || columna === 'nombre';
    const originalRaw = celda.dataset.valorOriginal ?? '';

    if (esTexto) {
      const original = parseText(originalRaw);
      const nuevoTexto = parseText(celda.textContent);
      if (nuevoTexto !== original) {
        celda.textContent = nuevoTexto;
        registrarCambio(cuenta, columna, nuevoTexto, original);
        // Si se editó la cuenta, actualizar dataset en la fila para persistencia de layout
        if (columna === 'cuenta' && fila) {
          fila.dataset.cuenta = nuevoTexto || '';
          // también actualizar cuentaVisible si aplica
          fila.dataset.cuentaVisible = nuevoTexto || '';
        }
        // Si es columna de layout (cuenta/descripcion) persistir layout local
        if ((columna === 'cuenta' || columna === 'descripcion') && window.ModoEdicionPresupuesto?.guardarLayout) {
          try { window.ModoEdicionPresupuesto.guardarLayout(); } catch (err) { /* ignore */ }
        }
      } else {
        celda.textContent = original;
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
  // Compatibilidad: exponer funciones de layout del editor de modo-edicion
  window.CuentasModulo.guardarLayout = () => window.ModoEdicionPresupuesto?.guardarLayout?.() || false;
  window.CuentasModulo.cargarLayoutLocal = () => window.ModoEdicionPresupuesto?.cargarLayoutLocal?.() || null;
  window.CuentasModulo.aplicarLayoutLocal = (l) => window.ModoEdicionPresupuesto?.aplicarLayoutLocal?.(l) || false;

  // Compatibilidad: algunos layouts antiguos esperaban esta función.
  // Hoy el capítulo se deriva de la empresa activa, pero aquí podemos
  // también mostrar y permitir cambiar la selección.
  const COLUMN_TOOLTIPS = {
    actualMonth: 'Real del mes consultado (año seleccionado).',
    planMonth: 'Presupuesto del mes (tabla PRESUPYY del año seleccionado).',
    prevMonth: 'Real del mismo mes del año previo.',
    varMonthPlan: 'B/W mes vs presupuesto: Real / Presupuesto * 100.',
    varMonthPrev: 'B/W mes vs real año previo: Real / Real año previo * 100.',
    actualYTD: 'Real acumulado al mes consultado (año seleccionado).',
    planYTD: 'Presupuesto acumulado al mes consultado (año seleccionado).',
    prevYTD: 'Real acumulado al mes consultado pero del año previo.',
    varYTDPlan: 'B/W YTD vs presupuesto acumulado: Real YTD / Presupuesto YTD * 100.',
    varYTDPrev: 'B/W YTD vs real acumulado año previo: Real YTD / Real YTD previo * 100.'
  };

  const ROW_TOOLTIPS = {
    account: 'Cuenta individual del catalogo SUMMARY/RESUMEN. El real viene de los saldos por NUM_CTA y el presupuesto de PRESUPYY; la descripcion editable no se guarda en Firebird.',
    section: 'Total de seccion ("sum-row" del Excel). Agrupa todas las cuentas hijas antes de pasar al bloque principal y usa sumatoria directa.',
    principal: 'Bloque principal (Income, Expense, Operating, Other, etc.). Replica los encabezados del libro y respeta el signo configurado para cada clase.',
    group: 'Fila consolidada (CONSOLIDATED INCOME/EXPENSES, Operating Results preliminar, etc.). Se genera cuando varias secciones comparten un sum-row-sumavarios.',
    result: 'Operating Results definido en "SUMA DE VARIAS SECCIONES": ingresos menos gastos aplicando los factores establecidos en el Excel.',
    net: 'Net Results por region/segmento. Combina el resultado operativo con otros ingresos/egresos intermedios marcados como net-row.',
    final: 'Consolidated Net Results: cierre final tras sumar otros ingresos ("OTHER INCOME") al Operating Result.'
  };

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
    if (numero === 0) return 'Ignora';
    if (numero === 0.5) return 'Divide entre 2';
    if (numero === 2) return 'Duplica';
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
    if (!role) return '';
    switch (role) {
      case 'section': {
        const cuentas = Array.isArray(context.cuentas) ? context.cuentas : [];
        const nombres = cuentas
          .map((cta) => cta.descripcion || cta.cuenta || cta.cuentaCanonica || '')
          .filter(Boolean);
        const listado = formatList(nombres, 4);
        const principal = context.principal ? ` del principal "${context.principal}"` : '';
        const base = `Seccion "${context.label || ''}"${principal} acumula los saldos reales y presupuestos de ${cuentas.length} cuentas`;
        return `${base}${listado ? ` (${listado})` : ''}. Real: servicio de planeacion (COI). Presupuesto: columnas PRESUP01..12.`;
      }
      case 'principal': {
        const secciones = formatList(context.sections || [], 5);
        const signo = Number(context.sign) < 0 ? 'resta (gastos)' : 'suma (ingresos)';
        return `Principal "${context.label || ''}" ${signo} los totales de las secciones ${secciones || 'definidas en el capitulo'} antes de integrarse al consolidado.`;
      }
      case 'group': {
        const detalle = describirOperaciones(context.operaciones || []);
        if (detalle) {
          return `Grupo "${context.label || ''}" consolida los principales: ${detalle}.`;
        }
        const lista = formatList(context.principals || [], 6);
        return `Grupo "${context.label || ''}" consolida los principales ${lista || ''} mediante sumatoria directa.`;
      }
      case 'result':
      case 'net':
      case 'final': {
        const detalle = describirOperaciones(context.operaciones || []);
        const tipo = role === 'result'
          ? 'resultado operativo (ingresos - gastos)'
          : role === 'net'
            ? 'neto intermedio (operativo + otros ingresos/gastos)'
            : 'neto consolidado';
        if (detalle) {
          return `Fila "${context.label || ''}" (${tipo}) aplica las operaciones: ${detalle}.`;
        }
        return `Fila "${context.label || ''}" (${tipo}) combina los principales segun el mapeo del Excel.`;
      }
      default:
        return ROW_TOOLTIPS[role] || '';
    }
  };

  const columnTooltipAttr = (key) => (key && COLUMN_TOOLTIPS[key]
    ? ` title="${escapeAttr(COLUMN_TOOLTIPS[key])}" data-bs-toggle="tooltip"`
    : '');

  const summaryRowTooltipAttr = (role) => (role ? ` data-row-role="${role}"` : '');

  const ordenarPorOrden = (items = [], extractor) => {
    return (Array.isArray(items) ? items : []).map((item, idx) => ({
      item,
      idx,
      orden: extractor(item, idx)
    })).sort((a, b) => a.orden - b.orden).map(({ item }) => item);
  };

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
      selectCapitulo.disabled = false;
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
    selectCapitulo.disabled = false;
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
    if (Math.abs(baseNum) === 0) return 0;
    return safeDiv(actualNum, baseNum) * 100;
  };

  const formatPercent = (val) => {
    if (!Number.isFinite(val)) return '0.00%';
    return val.toFixed(2) + '%';
  };

  /**
   * Crea una celda HTML <td> con valor numérico formateado
   * 
   * Esta función genera celdas para las columnas numéricas de la tabla:
   * Actual Month, Plan Month, Prev Month, YTD, etc.
   * 
   * Aplica:
   * - Formato de número con separadores de miles y decimales
   * - Alineación a la derecha (text-end)
   * - Negrita opcional para filas de totales
   * - Tooltips con información de columna
   * 
   * @param {number} val - Valor numérico a mostrar
   * @param {boolean|Object} arg2 - Si boolean: bold; si Object: {bold, tooltipKey, rowRole, classes}
   * @param {string} tooltipKey - Clave del tooltip (ej: 'actualMonth')
   * @param {string} rowRole - Rol de la fila (account, section, principal, etc.)
   * @returns {string} HTML de la celda <td>
   */
  const createCell = (val, arg2 = false, tooltipKey = '', rowRole = '') => {
    let bold = arg2;
    let extraClasses = '';
    if (typeof arg2 === 'object' && arg2 !== null) {
      bold = Boolean(arg2.bold);
      tooltipKey = arg2.tooltipKey || tooltipKey;
      rowRole = arg2.rowRole || rowRole;
      extraClasses = arg2.classes || '';
    }
    const classes = ['text-end'];
    if (bold) classes.push('fw-bold');
    if (extraClasses) classes.push(extraClasses);
    return `<td class="${classes.join(' ')}"${columnTooltipAttr(tooltipKey)}${summaryRowTooltipAttr(rowRole)}>${formatNumber(val)}</td>`;
  };

  /**
   * Crea una celda HTML <td> con valor porcentual formateado
   * 
   * Genera celdas para las columnas de variaciones porcentuales:
   * - Var% Month Plan: variación del mes vs presupuesto
   * - Var% Month Prev: variación del mes vs año anterior
   * - Var% YTD Plan: variación acumulada vs presupuesto
   * - Var% YTD Prev: variación acumulada vs año anterior
   * 
   * Formato: muestra "+5.2%" o "-3.8%" con signo y color
   * 
   * @param {number} val - Valor decimal (ej: 0.052 para 5.2%)
   * @param {string|Object} arg2 - Si string: tooltipKey; si Object: {tooltipKey, rowRole}
   * @param {string} rowRole - Rol de la fila
   * @returns {string} HTML de la celda <td>
   */
  const createPercentCell = (val, arg2 = '', rowRole = '') => {
    let tooltipKey = arg2;
    if (typeof arg2 === 'object' && arg2 !== null) {
      tooltipKey = arg2.tooltipKey || '';
      rowRole = arg2.rowRole || rowRole;
    }
    return `<td class="text-end"${columnTooltipAttr(tooltipKey)}${summaryRowTooltipAttr(rowRole)}>${formatPercent(val)}</td>`;
  };

  /**
   * Crea una celda HTML <td> editable o de solo lectura
   * 
   * En Summary, SOLO cuenta y descripcion son realmente editables.
   * El resto de columnas se marcan como read-only-cell.
   * 
   * CAMPOS EDITABLES (text=true):
   * - cuenta: Código de cuenta contable (ej: "4101-010")
   * - descripcion: Nombre descriptivo de la cuenta (ej: "VENTAS")
   * 
   * IMPORTANTE: Estos campos son VISUALES SOLAMENTE.
   * No se guardan en Firebird, solo se persisten localmente.
   * 
   * La celda almacena:
   * - data-valor-original: valor inicial para detectar cambios
   * - data-editable-real: true/false si realmente es editable
   * - data-columna-clave: nombre de la columna (cuenta, descripcion, etc.)
   * 
   * @param {string|number} val - Valor a mostrar
   * @param {Object} options - Opciones
   * @param {string} options.columnKey - Clave de columna (cuenta, descripcion, etc.)
   * @param {string} options.tooltipKey - Clave del tooltip
   * @param {string} options.rowRole - Rol de la fila
   * @param {string} options.classes - Clases CSS adicionales
   * @param {boolean} options.text - Si true, es texto; si false, es número
   * @returns {string} HTML de la celda <td>
   */
  const createEditableCell = (val, options = {}) => {
    const {
      columnKey = '',
      tooltipKey = '',
      rowRole = '',
      classes = '',
      text = false
    } = options;
    // Determinar si la columna es realmente editable en SUMMARY
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
    const content = text ? escapeAttr(val ?? '') : formatNumber(val);
    return `<td ${attrs.join(' ')}${columnTooltipAttr(tooltipKey)}${summaryRowTooltipAttr(rowRole)}>${content}</td>`;
  };

  /**
   * Extrae valores totales de un nodo del árbol jerárquico de Summary
   * 
   * Summary organiza cuentas en un árbol jerárquico donde cada nodo
   * puede tener totales acumulados. Esta función normaliza los diferentes
   * nombres que pueden tener estos totales.
   * 
   * @param {Object} nodo - Nodo del árbol con totales calculados
   * @returns {Object} Objeto con los 6 valores totales estandarizados:
   *   - actualMonth: Real del mes actual
   *   - planMonth: Plan/presupuesto del mes actual
   *   - prevMonth: Real del mes anterior (mismo mes año previo)
   *   - actualYTD: Real acumulado año a la fecha (Year To Date)
   *   - planYTD: Plan acumulado año a la fecha
   *   - prevYTD: Real acumulado año previo a la fecha
   */
  const extractTotals = (nodo = {}) => ({
    actualMonth: toNumber(nodo.actualMonth ?? nodo.totalActualMonth),
    planMonth: toNumber(nodo.planMonth ?? nodo.totalPlanMonth),
    prevMonth: toNumber(nodo.prevMonth ?? nodo.totalPrevMonth),
    actualYTD: toNumber(nodo.actualYTD ?? nodo.totalActualYTD),
    planYTD: toNumber(nodo.planYTD ?? nodo.totalPlanYTD),
    prevYTD: toNumber(nodo.prevYTD ?? nodo.totalPrevYTD)
  });

  /**
   * Crea una fila de totales con 12 columnas de datos financieros
   * 
   * Esta función genera filas especiales que muestran totales acumulados,
   * por ejemplo: "TOTAL REVENUE", "TOTAL EXPENSES", "NET INCOME".
   * 
   * Las 12 columnas son:
   * - Actual Month: Real del mes
   * - Plan Month: Presupuesto del mes
   * - Prev Month: Real mes anterior
   * - Var% Month Plan: Variación porcentual vs presupuesto del mes
   * - Var% Month Prev: Variación porcentual vs mes anterior
   * - Actual YTD: Real acumulado del año
   * - Plan YTD: Presupuesto acumulado del año
   * - Prev YTD: Real acumulado año anterior
   * - Var% YTD Plan: Variación porcentual acumulada vs presupuesto
   * - Var% YTD Prev: Variación porcentual acumulada vs año anterior
   * 
   * @param {Object} nodo - Nodo con los valores totales
   * @param {Object} options - Opciones de formato (label, rowClass, etc.)
   * @returns {HTMLTableRowElement} Fila HTML con los totales formateados
   */
  const createTotalsRow = (nodo, options = {}) => {
    const {
      label = '',
      rowClass = '',
      labelClasses = 'text-center text-primary text-uppercase',
      boldNumbers = false,
      rowRole = '',
      rowContext = null
    } = options;

    const totals = extractTotals(nodo);
    const varMonthPlan = calculateVar(totals.actualMonth, totals.planMonth);
    const varMonthPrev = calculateVar(totals.actualMonth, totals.prevMonth);
    const varYTDPlan = calculateVar(totals.actualYTD, totals.planYTD);
    const varYTDPrev = calculateVar(totals.actualYTD, totals.prevYTD);

    const row = document.createElement('tr');
    row.className = rowClass || '';
    if (rowRole) {
      row.dataset.rowRole = rowRole;
    }
    const contextoTooltip = buildRowContextTooltip(rowRole, rowContext || {});
    if (contextoTooltip) {
      row.setAttribute('title', contextoTooltip);
      row.setAttribute('data-bs-toggle', 'tooltip');
    } else if (rowRole && ROW_TOOLTIPS[rowRole]) {
      row.setAttribute('title', ROW_TOOLTIPS[rowRole]);
      row.setAttribute('data-bs-toggle', 'tooltip');
    }
    row.innerHTML = `
      <td class="account-column"></td>
      <td class="${labelClasses}"${summaryRowTooltipAttr(rowRole)}>${label}</td>
      ${createCell(totals.actualMonth, { bold: boldNumbers, tooltipKey: 'actualMonth', rowRole })}
      ${createCell(totals.planMonth, { bold: boldNumbers, tooltipKey: 'planMonth', rowRole })}
      ${createCell(totals.prevMonth, { bold: boldNumbers, tooltipKey: 'prevMonth', rowRole })}
      ${createPercentCell(varMonthPlan, { tooltipKey: 'varMonthPlan', rowRole })}
      ${createPercentCell(varMonthPrev, { tooltipKey: 'varMonthPrev', rowRole })}
      ${createCell(totals.actualYTD, { bold: boldNumbers, tooltipKey: 'actualYTD', rowRole })}
      ${createCell(totals.planYTD, { bold: boldNumbers, tooltipKey: 'planYTD', rowRole })}
      ${createCell(totals.prevYTD, { bold: boldNumbers, tooltipKey: 'prevYTD', rowRole })}
      ${createPercentCell(varYTDPlan, { tooltipKey: 'varYTDPlan', rowRole })}
      ${createPercentCell(varYTDPrev, { tooltipKey: 'varYTDPrev', rowRole })}
    `;
    return row;
  };

  const actualizarEtiquetaMes = (mesSeleccionado) => {
    const etiqueta = MESES.find((m) => m.periodo === mesSeleccionado)?.etiqueta || '';
    document.querySelectorAll('.mes').forEach((span) => {
      span.textContent = etiqueta.toUpperCase();
    });

    const idx = MESES.findIndex((m) => m.periodo === mesSeleccionado);
    const prev = idx > 0 ? MESES[idx - 1] : null;
    const etiquetaPrev = prev ? prev.etiqueta : 'N/A';
    document.querySelectorAll('.mes-anterior').forEach((span) => {
      span.textContent = etiquetaPrev.toUpperCase();
    });
  };

  const actualizarEtiquetasAnio = (anioActual, anioComparativo) => {
    const anioNum = Number(anioActual);
    // El comparativo ahora es mes anterior del mismo ejercicio
    const etiquetaActual = Number.isFinite(anioNum) ? anioNum : '-';
    const etiquetaAnterior = Number.isFinite(anioNum) ? anioNum - 1 : '-';

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

  const disposeTooltips = () => {
    if (!window.bootstrap?.Tooltip) return;
    document.querySelectorAll('[data-bs-toggle="tooltip"]').forEach((el) => {
      const instance = window.bootstrap.Tooltip.getInstance(el);
      if (instance) {
        instance.dispose();
      }
    });
  };

  const activateTooltips = () => {
    if (!window.bootstrap?.Tooltip) return;
    document.querySelectorAll('[data-bs-toggle="tooltip"]').forEach((el) => {
      window.bootstrap.Tooltip.getOrCreateInstance(el);
    });
  };

  /**
   * Renderiza/pinta la tabla de Summary con estructura jerárquica
   * 
   * Summary muestra datos consolidados multi-empresa con estructura de árbol:
   * Capitulo → Principal → Sección → Cuenta
   * 
   * JERARQUÍA DE SUMMARY:
   * - Capitulo: Empresa (EMPRESA01, EMPRESA02, etc.)
   * - Principal: Categoría principal (REVENUE, EXPENSES, etc.)
   * - Sección: Subcategoría (SALES, OPERATING EXPENSES, etc.)
   * - Cuenta: Cuenta contable individual con valores
   * 
   * LAYOUT PERSONALIZADO:
   * Si existe capitulo.layout, sigue ese orden y agrupaciones:
   * - type: 'group' → Agrupa varios principals y muestra subtotal
   * - type: 'net' → Muestra resultado neto (REVENUE - EXPENSES)
   * - type: 'final' → Muestra resultado final (NET INCOME)
   * 
   * COLUMNAS (12 en total):
   * 1-2: Cuenta y Descripción (editables solo visualmente)
   * 3: Actual Month - Real del mes
   * 4: Plan Month - Presupuesto del mes
   * 5: Prev Month - Real del mes anterior (año previo)
   * 6: Var% Month Plan - Variación vs presupuesto
   * 7: Var% Month Prev - Variación vs mes anterior
   * 8: Actual YTD - Real acumulado del año
   * 9: Plan YTD - Presupuesto acumulado
   * 10: Prev YTD - Real acumulado año anterior
   * 11: Var% YTD Plan - Variación acumulada vs presupuesto
   * 12: Var% YTD Prev - Variación acumulada vs año anterior
   * 
   * @param {Array} resumen - Array de capitulos con estructura jerárquica
   * @param {number} mesSeleccionado - Mes seleccionado (1-12)
   */
  const renderSummary = (resumen = [], mesSeleccionado) => {
    if (!summaryBody) return;
    limpiarCambios();
    editMode = false;
    disposeTooltips();
    summaryBody.innerHTML = '';

    if (!resumen.length) {
      summaryBody.innerHTML = '<tr><td colspan="12" class="text-center">Sin datos disponibles.</td></tr>';
      return;
    }

    const mesInfo = MESES.find((item) => item.periodo === Number(mesSeleccionado));
    const claveMesRender = mesInfo?.clave || mesClaveActual;
    const planColumnKey = `budget-${claveMesRender}`;

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
          const seccionLabel = seccion.label || '';
          (seccion.cuentas || []).forEach((cta) => {
            const ctaVarMonthPlan = calculateVar(cta.actualMonth, cta.planMonth);
            const ctaVarMonthPrev = calculateVar(cta.actualMonth, cta.prevMonth);
            const ctaVarYTDPlan = calculateVar(cta.actualYTD, cta.planYTD);
            const ctaVarYTDPrev = calculateVar(cta.actualYTD, cta.prevYTD);

            const ctaRow = document.createElement('tr');
            ctaRow.dataset.rowRole = 'account';
            ctaRow.dataset.cuenta = cta.cuentaCanonica || cta.cuenta || '';
            ctaRow.dataset.cuenta21 = cta.cuentaCanonica || '';
            ctaRow.dataset.cuentaVisible = cta.cuenta || '';
            const detalleCuenta = [
              `Cuenta ${cta.cuenta || 'sin codigo'} - Sección ${seccionLabel || 'sin sección'}${principal.label ? ` - Principal ${principal.label}` : ''}`,
              'Real: planeación COI (saldos mensuales y acumulados)',
              `Presupuesto: columnas ${planColumnKey.toUpperCase()} / PRESUP01-12 (PRESUPYY)`,
              'Editar solo cuenta/descripcion para referencia'
            ].join(' - ');
            ctaRow.setAttribute('title', detalleCuenta);
            ctaRow.setAttribute('data-bs-toggle', 'tooltip');
            ctaRow.innerHTML = `
              ${createEditableCell(cta.cuenta || '', { columnKey: 'cuenta', text: true, rowRole: 'account', classes: 'font-monospace small account-column text-start' })}
              ${createEditableCell(cta.descripcion || '', { columnKey: 'descripcion', text: true, rowRole: 'account', classes: 'text-start' })}
              ${createCell(cta.actualMonth, { tooltipKey: 'actualMonth', rowRole: 'account' })}
              ${createCell(cta.planMonth, { tooltipKey: 'planMonth', rowRole: 'account' })}
              ${createCell(cta.prevMonth, { tooltipKey: 'prevMonth', rowRole: 'account' })}
              ${createPercentCell(ctaVarMonthPlan, { tooltipKey: 'varMonthPlan', rowRole: 'account' })}
              ${createPercentCell(ctaVarMonthPrev, { tooltipKey: 'varMonthPrev', rowRole: 'account' })}
              ${createCell(cta.actualYTD, { tooltipKey: 'actualYTD', rowRole: 'account' })}
              ${createCell(cta.planYTD, { tooltipKey: 'planYTD', rowRole: 'account' })}
              ${createCell(cta.prevYTD, { tooltipKey: 'prevYTD', rowRole: 'account' })}
              ${createPercentCell(ctaVarYTDPlan, { tooltipKey: 'varYTDPlan', rowRole: 'account' })}
              ${createPercentCell(ctaVarYTDPrev, { tooltipKey: 'varYTDPrev', rowRole: 'account' })}
            `;
            summaryBody.appendChild(ctaRow);
          });

        summaryBody.appendChild(createTotalsRow(seccion, {
          label: seccion.label || '',
          rowClass: 'subsection-row fw-semibold text-center',
          labelClasses: 'text-start text-primary',
          boldNumbers: true,
          rowRole: 'section',
          rowContext: {
            label: seccion.label || '',
            principal: principal.label || '',
            cuentas: seccion.cuentas || []
          }
        }));
      });

      summaryBody.appendChild(createTotalsRow(principal, {
        label: principal.label || '',
        rowClass: 'section-header-row table-light fw-bold text-center',
        labelClasses: 'text-center text-secondary text-uppercase',
        boldNumbers: true,
        rowRole: 'principal',
        rowContext: {
          label: principal.label || '',
          sections: seccionesOrdenadas.map((sec) => sec.label || ''),
          sign: principal.sign
        }
      }));
    };

      if (layout && layout.length) {
        layout.forEach((block) => {
          if (block.type === 'group') {
            (block.principals || []).forEach((label) => {
              renderPrincipal(principalLookup.get(label));
            });
            summaryBody.appendChild(createTotalsRow(block.totals || {}, {
              label: block.label || '',
              rowClass: 'highlight-secondary fw-bold text-center',
              labelClasses: 'text-center text-uppercase',
              boldNumbers: true,
              rowRole: 'group',
              rowContext: {
                label: block.label || '',
                principals: block.principals || [],
                operaciones: block.operaciones || []
              }
            }));
          } else {
            const rowClass = block.type === 'final'
              ? 'highlight-bright fw-bold text-center'
              : block.type === 'net'
                ? 'highlight-secondary fw-bold text-center'
                : 'highlight-primary fw-bold text-center';
            summaryBody.appendChild(createTotalsRow(block.totals || {}, {
              label: block.label || '',
              rowClass,
              labelClasses: 'text-center text-uppercase',
              boldNumbers: true,
              rowRole: block.type || 'result',
              rowContext: {
                label: block.label || '',
                type: block.type || 'result',
                operaciones: block.operaciones || []
              }
            }));
          }
        });
      } else {
        const ordenados = ordenarPorOrden(principales, (p, idx) => {
          const orden = Number.isFinite(Number(p?.orden)) ? Number(p.orden) : Number.isFinite(Number(p?.order)) ? Number(p.order) : null;
          return orden != null ? orden : idx;
        });
        ordenados.forEach(renderPrincipal);
      }
    });
    sincronizarCeldasEditables();
    activateTooltips();

    if (mesSeleccionado) {
      actualizarEtiquetaMes(mesSeleccionado);
    }
  };


  /**
   * Renderiza la tabla de agregados por ciudad/empresa
   * 
   * Esta tabla consolida los totales de todas las empresas/ciudades
   * en una vista resumida. Es útil para ver el consolidado multi-empresa.
   * 
   * Proceso:
   * 1. Recorre todos los nodos del resumen
   * 2. Para cada hijo (empresa), acumula su total
   * 3. Agrupa por clave de empresa (empresa1, empresa2, etc.)
   * 4. Renderiza una fila por empresa con su total acumulado
   * 
   * @param {Array} resumen - Array de nodos jerárquicos con datos de empresas
   */
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
      console.warn('Workflow Summary', err);
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
    // Persistir layout localmente si el editor lo soporta (cuenta/descripcion)
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
  // --- fin workflow bridge ---

  const aplicarEmpresa = async (empresaId) => {
    if (!empresaId) return;
    if (selectMes) {
      selectMes.value = String(new Date().getMonth() + 1);
    }
    actualizarMesContexto(Number(selectMes?.value || new Date().getMonth() + 1));
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
    actualizarMesContexto(mes ?? leerMesSeleccionado());
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
    try { window.ModoEdicionPresupuesto?.inicializar?.(); } catch (e) { /* ignore */ }
    const sesion = Sesion.requerirSesion();
    if (!sesion) return;

    const empresa = Sesion.obtenerEmpresaActiva(sesion);
    if (!empresa?.id) {
      showStatus('Selecciona una empresa para continuar.', 'warning');
      return;
    }

    const modulo = (document.body?.dataset?.modulo || 'SUMMARY').toString().toUpperCase();
    const publicarContexto = (anio) => {
      window.dispatchEvent(new CustomEvent('planeacion:contexto-actualizado', {
        detail: { empresaId: empresa.id, anio, modulo }
      }));
    };

    empresaActual = empresa;
    await aplicarEmpresa(empresaActual.id);
    // Aplicar layout guardado localmente (si existe)
    try {
      const layoutLocal = window.CuentasModulo?.cargarLayoutLocal?.();
      if (layoutLocal && window.CuentasModulo?.aplicarLayoutLocal) {
        window.CuentasModulo.aplicarLayoutLocal(layoutLocal);
      } else if (layoutLocal && window.ModoEdicionPresupuesto?.aplicarLayoutLocal) {
        window.ModoEdicionPresupuesto.aplicarLayoutLocal(layoutLocal);
      }
    } catch (err) {
      console.warn('Error aplicando layout local en Summary', err);
    }

    const leerCapitulo = () => (selectCapitulo?.value || '').toString().trim();

    const handleAnioChange = () => {
      const anio = leerAnioSeleccionado();
      const mes = leerMesSeleccionado();
      actualizarEtiquetasAnio(anio, anio - 1);
      publicarContexto(anio);
      if (empresaActual?.id) {
        fetchSummary(empresaActual.id, anio, mes, leerCapitulo());
      }
    };

    const handleMesChange = () => {
      const anio = leerAnioSeleccionado();
      const mes = leerMesSeleccionado();
      actualizarMesContexto(mes);
      actualizarEtiquetaMes(mes);
      publicarContexto(anio);
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
      const mesInicial = leerMesSeleccionado();
      actualizarMesContexto(mesInicial);
      actualizarEtiquetaMes(mesInicial);
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

    sincronizarSelectorEmpresaGlobal();
    initWorkflowBridge('SUMMARY');
    window.addEventListener(Sesion.EVENTO_EMPRESA, async (event) => {
      const nuevaEmpresa = event?.detail?.empresa;
      if (!nuevaEmpresa?.id) return;
      empresaActual = nuevaEmpresa;
      await aplicarEmpresa(empresaActual.id);
    });
  });
})();
