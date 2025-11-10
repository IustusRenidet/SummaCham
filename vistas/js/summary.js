/**********************************************************************
 * SUMMARY.JS — Motor de cálculo tipo Excel + render dinámico
 * ----------------------------------------------------------
 * • Respeta colores/estilos del "excel original" via layout
 * • Modo 'server' (backend calcula) o 'client' (front calcula)
 * • Adaptadores para SALDOSxx y ACUMxx (inyecta aquí tus fórmulas)
 * • Subtotales/categorías/total se calculan por suma de hijos
 **********************************************************************/

// ================================
// === CONFIG / ESTADO GENERAL ===
// ================================
const API_BASE = 'http://localhost:3000/api';
/*
  Resumen de la logica (guia rapida):
  - CURRENT_LAYOUT describe la jerarquia/colores de la tabla (simula el Excel original).
  - fetchSummary() pide al backend los importes por codigo segun periodo/ejercicio.
  - buildIndex() crea un mapa { codigo -> importes } para calcular rapido.
  - computeTree() recorre el layout y calcula subtotal/total sumando hijos.
  - flattenForRender() convierte el arbol en filas para la <table>.
  - aplicarSeleccionUI() orquesta todo: lee filtros, obtiene datos, calcula y renderiza.
*/

const estadoModulo = {
  ejercicios: [],
  ejerciciosDisponibles: [],
  tabla: []
};

function normalizarListaAnios(lista) {
  const numeros = (Array.isArray(lista) ? lista : [])
    .map((valor) => {
      const numero = Number(valor);
      return Number.isFinite(numero) ? numero : null;
    })
    .filter((valor) => valor != null);
  return Array.from(new Set(numeros)).sort((a, b) => a - b);
}

function sincronizarSelectsAnio(listaAnios, preferido) {
  const selectPrincipal = document.getElementById('selectAnio');
  const selectHeader = document.getElementById('summaryYearSelect');
  const selects = [selectPrincipal, selectHeader].filter(Boolean);
  const anios = normalizarListaAnios(listaAnios);

  if (!selects.length) {
    return Number.isFinite(Number(preferido)) ? Number(preferido) : null;
  }

  const limpiarYAgregarPlaceholder = (select) => {
    select.innerHTML = '';
    const placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.textContent = '—';
    select.appendChild(placeholder);
  };

  selects.forEach(limpiarYAgregarPlaceholder);

  if (!anios.length) {
    selects.forEach((sel) => { sel.value = ''; });
    if (selectPrincipal && selectHeader) selectHeader.value = selectPrincipal.value;
    return Number.isFinite(Number(preferido)) ? Number(preferido) : null;
  }

  const fillSelect = (sel, prefer) => {
    if (!sel) return prefer;

    anios.forEach((anio) => {
      const opt = document.createElement('option');
      opt.value = String(anio);
      opt.textContent = String(anio);
      sel.appendChild(opt);
    });

    const anterior = Number(sel.value);
    const preferidoNum = Number(prefer);
    let objetivo = null;

    if (Number.isFinite(anterior) && anios.includes(anterior)) {
      objetivo = anterior;
    } else if (Number.isFinite(preferidoNum) && anios.includes(preferidoNum)) {
      objetivo = preferidoNum;
    } else {
      objetivo = anios[anios.length - 1];
    }

    if (Number.isFinite(objetivo)) {
      sel.value = String(objetivo);
      return objetivo;
    }

    sel.value = '';
    return prefer;
  };

  const preferInicial = Number(preferido);
  const seleccionado = selects.reduce((acc, sel) => fillSelect(sel, acc), Number.isFinite(preferInicial) ? preferInicial : undefined);

  if (selectPrincipal && selectHeader) selectHeader.value = selectPrincipal.value;

  if (Number.isFinite(seleccionado)) {
    return seleccionado;
  }

  if (Number.isFinite(preferInicial) && anios.includes(preferInicial)) {
    return preferInicial;
  }

  return anios[anios.length - 1];
}

// Mapa Mes (UI) -> Periodo numérico (1..13)
const MES_A_PERIODO = {
  'enero': 1, 'febrero': 2, 'marzo': 3, 'abril': 4, 'mayo': 5,
  'junio': 6, 'julio': 7, 'agosto': 8, 'septiembre': 9, 'octubre': 10,
  'noviembre': 11, 'diciembre': 12, 'ajuste': 13
};

// Actualiza todos los <span class="anio">...</span> en el header
const setAllYearSpans = (anio) => {
  document.querySelectorAll('.anio').forEach(sp => sp.textContent = anio);
};
// Actualiza todos los <span class="mes">...</span> en el header
const setAllMonthSpans = (mesNombre) => {
  const txt = (mesNombre || '').toString().trim();
  const up = txt ? txt.toUpperCase() : '';
  document.querySelectorAll('.mes').forEach(sp => sp.textContent = up);
};

// ================================
// === UI helpers (mensajes/UI) ===
// ================================
const formatoMXN = new Intl.NumberFormat('es-MX', {
  style: 'currency',
  currency: 'MXN',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
});

const formatearMoneda = (valor) => {
  if (typeof valor !== 'number' || Number.isNaN(valor)) return '—';
  return formatoMXN.format(valor);
};
const formatearPorcentaje = (valor) => {
  if (typeof valor !== 'number' || Number.isNaN(valor)) return '—';
  return `${valor.toFixed(2)}%`;
};

