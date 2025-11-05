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

const estadoModulo = {
  ejercicios: [],
  tabla: []
};

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
const SUMMARY_LAYOUT_V1 = [
  {
    id: 'cdmx_income', tipo: 'categoria', estilo: THEME.categoria, etiqueta: 'CDMX INCOME', hijos: [
      {
        id: 'membership', tipo: 'categoria', estilo: THEME.subcategoria, etiqueta: 'Membership', hijos: [
          { id: 'ctas_cuotas', tipo: 'detalle', codigo: '401000000000000000001', descripcion: 'Cuotas Netas' },
          { id: 'ctas_nuevos', tipo: 'detalle', codigo: '402000000000000000001', descripcion: 'Ingresos socios nuevos' },
          { id: 'membership_sub', tipo: 'subtotal', estilo: THEME.subtotal, etiqueta: 'Subtotal Membership' }
        ]
      },
      {
        id: 'events', tipo: 'categoria', estilo: THEME.subcategoria, etiqueta: 'EVENTS', hijos: [
          { id: 'ctas_eventos', tipo: 'detalle', codigo: '407000000000000000001', descripcion: 'Eventos' },
          { id: 'ctas_patro', tipo: 'detalle', codigo: '408000000000000000001', descripcion: 'Patrocinios' },
          { id: 'events_sub', tipo: 'subtotal', estilo: THEME.subtotal, etiqueta: 'Subtotal Events' }
        ]
      },
      { id: 'income_total', tipo: 'total', estilo: THEME.total, etiqueta: 'TOTAL INCOME' }
    ]
  }
];

const saveLayoutLS = (l) => localStorage.setItem('summary_layout_v1', JSON.stringify(l));
const loadLayoutLS = () => { try { return JSON.parse(localStorage.getItem('summary_layout_v1') || 'null'); } catch { return null; } };
let CURRENT_LAYOUT = loadLayoutLS() ?? SUMMARY_LAYOUT_V1;

// ======================================
// === Motor de cálculo tipo “Excel”  ===
// ======================================
const zeroMetrics = () => ({
  // Mes (seleccionado)
  mesActual: 0, mesPlan: 0, mesAnterior: 0, mesVariacionPlan: 0, mesVariacionAnterior: 0,
  // YTD (hasta mes seleccionado)
  acumuladoActual: 0, acumuladoPlan: 0, acumuladoAnterior: 0, acumuladoVariacionPlan: 0, acumuladoVariacionAnterior: 0
});
const pct = (a, b) => (Math.abs(b || 0) === 0 ? 0 : ((a - b) / Math.abs(b)) * 100);
const addMetrics = (dst, src) => { Object.keys(dst).forEach(k => dst[k] += (src[k] || 0)); return dst; };

// Índices de datos por NUM_CTA
function buildIndex(apiRows) {
  const idx = {};
  (apiRows || []).forEach(r => { idx[String(r.codigo).trim()] = r; });
  return idx;
}

// Recolecta códigos NUM_CTA del layout visible
function collectCodes(layout) {
  const codes = [];
  const walk = (nodos) => nodos.forEach(n => {
    if (n.tipo === 'detalle' && n.codigo) codes.push(String(n.codigo).trim());
    if (Array.isArray(n.hijos)) walk(n.hijos);
  });
  walk(layout);
  return codes;
}

// Cálculo recursivo: detalle -> subtotal/categoría/total
function computeNode(node, idx) {
  const metrics = zeroMetrics();
  let children = [];

  if (Array.isArray(node.hijos) && node.hijos.length) {
    children = node.hijos.map(h => computeNode(h, idx));
    // Agregación: suma de hijos
    children.forEach(ch => addMetrics(metrics, ch.metrics));
  } else if (node.tipo === 'detalle' && node.codigo) {
    const r = idx[String(node.codigo).trim()];
    if (r) {
      metrics.mesActual = r.mesActual || 0;
      metrics.mesPlan = r.mesPlan || 0;
      metrics.mesAnterior = r.mesAnterior || 0;

      metrics.acumuladoActual = r.acumuladoActual || 0;
      metrics.acumuladoPlan = r.acumuladoPlan || 0;
      metrics.acumuladoAnterior = r.acumuladoAnterior || 0;
    }
  }

  // Variaciones %
  metrics.mesVariacionPlan = pct(metrics.mesActual, metrics.mesPlan);
  metrics.mesVariacionAnterior = pct(metrics.mesActual, metrics.mesAnterior);
  metrics.acumuladoVariacionPlan = pct(metrics.acumuladoActual, metrics.acumuladoPlan);
  metrics.acumuladoVariacionAnterior = pct(metrics.acumuladoActual, metrics.acumuladoAnterior);

  return { row: node, metrics, children };
}
function computeTree(layout, idx) { return layout.map(n => computeNode(n, idx)); }

