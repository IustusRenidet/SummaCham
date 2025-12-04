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
      return;
    }
    if (editMode) {
      cancelarEdicion();
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

  const restaurarValoresOriginales = () => {
    if (!summaryBody) return;
    Array.from(summaryBody.querySelectorAll('.editable-cell')).forEach((celda) => {
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

  const manejarBlurCelda = (event) => {
    const celda = event.currentTarget;
    const fila = celda.closest('tr');
    const cuenta = fila?.dataset.cuenta21 || fila?.dataset.cuenta;
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

  // Compatibilidad: algunos layouts antiguos esperaban esta función.
  // Hoy el capítulo se deriva de la empresa activa, pero aquí podemos
  // también mostrar y permitir cambiar la selección.
  const SECTION_PRIORITY = [
    'MEMBERSHIP',
    'EVENTS',
    'COMMITTEES',
    'T&IC',
    'SERVICES TO MEMBERS',
    'GUADALAJARA',
    'MONTERREY',
    'NORTHWEST',
    'GASTOS ADMINISTRATIVOS',
    'GASTOS GENERALES',
    'NOMINA',
    'GASTOS CORPORATIVOS',
    'CARGOS ADMINISTRATIVOS',
    'MEMBER CENTRICITY',
    'OTHER',
    'OTHER INCOME'
  ];

  const SECTION_PRIORITY_DEFAULT = SECTION_PRIORITY.length;
  const sectionPriority = (label) => {
    const text = normalizeText(label);
    for (let idx = 0; idx < SECTION_PRIORITY.length; idx += 1) {
      if (text.includes(SECTION_PRIORITY[idx])) {
        return idx;
      }
    }
    return SECTION_PRIORITY_DEFAULT;
  };

  const PRINCIPAL_PRIORITY = [
    'INCOME',
    'EXPENSE',
    'OPERATING',
    'OTHER'
  ];

  const COLUMN_TOOLTIPS = {
    actualMonth: 'Real del mes consultado. Suma los campos real[mes] del servicio de planeacion (saldos Firebird) para cada cuenta definida en "CUENTAS SUMMARY Y RESUMEN.xlsx".',
    planMonth: 'Presupuesto del mes (columnas PRESUP01..12 de la tabla PRESUPYY). Es el dato que se enviara a COI cuando el flujo termine en Guardar en COI.',
    prevMonth: 'Real del mismo mes pero del ano anterior; proviene del mismo origen de saldos para comparar contra el historico inmediato.',
    varMonthPlan: 'Variacion mensual vs plan: ((Real mes - Plan mes) / |Plan mes|) x 100. Usa los montos reales contra los PRESUPXX de la fila o seccion.',
    varMonthPrev: 'Variacion mensual interanual: ((Real mes - Real mes ano anterior) / |Real ano anterior|) x 100.',
    actualYTD: 'Real acumulado de enero al mes consultado (usa los campos real[mes]_acum de planeacion). Representa lo registrado en COI para las cuentas incluidas.',
    planYTD: 'Presupuesto acumulado enero-mes; suma PRESUP01..PRESUPMM de la tabla PRESUPYY siguiendo el orden del libro "CUENTAS SUMMARY Y RESUMEN".',
    prevYTD: 'Real acumulado del mismo periodo del ano previo, usando los campos _acum del set historico.',
    varYTDPlan: 'Variacion acumulada vs plan: ((Real YTD - Plan YTD) / |Plan YTD|) x 100.',
    varYTDPrev: 'Variacion acumulada vs ano anterior: ((Real YTD - Real YTD previo) / |Real YTD previo|) x 100.'
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

  const principalPriority = (label) => {
    const text = normalizeText(label);
    for (let idx = 0; idx < PRINCIPAL_PRIORITY.length; idx += 1) {
      if (text.includes(PRINCIPAL_PRIORITY[idx])) {
        return idx;
      }
    }
    return PRINCIPAL_PRIORITY.length;
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

  const createPercentCell = (val, arg2 = '', rowRole = '') => {
    let tooltipKey = arg2;
    if (typeof arg2 === 'object' && arg2 !== null) {
      tooltipKey = arg2.tooltipKey || '';
      rowRole = arg2.rowRole || rowRole;
    }
    return `<td class="text-end"${columnTooltipAttr(tooltipKey)}${summaryRowTooltipAttr(rowRole)}>${formatPercent(val)}</td>`;
  };

  const createEditableCell = (val, options = {}) => {
    const {
      columnKey = '',
      tooltipKey = '',
      rowRole = '',
      classes = ''
    } = options;
    const classList = ['text-end', 'editable-cell'];
    if (classes) classList.push(classes);
    const attrs = [
      `class="${classList.join(' ')}"`,
      `data-valor-original="${Number(val ?? 0)}"`
    ];
    if (columnKey) {
      attrs.push(`data-columna-clave="${columnKey}"`);
    }
    return `<td ${attrs.join(' ')}${columnTooltipAttr(tooltipKey)}${summaryRowTooltipAttr(rowRole)}>${formatNumber(val)}</td>`;
  };

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
      ${createCell(totals.actualMonth, { bold: boldNumbers, tooltipKey: 'actualMonth', rowRole })}
      ${createCell(totals.planMonth, { bold: boldNumbers, tooltipKey: 'planMonth', rowRole })}
      ${createCell(totals.prevMonth, { bold: boldNumbers, tooltipKey: 'prevMonth', rowRole })}
      ${createPercentCell(varMonthPlan, { tooltipKey: 'varMonthPlan', rowRole })}
      ${createPercentCell(varMonthPrev, { tooltipKey: 'varMonthPrev', rowRole })}
      <td class="${labelClasses}"${summaryRowTooltipAttr(rowRole)}>${label}</td>
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
        const seccionesOrdenadas = sortSections(principal.children || []);

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
              'La descripción es libre y no se guarda en Firebird'
            ].join(' - ');
            ctaRow.setAttribute('title', detalleCuenta);
            ctaRow.setAttribute('data-bs-toggle', 'tooltip');
            ctaRow.innerHTML = `
              <td class="font-monospace small text-start account-column">${cta.cuenta || ''}</td>
              ${createCell(cta.actualMonth, { tooltipKey: 'actualMonth', rowRole: 'account' })}
              ${createEditableCell(cta.planMonth, { columnKey: planColumnKey, tooltipKey: 'planMonth', rowRole: 'account' })}
              ${createCell(cta.prevMonth, { tooltipKey: 'prevMonth', rowRole: 'account' })}
              ${createPercentCell(ctaVarMonthPlan, { tooltipKey: 'varMonthPlan', rowRole: 'account' })}
              ${createPercentCell(ctaVarMonthPrev, { tooltipKey: 'varMonthPrev', rowRole: 'account' })}
              <td class="text-center"${summaryRowTooltipAttr('account')}>${cta.descripcion || ''}</td>
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
        sortPrincipals(principales).forEach(renderPrincipal);
      }
    });
    sincronizarCeldasEditables();
    activateTooltips();

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
    const sesion = Sesion.requerirSesion();
    if (!sesion) return;

    const empresa = Sesion.obtenerEmpresaActiva(sesion);
    if (!empresa?.id) {
      showStatus('Selecciona una empresa para continuar.', 'warning');
      return;
    }

    const modulo = document.body?.dataset?.modulo || 'summary';
    const publicarContexto = (anio) => {
      window.dispatchEvent(new CustomEvent('planeacion:contexto-actualizado', {
        detail: { empresaId: empresa.id, anio, modulo }
      }));
    };

    empresaActual = empresa;
    await aplicarEmpresa(empresaActual.id);

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
    window.addEventListener(Sesion.EVENTO_EMPRESA, async (event) => {
      const nuevaEmpresa = event?.detail?.empresa;
      if (!nuevaEmpresa?.id) return;
      empresaActual = nuevaEmpresa;
      await aplicarEmpresa(empresaActual.id);
    });
  });
})();