function limpiarEstado() {
  const summaryStatus = document.getElementById('summaryStatus');
  if (!summaryStatus) return;
  summaryStatus.className = 'alert alert-info mb-3 visually-hidden';
  summaryStatus.textContent = '';
}
function mostrarEstado(mensaje, tipo = 'info') {
  const summaryStatus = document.getElementById('summaryStatus');
  if (!summaryStatus) return;
  summaryStatus.textContent = mensaje;
  summaryStatus.className = `alert alert-${tipo} mb-3`;
}

// Tarjeta “Resumen financiero anual”
function actualizarResumen(anio) {
  const saldoValue = document.getElementById('saldoValue');
  const acumuladoValue = document.getElementById('acumuladoValue');
  if (!saldoValue || !acumuladoValue) return;

  const registro = estadoModulo.ejercicios.find((item) => String(item.anio) === String(anio));
  if (!registro) {
    saldoValue.textContent = '—';
    acumuladoValue.textContent = '—';
    return;
  }
  saldoValue.textContent = formatearMoneda(registro.saldo);
  acumuladoValue.textContent = formatearMoneda(registro.acumulado);
}

// ==========================================
// === PALETA VISUAL (respeta tu “excel”) ===
// ==========================================
const THEME = {
  categoria: 'highlight-primary',
  subcategoria: 'highlight-secondary',
  subtotal: 'amarillo',
  total: 'verde',
  bright: 'highlight-bright'
};
const estiloPorTipo = (tipo) => (
  tipo === 'subtotal' ? THEME.subtotal :
  tipo === 'total'    ? THEME.total :
  THEME.categoria
);

// ===================================
// === LAYOUT (jerarquía y colores) ===
// ===================================
// Puedes extenderlo o cargarlo desde BD/JSON; si el usuario lo edita, se persiste en LS.
const SummaryCore = (typeof window !== 'undefined' && window.SummaryEngineCore)
  ? window.SummaryEngineCore
  : {
      collectCodes: () => [],
      buildSummaryRows: () => [],
      safeDiv: (n, d) => {
        const num = Number(n || 0);
        const den = Number(d || 0);
        return Math.abs(den) === 0 ? 0 : num / den;
      }
    };

const collectCodes = typeof SummaryCore.collectCodes === 'function'
  ? (layout) => SummaryCore.collectCodes(layout)
  : () => [];

const DEFAULT_LAYOUT = (typeof window !== 'undefined' && window.SUMMARY_E01_LAYOUT)
  ? window.SUMMARY_E01_LAYOUT
  : [];

const cloneLayout = (layout) => {
  try {
    return JSON.parse(JSON.stringify(layout));
  } catch (e) {
    console.warn('No fue posible clonar layout, usando arreglo original.', e);
    return Array.isArray(layout) ? layout.slice() : [];
  }
};

const saveLayoutLS = (l) => localStorage.setItem('summary_layout_v1', JSON.stringify(l));
const loadLayoutLS = () => { try { return JSON.parse(localStorage.getItem('summary_layout_v1') || 'null'); } catch { return null; } };

let CURRENT_LAYOUT = loadLayoutLS();
if (!Array.isArray(CURRENT_LAYOUT) || CURRENT_LAYOUT.length === 0) {
  CURRENT_LAYOUT = cloneLayout(DEFAULT_LAYOUT);
}


// Mostrar un toast verde de exito (Bootstrap) al actualizar
function mostrarToastExito(mensaje = 'Actualizado correctamente') {
  const toastEl = document.getElementById('summaryToast');
  const body = document.getElementById('summaryToastBody');
  if (!toastEl) return;
  if (body) body.textContent = mensaje;
  const ctor = (window.bootstrap && window.bootstrap.Toast) ? window.bootstrap.Toast : null;
  if (ctor) {
    const toast = new ctor(toastEl);
    toast.show();
  } else {
    // Fallback simple si Bootstrap Toast no esta disponible aun
    toastEl.classList.add('show');
    setTimeout(() => { toastEl.classList.remove('show'); }, 1500);
  }
}

// =========================================================
// === SISTEMA DE FORMULAS (fila / celda / columna)     ===
// =========================================================
/*
  Como extender:
  - ROW_FORMULAS: se ejecuta una vez por fila renderizable (rowId = layout.id). Ideal para reglas globales.
  - CELL_FORMULAS: se dispara por fila+columna. Usa la misma llave rowId y el key de columna (ver COLUMN_DEFS).
  - COLUMN_FORMULAS: corre una vez por columna con acceso a todas las filas. Perfecto para totales personalizados.

  Cada handler recibe un contexto con helpers:
    ctx.row           -> Objeto que se pintara (puedes mutarlo).
    ctx.rowIndex      -> Indice base 0 en la tabla final (rowNumber = +1).
    ctx.rows          -> Todas las filas (ya clonadas), util para buscar referencias.
    ctx.columnKey     -> Solo en formulas de celda/columna.
    ctx.columnMeta    -> Metadata declarada en COLUMN_DEFS (indice visual, etiqueta, etc.).
    ctx.getRow(rowId) -> Helper para encontrar cualquier fila por su id original del layout.
    ctx.getValue(rowId, columnKey) -> Lee el valor de otra celda.
    ctx.setValue(rowId, columnKey, value) -> Asigna en otra celda (col/col formulas).

  Usa estos registros para agregar tus formulas reales sin tocar el motor:
*/
const COLUMN_DEFS = [
  { key: 'mesActual', colIndex: 2, label: 'Mes actual', tipo: 'currency' },
  { key: 'mesPlan', colIndex: 3, label: 'Mes plan', tipo: 'currency' },
  { key: 'mesAnterior', colIndex: 4, label: 'Mes anterior', tipo: 'currency' },
  { key: 'mesVariacionPlan', colIndex: 5, label: 'Var. mes vs plan', tipo: 'percent' },
  { key: 'mesVariacionAnterior', colIndex: 6, label: 'Var. mes vs anterior', tipo: 'percent' },
  { key: 'acumuladoActual', colIndex: 8, label: 'YTD actual', tipo: 'currency' },
  { key: 'acumuladoPlan', colIndex: 9, label: 'YTD plan', tipo: 'currency' },
  { key: 'acumuladoAnterior', colIndex: 10, label: 'YTD anterior', tipo: 'currency' },
  { key: 'acumuladoVariacionPlan', colIndex: 11, label: 'Var. YTD vs plan', tipo: 'percent' },
  { key: 'acumuladoVariacionAnterior', colIndex: 12, label: 'Var. YTD vs anterior', tipo: 'percent' }
];
const COLUMN_LOOKUP = COLUMN_DEFS.reduce((acc, col) => {
  acc[col.key] = col;
  return acc;
}, {});