// Aplana árbol -> arreglo que entiende el renderer
function flattenForRender(tree) {
  const out = [];
  const walk = (node, depth = 0) => {
    const { row, metrics, children } = node;

    if (row.tipo === 'categoria' || row.tipo === 'subtotal' || row.tipo === 'total') {
      out.push({
        tipo: 'categoria',
        estilo: row.estilo || estiloPorTipo(row.tipo),
        etiqueta: row.etiqueta || row.label || '',
        // Métricas
        mesActual: metrics.mesActual,
        mesPlan: metrics.mesPlan,
        mesAnterior: metrics.mesAnterior,
        mesVariacionPlan: metrics.mesVariacionPlan,
        mesVariacionAnterior: metrics.mesVariacionAnterior,
        acumuladoActual: metrics.acumuladoActual,
        acumuladoPlan: metrics.acumuladoPlan,
        acumuladoAnterior: metrics.acumuladoAnterior,
        acumuladoVariacionPlan: metrics.acumuladoVariacionPlan,
        acumuladoVariacionAnterior: metrics.acumuladoVariacionAnterior,
        depth
      });
    } else {
      out.push({
        tipo: 'detalle',
        codigo: row.codigo,
        descripcion: row.descripcion || '',
        // Métricas
        mesActual: metrics.mesActual,
        mesPlan: metrics.mesPlan,
        mesAnterior: metrics.mesAnterior,
        mesVariacionPlan: metrics.mesVariacionPlan,
        mesVariacionAnterior: metrics.mesVariacionAnterior,
        acumuladoActual: metrics.acumuladoActual,
        acumuladoPlan: metrics.acumuladoPlan,
        acumuladoAnterior: metrics.acumuladoAnterior,
        acumuladoVariacionPlan: metrics.acumuladoVariacionPlan,
        acumuladoVariacionAnterior: metrics.acumuladoVariacionAnterior,
        depth
      });
    }
    (children || []).forEach(ch => walk(ch, depth + 1));
  };
  tree.forEach(n => walk(n, 0));
  return out;
}

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
};

