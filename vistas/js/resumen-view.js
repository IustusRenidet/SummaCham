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
    } else if (editMode) {
      cancelarEdicion();
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

  const createCell = (val, { rowRole = '', classes = '', tooltipKey = '' } = {}) => {
    const classList = ['text-end'];
    if (classes) classList.push(classes);
    return `<td class="${classList.join(' ')}"${resumenTooltipAttr(tooltipKey)}${resumenRowTooltipAttr(rowRole)}>${formatNumber(val)}</td>`;
  };

  const createPercentCell = (val, { rowRole = '', tooltipKey = '' } = {}) => `<td class="text-end"${resumenTooltipAttr(tooltipKey)}${resumenRowTooltipAttr(rowRole)}>${formatPercentValue(val)}</td>`;

  const createEditableCell = (val, {
    columnKey = '',
    rowRole = '',
    tooltipKey = '',
    text = false,
    classes = ''
  } = {}) => {
    const classList = ['editable-cell'];
    classList.push(text ? 'text-start' : 'text-end');
    if (classes) classList.push(classes);
    const attrs = [
      `class="${classList.join(' ')}"`,
      `data-valor-original="${text ? escapeAttr(val ?? '') : Number(val ?? 0)}"`
    ];
    if (columnKey) {
      attrs.push(`data-columna-clave="${columnKey}"`);
    }
    const contenido = text ? escapeAttr(val ?? '') : formatNumber(val);
    return `<td ${attrs.join(' ')}${resumenTooltipAttr(tooltipKey)}${resumenRowTooltipAttr(rowRole)}>${contenido}</td>`;
  };

  const createResumenTotalsRow = (nodo, options = {}) => {
    const { label = '', rowRole = 'section', rowClass = '', rowContext = null, labelClasses = 'text-start fw-semibold' } = options;
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

  const ordenarPorOrden = (items = [], extractor) => {
    return (Array.isArray(items) ? items : []).map((item, idx) => ({
      item,
      idx,
      orden: extractor(item, idx)
    })).sort((a, b) => a.orden - b.orden).map(({ item }) => item);
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
        const seccionesOrdenadas = ordenarPorOrden(principal.children || [], (sec, idx) => {
          const orden = Number.isFinite(Number(sec?.orden)) ? Number(sec.orden) : Number.isFinite(Number(sec?.order)) ? Number(sec.order) : null;
          return orden != null ? orden : idx;
        });

        seccionesOrdenadas.forEach((seccion) => {
          (seccion.cuentas || []).forEach((cta) => {
            const varPlan = calculateVar(cta.actualMonth, cta.planMonth);
            const varPrev = calculateVar(cta.actualMonth, cta.prevMonth);
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

      if (layout && layout.length) {
        layout.forEach((block) => {
          if (block.type === 'group') {
            (block.principals || []).forEach((label) => {
              renderPrincipal(principalLookup.get(label));
            });
            tablaBody.appendChild(createResumenTotalsRow(block.totals || {}, {
              label: block.label || '',
              rowRole: 'group',
              rowClass: 'fw-bold text-uppercase',
              rowContext: {
                label: block.label || '',
                principals: block.principals || [],
                operaciones: block.operaciones || []
              }
            }));
          } else {
            const role = block.type || 'result';
            tablaBody.appendChild(createResumenTotalsRow(block.totals || {}, {
              label: block.label || '',
              rowRole: role,
              rowClass: role === 'final' ? 'highlight-bright text-white fw-bold' : 'highlight-secondary fw-bold',
              rowContext: {
                label: block.label || '',
                type: role,
                operaciones: block.operaciones || []
              }
            }));
          }
        });
      } else {
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
})();