const ROW_FORMULAS = {
  /*
    Ejemplo:
    income_total: ({ row }) => {
      row.mesActual = row.mesActual * 1.1;
    }
  */
};

const CELL_FORMULAS = {
  /*
    Ejemplo:
    membership_sub: {
      mesVariacionPlan: ({ value, row }) => value || (pct(row.mesActual, row.mesPlan))
    }
  */
};

const COLUMN_FORMULAS = {
  /*
    Ejemplo:
    acumuladoActual: ({ values, setValue }) => {
      const total = values.reduce((sum, item) => sum + (item.row.tipoFila === 'total' ? 0 : (item.value || 0)), 0);
      setValue('income_total', total);
    }
  */
};

const findRowById = (rows, rowId) => rows.find((r) => r.rowId === rowId);
const assignKnownKeys = (row, partial = {}) => {
  Object.keys(partial || {}).forEach((key) => {
    if (key in row) row[key] = partial[key];
  });
};

const createSharedFormulaCtx = (rows) => ({
  rows,
  getRow: (rowId) => findRowById(rows, rowId),
  getValue: (rowId, columnKey) => {
    const r = findRowById(rows, rowId);
    return r ? r[columnKey] : undefined;
  },
  setValue: (rowId, columnKey, value) => {
    const r = findRowById(rows, rowId);
    if (!r) return;
    if (columnKey in r || COLUMN_LOOKUP[columnKey]) r[columnKey] = value;
  }
});

const applyRowFormulas = (rows) => {
  const shared = createSharedFormulaCtx(rows);
  rows.forEach((row, rowIndex) => {
    const handler = ROW_FORMULAS[row.rowId];
    if (typeof handler !== 'function') return;
    const ctx = {
      ...shared,
      row,
      rowIndex,
      rowNumber: row.rowNumber,
      columns: COLUMN_DEFS
    };
    const result = handler(ctx);
    if (result && typeof result === 'object') assignKnownKeys(row, result);
  });
};

const applyCellFormulas = (rows) => {
  const shared = createSharedFormulaCtx(rows);
  rows.forEach((row, rowIndex) => {
    const registry = CELL_FORMULAS[row.rowId];
    if (!registry) return;
    COLUMN_DEFS.forEach((col) => {
      const handler = registry[col.key];
      if (typeof handler !== 'function') return;
      const ctx = {
        ...shared,
        row,
        rowIndex,
        rowNumber: row.rowNumber,
        columnKey: col.key,
        columnMeta: col,
        value: row[col.key]
      };
      const next = handler(ctx);
      if (typeof next !== 'undefined') row[col.key] = next;
    });
  });
};

const applyColumnFormulas = (rows) => {
  const shared = createSharedFormulaCtx(rows);
  COLUMN_DEFS.forEach((col) => {
    const handler = COLUMN_FORMULAS[col.key];
    if (typeof handler !== 'function') return;
    const ctx = {
      ...shared,
      columnKey: col.key,
      columnMeta: col,
      values: rows.map((row, rowIndex) => ({
        rowId: row.rowId,
        row,
        rowIndex,
        rowNumber: row.rowNumber,
        value: row[col.key]
      })),
      setValue: (rowId, value) => shared.setValue(rowId, col.key, value)
    };
    const result = handler(ctx);
    if (Array.isArray(result)) {
      result.forEach((item) => {
        if (item && item.rowId) ctx.setValue(item.rowId, item.value);
      });
    } else if (result && typeof result === 'object') {
      Object.entries(result).forEach(([rowId, value]) => ctx.setValue(rowId, value));
    }
  });
};

const applyFormulaEngine = (rows) => {
  if (!Array.isArray(rows) || rows.length === 0) return rows;
  const cloned = rows.map((row, index) => ({
    ...row,
    rowNumber: index + 1 // 1-based para empatar con la UI
  }));
  applyRowFormulas(cloned);
  applyCellFormulas(cloned);
  applyColumnFormulas(cloned);
  return cloned;
};

// ========================================
// === ADAPTADORES (SALDOSxx / ACUMxx)  ===
// ========================================
// Contexto de cálculo (se rellena en aplicarSeleccionUI)
const CTX = {
  anio: 0,
  periodo: 1,           // 1..13
  anioComparativo: 0,
  incluirAjusteEnYTD: false,
  fuente: 'SALDOSxx'    // o 'ACUMxx'
};