// ======================================================
// === FETCH / DATA PIPELINE
// ======================================================
async function fetchSummary({ anio, periodo, empresaId }) {
  const codigos = collectCodes(CURRENT_LAYOUT);

  // set contexto
  CTX.anio = anio;
  CTX.periodo = periodo;
  CTX.anioComparativo = anio - 1;
  CTX.incluirAjusteEnYTD = false;      // cámbialo si quieres expositor en UI
  CTX.fuente = 'SALDOSxx';             // o 'ACUMxx' según la fuente

  if (CALC_STRATEGY.modo === 'server') {
    // Backend ya devuelve {detalle: [...métricas...], ejercicios: [...]}
    const resp = await fetch(`${API_BASE}/modulos/summary-resumen-e`, {
      method: 'POST',
      headers: { ...Sesion.headersAutenticacion(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ anio, periodo, empresaId, codigos })
    });
    const data = await resp.json();
    if (!resp.ok) throw new Error(data.mensaje || 'No fue posible obtener la información.');
    return {
      detalle: Array.isArray(data.detalle) ? data.detalle : [],
      ejercicios: Array.isArray(data.ejercicios) ? data.ejercicios : []
    };
  }

  // === Modo client: el backend regresa crudo y aquí operamos ===
  const resp = await fetch(`${API_BASE}/modulos/summary-crudo`, {
    method: 'POST',
    headers: { ...Sesion.headersAutenticacion(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ anio, periodo, empresaId, codigos, fuente: CALC_STRATEGY.fuente() })
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

  return { detalle, ejercicios: raw.ejercicios || [] };
}

// ======================================================
// === RENDER DE TABLA (respeta estilos y jerarquía) ===
// ======================================================
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

  filas.forEach((fila) => {
    const tr = document.createElement('tr');

    if (fila.tipo === 'categoria') {
      tr.className = fila.estilo || THEME.categoria;
      tr.innerHTML = `
        <th></th>
        <td class="mono">${formatearMoneda(fila.mesActual)}</td>
        <td class="mono">${formatearMoneda(fila.mesPlan)}</td>
        <td class="mono">${formatearMoneda(fila.mesAnterior)}</td>
        <td class="mono">${formatearPorcentaje(fila.mesVariacionPlan)}</td>
        <td class="mono">${formatearPorcentaje(fila.mesVariacionAnterior)}</td>
        <td class="category-cell" data-depth="${fila.depth||0}" style="--depth:${fila.depth||0}">${fila.etiqueta || ''}</td>
        <td class="mono">${formatearMoneda(fila.acumuladoActual)}</td>
        <td class="mono">${formatearMoneda(fila.acumuladoPlan)}</td>
        <td class="mono">${formatearMoneda(fila.acumuladoAnterior)}</td>
        <td class="mono">${formatearPorcentaje(fila.acumuladoVariacionPlan)}</td>
        <td class="mono">${formatearPorcentaje(fila.acumuladoVariacionAnterior)}</td>
      `;
    } else {
      tr.innerHTML = `
        <th class="code-cell">${fila.codigo || ''}</th>
        <td class="mono">${formatearMoneda(fila.mesActual)}</td>
        <td class="mono">${formatearMoneda(fila.mesPlan)}</td>
        <td class="mono">${formatearMoneda(fila.mesAnterior)}</td>
        <td class="mono">${formatearPorcentaje(fila.mesVariacionPlan)}</td>
        <td class="mono">${formatearPorcentaje(fila.mesVariacionAnterior)}</td>
        <td class="label-cell" data-depth="${fila.depth||0}" style="--depth:${fila.depth||0}">${fila.descripcion || ''}</td>
        <td class="mono">${formatearMoneda(fila.acumuladoActual)}</td>
        <td class="mono">${formatearMoneda(fila.acumuladoPlan)}</td>
        <td class="mono">${formatearMoneda(fila.acumuladoAnterior)}</td>
        <td class="mono">${formatearPorcentaje(fila.acumuladoVariacionPlan)}</td>
        <td class="mono">${formatearPorcentaje(fila.acumuladoVariacionAnterior)}</td>
      `;
    }
    body.appendChild(tr);
  });
}

// ==============================================================
// === ACCIONES (agregar/quitar cuentas conservando estilos)  ===
// ==============================================================
function addDetail(parentId, codigo, descripcion = '') {
  const deep = (xs) => xs.map(x => {
    if (x.id === parentId) {
      const hijos = Array.isArray(x.hijos) ? x.hijos.slice() : [];
      hijos.push({ id: `det_${codigo}`, tipo: 'detalle', codigo: String(codigo), descripcion });
      return { ...x, hijos };
    }
    return { ...x, hijos: x.hijos ? deep(x.hijos) : x.hijos };
  });
  CURRENT_LAYOUT = deep(CURRENT_LAYOUT);
  saveLayoutLS(CURRENT_LAYOUT);
}

function removeByCode(codigo) {
  const deep = (xs) => xs.map(x => ({ ...x, hijos: x.hijos ? deep(x.hijos) : x.hijos }))
    .filter(x => !(x.tipo === 'detalle' && String(x.codigo).trim() === String(codigo).trim()));
  CURRENT_LAYOUT = deep(CURRENT_LAYOUT);
  saveLayoutLS(CURRENT_LAYOUT);
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

  setAllYearSpans(anio);
  mostrarEstado('Calculando…');

  try {
    const { detalle, ejercicios } = await fetchSummary({
      anio,
      periodo,
      empresaId: (typeof sesion !== 'undefined' ? sesion?.empresaId : undefined)
    });

    // index por codigo para el motor
    const idx = buildIndex(detalle);
    // cálculo jerárquico
    const tree = computeTree(CURRENT_LAYOUT, idx);

    // aplanado para tu renderer
    estadoModulo.tabla = flattenForRender(tree);
    estadoModulo.ejercicios = ejercicios;

    actualizarResumen(anio);
    renderizarTabla();
    limpiarEstado();
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
document.addEventListener('DOMContentLoaded', () => {
  // Botón "Aplicar selección"
  document.getElementById('btnAplicar')?.addEventListener('click', aplicarSeleccionUI);

  // Mantener sincronizados los <span.anio> del header
  const summaryYearSelect = document.getElementById('summaryYearSelect');
  const filtroAnio = document.getElementById('selectAnio');

  if (summaryYearSelect) {
    summaryYearSelect.addEventListener('change', (event) => {
      const seleccionado = event.target.value;
      setAllYearSpans(seleccionado);
      actualizarResumen(seleccionado);
      if (filtroAnio && filtroAnio.value !== seleccionado) filtroAnio.value = seleccionado;
    });
  }
  if (filtroAnio) {
    filtroAnio.addEventListener('change', (event) => {
      const seleccionado = event.target.value;
      setAllYearSpans(seleccionado);
      actualizarResumen(seleccionado);
      if (summaryYearSelect && summaryYearSelect.value !== seleccionado) summaryYearSelect.value = seleccionado;
    });
  }

  // Carga inicial
  cargarDatos();
});