// Shape canónico que espera el motor
const emptyDetalle = () => ({
  codigo: '',
  descripcion: '',
  // Mes
  mesActual: 0, mesPlan: 0, mesAnterior: 0,
  // YTD
  acumuladoActual: 0, acumuladoPlan: 0, acumuladoAnterior: 0,
  // opcionales
  ajuste: 0, naturaleza: ''
});

// Aquí metes TUS fórmulas reales:
const OPERACIONES = {
  // SALDOSxx: INICIAL, CARGO01..13, ABONO01..13, NATURALEZA...
  //
  // 🔧 Cómo extenderlo:
  // - La idea es que el backend entregue los saldos "crudos" (mes actual, acumulado actual,
  //   año anterior, etc.) y aquí puedas combinarlos con reglas específicas para cada celda.
  // - Si necesitas aplicar fórmulas diferentes por cuenta, puedes inspeccionar `d.codigo`
  //   antes de regresar el objeto y realizar operaciones adicionales (por ejemplo sumar
  //   varias cuentas, multiplicar por un porcentaje o calcular variaciones personalizadas).
  // - Cualquier campo numérico de `d` termina renderizado en la tabla, por lo que este es el
  //   punto ideal para definir tu “lógica de operaciones por celda”.
  detalleDesdeSALDOS: (raw, ctx) => {
    const d = emptyDetalle();
    d.codigo = String(raw.NUM_CTA || raw.CUENTA || '').trim();
    d.descripcion = raw.NOMBRE || raw.DESCRIPCION || '';

    const p = ctx.periodo;
    const pAnt = p;

    const sum = (arr) => arr.reduce((a,b)=>a+(+b||0),0);
    const cargos = [], abonos = [], cargosAnt = [], abonosAnt = [];

    for (let i=1;i<=Math.min(p,13);i++){
      const ii = String(i).padStart(2,'0'); // 01..13 si aplica
      cargos.push(+raw[`CARGO${ii}`] || 0);
      abonos.push(+raw[`ABONO${ii}`] || 0);

      if (raw.anterior) {
        cargosAnt.push(+raw.anterior[`CARGO${ii}`] || 0);
        abonosAnt.push(+raw.anterior[`ABONO${ii}`] || 0);
      }
    }

    const movMes     = (+raw[`CARGO${String(p).padStart(2,'0')}`]||0) - (+raw[`ABONO${String(p).padStart(2,'0')}`]||0);
    const movMesAnt  = raw.anterior
      ? ((+raw.anterior[`CARGO${String(pAnt).padStart(2,'0')}`]||0) - (+raw.anterior[`ABONO${String(pAnt).padStart(2,'0')}`]||0))
      : 0;

    const inicial    = +raw.INICIAL || 0;
    const inicialAnt = raw.anterior ? (+raw.anterior.INICIAL || 0) : 0;

    d.mesActual      = movMes;
    d.mesPlan        = 0; // si no hay plan aún
    d.mesAnterior    = movMesAnt;

    let ytd = inicial + (sum(cargos) - sum(abonos));
    let ytdAnt = inicialAnt + (sum(cargosAnt) - sum(abonosAnt));

    if (ctx.incluirAjusteEnYTD && p === 13) {
      // Ya incluido si sumas hasta 13; si quisieras tratarlo distinto, aquí
    }

    d.acumuladoActual   = ytd;
    d.acumuladoPlan     = 0;
    d.acumuladoAnterior = ytdAnt;

    // 👉 Ejemplo de lógica por celda:
    // if (d.codigo === '401000000000000000001') {
    //   d.mesActual = d.mesActual * 1.16; // aplica IVA, margen, etc.
    //   d.acumuladoActual += 5000;        // suma ajustes específicos
    // }

    d.naturaleza = raw.NATURALEZA || '';
    d.ajuste     = (+raw.CARGO13 || 0) - (+raw.ABONO13 || 0);
    return d;
  },

  // ACUMxx: ENERO..DICIEMBRE, AJUSTE, NATURALEZA...
  detalleDesdeACUM: (raw, ctx) => {
    const d = emptyDetalle();
    d.codigo = String(raw.CUENTA || raw.NUM_CTA || '').trim();
    d.descripcion = raw.DESCRIPCION || raw.NOMBRE || '';

    const colMes = ['ENERO','FEB','MARZO','ABRIL','MAYO','JUNIO','JULIO','AGOSTO','SEPTIEMBRE','OCTUBRE','NOVIEMBRE','DICIEMBRE'];
    const i = Math.min(Math.max(ctx.periodo,1),13) - 1;
    const col = i < 12 ? colMes[i] : 'AJUSTE';

    d.mesActual   = +raw[col] || 0;
    d.mesPlan     = 0;
    d.mesAnterior = raw.anterior ? (+raw.anterior[col] || 0) : 0;

    const take = i < 12 ? colMes.slice(0, i+1) : colMes;
    d.acumuladoActual = take.reduce((a,c)=>a+(+raw[c]||0),0);
    d.acumuladoAnterior = raw.anterior ? take.reduce((a,c)=>a+(+raw.anterior[c]||0),0) : 0;

    if (ctx.incluirAjusteEnYTD && ctx.periodo === 13) {
      d.acumuladoActual   += (+raw.AJUSTE || 0);
      d.acumuladoAnterior += raw.anterior ? (+raw.anterior.AJUSTE || 0) : 0;
      d.ajuste = +raw.AJUSTE || 0;
    }

    d.acumuladoPlan = 0;
    d.naturaleza = raw.NATURALEZA || '';
    return d;
  }
};

// Dónde se calcula (server o client)
const CALC_STRATEGY = {
  modo: 'server',            // 'server' | 'client'
  fuente: () => CTX.fuente   // 'SALDOSxx' | 'ACUMxx'
  // En modo "client" puedes exponer una UI que permita elegir entre distintas versiones de
  // operaciones (p. ej., KPIs personalizados vs. saldos contables) y, dependiendo de la
  // selección, cambiar `CTX.fuente` o elegir diferentes funciones dentro de OPERACIONES.
};

// ======================================================
// === FETCH / DATA PIPELINE
// ======================================================
// fetchSummary
// - Llama a la API del backend para obtener los montos por codigo contable
//   segun empresa, periodo y ejercicio seleccionados.
// - Devuelve un objeto con:
//   { detalle: [...], ejercicios: [...] }
//   donde 'detalle' son filas por codigo y 'ejercicios' alimenta la tarjeta superior.
async function fetchSummary({ anio, periodo, empresaId, incluirAjusteEnYTD }) {
  const codigos = collectCodes(CURRENT_LAYOUT);
  const usarAjuste = Boolean(incluirAjusteEnYTD);

  // set contexto
  CTX.anio = anio;
  CTX.periodo = periodo;
  CTX.anioComparativo = anio - 1;
  CTX.incluirAjusteEnYTD = usarAjuste;
  CTX.fuente = 'SALDOSxx';             // o 'ACUMxx' según la fuente

  if (CALC_STRATEGY.modo === 'server') {
    // Backend ya devuelve {detalle: [...métricas...], ejercicios: [...]}
    const resp = await fetch(`${API_BASE}/modulos/summary-resumen-e`, {
      method: 'POST',
      headers: { ...Sesion.headersAutenticacion(), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        anio,
        periodo,
        empresaId,
        codigos,
        anioComparativo: CTX.anioComparativo,
        usarAjusteEnYTD: usarAjuste
      })
    });
    const data = await resp.json();
    if (!resp.ok) throw new Error(data.mensaje || 'No fue posible obtener la información.');
    return {
      detalle: Array.isArray(data.detalle) ? data.detalle : [],
      ejercicios: Array.isArray(data.ejercicios) ? data.ejercicios : [],
      ejerciciosDisponibles: Array.isArray(data.ejerciciosDisponibles) ? data.ejerciciosDisponibles : []
    };
  }

  // === Modo client: el backend regresa crudo y aquí operamos ===
  const resp = await fetch(`${API_BASE}/modulos/summary-crudo`, {
    method: 'POST',
    headers: { ...Sesion.headersAutenticacion(), 'Content-Type': 'application/json' },
    body: JSON.stringify({
      anio,
      periodo,
      empresaId,
      codigos,
      fuente: CALC_STRATEGY.fuente(),
      usarAjusteEnYTD: usarAjuste
    })
  });
  const raw = await resp.json();
  if (!resp.ok) throw new Error(raw.mensaje || 'No fue posible obtener la información.');

  // raw.registros = filas crudas (SALDOSxx o ACUMxx)
  // raw.registrosAnt = (opcional) año comparativo, mismas columnas
  const porCodigoAnt = new Map(
    (raw.registrosAnt || []).map(r => [String(r.CUENTA || r.NUM_CTA || '').trim(), r])
  );

  const detalle = (raw.registros || []).map(r => {
    const codigo = String(r.CUENTA || r.NUM_CTA || '').trim();
    if (porCodigoAnt.has(codigo)) r.anterior = porCodigoAnt.get(codigo);

    if (CALC_STRATEGY.fuente() === 'SALDOSxx') return OPERACIONES.detalleDesdeSALDOS(r, CTX);
    return OPERACIONES.detalleDesdeACUM(r, CTX);
  });

  return {
    detalle,
    ejercicios: raw.ejercicios || [],
    ejerciciosDisponibles: raw.ejerciciosDisponibles || []
  };
}

// ==============================================================
// === ACCIONES (agregar/quitar cuentas conservando estilos)  ===
// ==============================================================
function addDetail(parentId, codigo, descripcion = '') {
  if (!parentId || !codigo) return;
  const codigoTxt = String(codigo).trim();
  const nuevoId = `cuenta_${codigoTxt}`;
  const nuevaFila = {
    id: nuevoId,
    tipo: 'cuenta',
    codigo: codigoTxt,
    titulo: descripcion || codigoTxt,
    padre: parentId
  };

  const actualizado = (Array.isArray(CURRENT_LAYOUT) ? CURRENT_LAYOUT.slice() : []);
  actualizado.push(nuevaFila);

  CURRENT_LAYOUT = actualizado.map((item) => {
    if (!Array.isArray(item.componentes)) return item;
    if (item.id === parentId || item.padre === parentId) {
      if (!item.componentes.includes(nuevoId)) {
        return { ...item, componentes: [...item.componentes, nuevoId] };
      }
    }
    return item;
  });

  saveLayoutLS(CURRENT_LAYOUT);
}

function removeByCode(codigo) {
  if (!codigo) return;
  const codigoTxt = String(codigo).trim();
  let idEliminado = null;

  CURRENT_LAYOUT = (Array.isArray(CURRENT_LAYOUT) ? CURRENT_LAYOUT : []).filter((item) => {
    if (item.tipo === 'cuenta' && String(item.codigo || '').trim() === codigoTxt) {
      idEliminado = item.id;
      return false;
    }
    return true;
  }).map((item) => {
    if (!Array.isArray(item.componentes) || !idEliminado) return item;
    const filtrado = item.componentes.filter((comp) => comp !== idEliminado);
    if (filtrado.length !== item.componentes.length) {
      return { ...item, componentes: filtrado };
    }
    return item;
  });

  saveLayoutLS(CURRENT_LAYOUT);
}

async function poblarAniosDesdeSALDOS() {
  const authHeaders = (typeof Sesion !== 'undefined' && typeof Sesion.headersAutenticacion === 'function')
    ? Sesion.headersAutenticacion()
    : {};
  const anioActual = new Date().getFullYear();
  let lista = [anioActual];

  try {
    const empresaActiva = (typeof Sesion !== 'undefined' && typeof Sesion.obtenerEmpresaActiva === 'function')
      ? Sesion.obtenerEmpresaActiva()
      : (typeof sesion !== 'undefined' ? (sesion.empresaActiva || null) : null);
    const empresaId = empresaActiva?.id || sesion?.empresaId || '';
    const query = empresaId ? `?empresaId=${encodeURIComponent(empresaId)}` : '';
    const resp = await fetch(`${API_BASE}/modulos/summary-anios${query}`, { headers: { ...authHeaders } });
    const data = await resp.json();
    if (!resp.ok) throw new Error(data.mensaje || 'No fue posible obtener los ejercicios disponibles.');
    const normalizados = Array.isArray(data?.anios)
      ? data.anios.map((y) => Number(y)).filter((n) => Number.isFinite(n))
      : [];
    if (normalizados.length) lista = normalizados.sort((a, b) => a - b);
  } catch (error) {
    console.warn('No fue posible poblar años desde SALDOSxx.', error);
  }

  const prefer = lista.includes(anioActual) ? anioActual : lista[0];
  estadoModulo.ejerciciosDisponibles = normalizarListaAnios(lista);
  const valorSeleccionado = sincronizarSelectsAnio(estadoModulo.ejerciciosDisponibles, prefer);
  setAllYearSpans(valorSeleccionado);
  actualizarResumen(valorSeleccionado);
  return valorSeleccionado;
}

function inicializarMesDesdeSelect() {
  const filtroMesInit = document.getElementById('selectMes');
  const nombres = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
  const ahora = new Date();
  const mesActual = nombres[ahora.getMonth()];
  if (filtroMesInit && !filtroMesInit.value) {
    filtroMesInit.value = mesActual.charAt(0).toUpperCase() + mesActual.slice(1);
  }
  const mesTexto = String(filtroMesInit?.value || mesActual || 'enero').toLowerCase();
  setAllMonthSpans(mesTexto);
}

// ==================================
// === CONTROLADOR PRINCIPAL (UI) ===
// ==================================
async function aplicarSeleccionUI() {
  const filtroAnio = document.getElementById('selectAnio');
  const filtroMes = document.getElementById('selectMes');
  const anio = Number(filtroAnio?.value || new Date().getFullYear());
  const mesNombre = String((filtroMes?.value || 'enero')).toLowerCase();
  const periodo = MES_A_PERIODO[mesNombre] || 1;
  const incluirAjuste = Boolean(document.getElementById('chkAjuste')?.checked);

  setAllYearSpans(anio);
  mostrarEstado('Calculando…');

  try {
    const { detalle, ejercicios, ejerciciosDisponibles } = await fetchSummary({
      anio,
      periodo,
      empresaId: (typeof sesion !== 'undefined' ? sesion?.empresaId : undefined),
      incluirAjusteEnYTD: incluirAjuste
    });

    const layoutParaMotor = Array.isArray(CURRENT_LAYOUT) ? CURRENT_LAYOUT : [];
    const tablaCalculada = SummaryCore.buildSummaryRows(
      layoutParaMotor,
      detalle,
      { estiloPorTipo }
    );

    estadoModulo.tabla = applyFormulaEngine(tablaCalculada);
    estadoModulo.ejercicios = ejercicios;
    if (Array.isArray(ejerciciosDisponibles) && ejerciciosDisponibles.length) {
      estadoModulo.ejerciciosDisponibles = normalizarListaAnios(ejerciciosDisponibles);
      sincronizarSelectsAnio(estadoModulo.ejerciciosDisponibles, anio);
    } else {
      estadoModulo.ejerciciosDisponibles = [];
    }

    actualizarResumen(anio);
    renderizarTabla();
    limpiarEstado();
    // Aviso toast en verde cuando todo sali bien
    if (typeof mostrarToastExito === 'function') {
      mostrarToastExito('Datos actualizados correctamente.');
    }
  } catch (err) {
    console.error(err);
    mostrarEstado(err.message || 'Error al calcular.', 'danger');
    estadoModulo.tabla = [];
    renderizarTabla();
  }
}

// Para carga inicial
async function cargarDatos() {
  await aplicarSeleccionUI();
}

// =======================================
// === BOOT (listeners y carga inicial) ===
// =======================================
document.addEventListener('DOMContentLoaded', async () => {
  // Botón "Aplicar selección" ya no se usa; aplicar en tiempo real
  const btnAplicar = document.getElementById('btnAplicar');
  if (btnAplicar) {
    btnAplicar.classList.add('d-none');
    btnAplicar.removeEventListener?.('click', aplicarSeleccionUI);
  }

  // Mantener sincronizados los <span.anio> del header
  const summaryYearSelect = document.getElementById('summaryYearSelect');
  const filtroAnio = document.getElementById('selectAnio');

  if (summaryYearSelect) {
    summaryYearSelect.addEventListener('change', (event) => {
      const seleccionado = event.target.value;
      setAllYearSpans(seleccionado);
      actualizarResumen(seleccionado);
      if (filtroAnio && filtroAnio.value !== seleccionado) filtroAnio.value = seleccionado;
      // Aplicar inmediatamente
      aplicarSeleccionUI();
    });
  }
  if (filtroAnio) {
    filtroAnio.addEventListener('change', (event) => {
      const seleccionado = event.target.value;
      setAllYearSpans(seleccionado);
      actualizarResumen(seleccionado);
      if (summaryYearSelect && summaryYearSelect.value !== seleccionado) summaryYearSelect.value = seleccionado;
      // Aplicar inmediatamente
      aplicarSeleccionUI();
    });
  }

  // Cambios de mes se aplican al momento
  const filtroMes = document.getElementById('selectMes');
  if (filtroMes) {
    filtroMes.addEventListener('change', (event) => {
      const mesNombre = String(event.target.value || '').toLowerCase();
      setAllMonthSpans(mesNombre);
      aplicarSeleccionUI();
    });
  }

  // Botón Restablecer: establece año/mes en curso y aplica
  const btnReset = document.getElementById('btnReset');
  const chkAjuste = document.getElementById('chkAjuste');
  if (btnReset) {
    btnReset.addEventListener('click', () => {
      const ahora = new Date();
      const anioActual = ahora.getFullYear();
      const mesIndex = ahora.getMonth(); // 0=enero
      const nombres = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
      const mesNombre = nombres[mesIndex];

      const selAnio = document.getElementById('selectAnio');
      if (selAnio) selAnio.value = String(anioActual);
      if (summaryYearSelect) summaryYearSelect.value = String(anioActual);
      setAllYearSpans(anioActual);
      actualizarResumen(anioActual);

      const selMes = document.getElementById('selectMes');
      if (selMes) selMes.value = mesNombre.charAt(0).toUpperCase() + mesNombre.slice(1);
      setAllMonthSpans(mesNombre);

      if (chkAjuste) chkAjuste.checked = false;

      aplicarSeleccionUI();
    });
  }

  if (chkAjuste) {
    chkAjuste.checked = false;
    chkAjuste.addEventListener('change', () => {
      aplicarSeleccionUI();
    });
  }

  // Carga inicial
  await poblarAniosDesdeSALDOS();
  inicializarMesDesdeSelect();
  await cargarDatos();

  if (typeof Sesion !== 'undefined' && Sesion.EVENTO_EMPRESA) {
    window.addEventListener(Sesion.EVENTO_EMPRESA, async () => {
      await poblarAniosDesdeSALDOS();
      await aplicarSeleccionUI();
    });
  }
});

// ========== EXTENSION: render con marcado de celdas (IDs por fila/columna) ==========
// Redefine renderizarTabla para inyectar identificadores únicos por posición
function renderizarTabla() {
  const body = document.getElementById('summaryTableBody');
  if (!body) return;

  body.innerHTML = '';
  const filas = estadoModulo.tabla;

  if (!Array.isArray(filas) || filas.length === 0) {
    const vacio = document.createElement('tr');
    vacio.innerHTML = '<td colspan="12" class="text-center text-muted py-4">No hay información disponible para mostrar.</td>';
    body.appendChild(vacio);
    return;
  }

  filas.forEach((fila, rowIndex) => {
    const r = fila.rowNumber || rowIndex + 1;
    const tr = document.createElement('tr');
    tr.id = `row-r${r}`;
    tr.setAttribute('data-row-index', String(r));
    if (fila.rowId) tr.setAttribute('data-row-id', fila.rowId);
    if (fila.tipoFila) tr.setAttribute('data-row-type', fila.tipoFila);

    if (fila.tipo === 'categoria') {
      const clases = [fila.estilo || THEME.categoria];
      if (fila.tipoFila) clases.push(`fila-${fila.tipoFila}`);
      tr.className = clases.join(' ');
      tr.innerHTML = `
        <th id="cell-r${r}-c1" data-row-index="${r}" data-col-index="1" data-column-key="codigo" data-role="code"></th>
        <td id="cell-r${r}-c2" data-row-index="${r}" data-col-index="2" data-column-key="mesActual" class="mono">${formatearMoneda(fila.mesActual)}</td>
        <td id="cell-r${r}-c3" data-row-index="${r}" data-col-index="3" data-column-key="mesPlan" class="mono">${formatearMoneda(fila.mesPlan)}</td>
        <td id="cell-r${r}-c4" data-row-index="${r}" data-col-index="4" data-column-key="mesAnterior" class="mono">${formatearMoneda(fila.mesAnterior)}</td>
        <td id="cell-r${r}-c5" data-row-index="${r}" data-col-index="5" data-column-key="mesVariacionPlan" class="mono">${formatearPorcentaje(fila.mesVariacionPlan)}</td>
        <td id="cell-r${r}-c6" data-row-index="${r}" data-col-index="6" data-column-key="mesVariacionAnterior" class="mono">${formatearPorcentaje(fila.mesVariacionAnterior)}</td>
        <td id="cell-r${r}-c7" data-row-index="${r}" data-col-index="7" data-column-key="label" class="category-cell" data-depth="${fila.depth||0}" style="--depth:${fila.depth||0}">${fila.etiqueta || ''}</td>
        <td id="cell-r${r}-c8" data-row-index="${r}" data-col-index="8" data-column-key="acumuladoActual" class="mono">${formatearMoneda(fila.acumuladoActual)}</td>
        <td id="cell-r${r}-c9" data-row-index="${r}" data-col-index="9" data-column-key="acumuladoPlan" class="mono">${formatearMoneda(fila.acumuladoPlan)}</td>
        <td id="cell-r${r}-c10" data-row-index="${r}" data-col-index="10" data-column-key="acumuladoAnterior" class="mono">${formatearMoneda(fila.acumuladoAnterior)}</td>
        <td id="cell-r${r}-c11" data-row-index="${r}" data-col-index="11" data-column-key="acumuladoVariacionPlan" class="mono">${formatearPorcentaje(fila.acumuladoVariacionPlan)}</td>
        <td id="cell-r${r}-c12" data-row-index="${r}" data-col-index="12" data-column-key="acumuladoVariacionAnterior" class="mono">${formatearPorcentaje(fila.acumuladoVariacionAnterior)}</td>
      `;
    } else {
      const clases = [];
      if (fila.tipoFila && fila.tipoFila !== 'detalle') clases.push(`fila-${fila.tipoFila}`);
      if (clases.length) tr.className = clases.join(' ');
      tr.innerHTML = `
        <th id="cell-r${r}-c1" data-row-index="${r}" data-col-index="1" data-column-key="codigo" data-role="code" class="code-cell" data-codigo="${fila.codigo || ''}">${fila.codigo || ''}</th>
        <td id="cell-r${r}-c2" data-row-index="${r}" data-col-index="2" data-column-key="mesActual" class="mono">${formatearMoneda(fila.mesActual)}</td>
        <td id="cell-r${r}-c3" data-row-index="${r}" data-col-index="3" data-column-key="mesPlan" class="mono">${formatearMoneda(fila.mesPlan)}</td>
        <td id="cell-r${r}-c4" data-row-index="${r}" data-col-index="4" data-column-key="mesAnterior" class="mono">${formatearMoneda(fila.mesAnterior)}</td>
        <td id="cell-r${r}-c5" data-row-index="${r}" data-col-index="5" data-column-key="mesVariacionPlan" class="mono">${formatearPorcentaje(fila.mesVariacionPlan)}</td>
        <td id="cell-r${r}-c6" data-row-index="${r}" data-col-index="6" data-column-key="mesVariacionAnterior" class="mono">${formatearPorcentaje(fila.mesVariacionAnterior)}</td>
        <td id="cell-r${r}-c7" data-row-index="${r}" data-col-index="7" data-column-key="label" class="label-cell" data-role="descripcion" data-depth="${fila.depth||0}" style="--depth:${fila.depth||0}">${fila.descripcion || ''}</td>
        <td id="cell-r${r}-c8" data-row-index="${r}" data-col-index="8" data-column-key="acumuladoActual" class="mono">${formatearMoneda(fila.acumuladoActual)}</td>
        <td id="cell-r${r}-c9" data-row-index="${r}" data-col-index="9" data-column-key="acumuladoPlan" class="mono">${formatearMoneda(fila.acumuladoPlan)}</td>
        <td id="cell-r${r}-c10" data-row-index="${r}" data-col-index="10" data-column-key="acumuladoAnterior" class="mono">${formatearMoneda(fila.acumuladoAnterior)}</td>
        <td id="cell-r${r}-c11" data-row-index="${r}" data-col-index="11" data-column-key="acumuladoVariacionPlan" class="mono">${formatearPorcentaje(fila.acumuladoVariacionPlan)}</td>
        <td id="cell-r${r}-c12" data-row-index="${r}" data-col-index="12" data-column-key="acumuladoVariacionAnterior" class="mono">${formatearPorcentaje(fila.acumuladoVariacionAnterior)}</td>
      `;
    }
    body.appendChild(tr);
  });
}



// Construye todas las filas del layout a partir del payload del backend
function materializarLayout(LAYOUT, payload) {
  const layout = Array.isArray(LAYOUT) ? LAYOUT : [];
  const detalle = Array.isArray(payload?.detalle) ? payload.detalle : [];
  const filas = SummaryCore.buildSummaryRows(layout, detalle, { estiloPorTipo });

  return filas.map((fila) => ({
    id: fila.rowId,
    tipo: fila.tipoFila,
    titulo: fila.etiqueta || fila.descripcion || fila.rowId,
    codigo: fila.codigo,
    descripcion: fila.descripcion || '',
    mesActual: Number(fila.mesActual || 0),
    mesPlan: Number(fila.mesPlan || 0),
    mesAnterior: Number(fila.mesAnterior || 0),
    mesVariacionPlan: Number(fila.mesVariacionPlan || 0),
    mesVariacionAnterior: Number(fila.mesVariacionAnterior || 0),
    ytdActual: Number(fila.acumuladoActual ?? fila.ytdActual ?? 0),
    ytdPlan: Number(fila.acumuladoPlan ?? fila.ytdPlan ?? 0),
    ytdAnterior: Number(fila.acumuladoAnterior ?? fila.ytdAnterior ?? 0),
    acumuladoActual: Number(fila.acumuladoActual || fila.ytdActual || 0),
    acumuladoPlan: Number(fila.acumuladoPlan || fila.ytdPlan || 0),
    acumuladoAnterior: Number(fila.acumuladoAnterior || fila.ytdAnterior || 0),
    acumuladoVariacionPlan: Number(fila.acumuladoVariacionPlan || 0),
    acumuladoVariacionAnterior: Number(fila.acumuladoVariacionAnterior || 0)
  }));
}

// Expone helper para su reutilizaci�n (CLI/tests/otros m�dulos)
if (typeof window !== 'undefined') {
  window.materializarLayout = materializarLayout;
}
if (typeof module === 'object' && module.exports) {
  module.exports = { materializarLayout };
}

