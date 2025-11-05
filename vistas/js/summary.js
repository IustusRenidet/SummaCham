/**********************************************************************
 * SUMMARY.JS — Motor de cálculo tipo Excel + render dinámico
 * ----------------------------------------------------------
 * • Carga jerarquía de categorías/subtotales/detalles
 * • Calcula Actual, Plan, 2021, YTD, variaciones %
 * • Respeta estilos (.highlight-primary, .amarillo, .verde, etc.)
 * • Soporta agregar/quitar cuentas y persistir layout en localStorage
 **********************************************************************/

const API_BASE = 'http://localhost:3000/api';
const estadoModulo = { ejercicios: [], tabla: [] };

// ======================================================
// === CONFIGURACIÓN DE ESTILOS Y MAPA DE PERIODOS
// ======================================================
const MES_A_PERIODO = {
  'enero': 1, 'febrero': 2, 'marzo': 3, 'abril': 4, 'mayo': 5,
  'junio': 6, 'julio': 7, 'agosto': 8, 'septiembre': 9, 'octubre': 10,
  'noviembre': 11, 'diciembre': 12, 'ajuste': 13
};

const setAllYearSpans = (anio) => {
  document.querySelectorAll('.anio').forEach(sp => sp.textContent = anio);
};

// ======================================================
// === LAYOUT BASE (Jerarquía y colores)
// ======================================================
const SUMMARY_LAYOUT_V1 = [
  {
    id: 'cdmx_income', tipo: 'categoria', estilo: 'highlight-primary', etiqueta: 'CDMX INCOME', hijos: [
      {
        id: 'membership', tipo: 'categoria', estilo: 'highlight-secondary', etiqueta: 'Membership', hijos: [
          { id: 'ctas_cuotas', tipo: 'detalle', codigo: '401000000000000000001', descripcion: 'Cuotas Netas' },
          { id: 'ctas_nuevos', tipo: 'detalle', codigo: '402000000000000000001', descripcion: 'Ingresos socios nuevos' },
          { id: 'membership_sub', tipo: 'subtotal', estilo: 'amarillo', etiqueta: 'Subtotal Membership' }
        ]
      },
      {
        id: 'events', tipo: 'categoria', estilo: 'highlight-secondary', etiqueta: 'EVENTS', hijos: [
          { id: 'ctas_eventos', tipo: 'detalle', codigo: '407000000000000000001', descripcion: 'Eventos' },
          { id: 'ctas_patro', tipo: 'detalle', codigo: '408000000000000000001', descripcion: 'Patrocinios' },
          { id: 'events_sub', tipo: 'subtotal', estilo: 'amarillo', etiqueta: 'Subtotal Events' }
        ]
      },
      { id: 'income_total', tipo: 'total', estilo: 'verde', etiqueta: 'TOTAL INCOME' }
    ]
  }
];

const saveLayoutLS = (l) => localStorage.setItem('summary_layout_v1', JSON.stringify(l));
const loadLayoutLS = () => { try { return JSON.parse(localStorage.getItem('summary_layout_v1') || 'null'); } catch { return null; } };
let CURRENT_LAYOUT = loadLayoutLS() ?? SUMMARY_LAYOUT_V1;

// ======================================================
// === UTILIDADES DE CÁLCULO TIPO EXCEL
// ======================================================
const zeroMetrics = () => ({
  mesActual: 0, mesPlan: 0, mesAnterior: 0, mesVariacionPlan: 0, mesVariacionAnterior: 0,
  acumuladoActual: 0, acumuladoPlan: 0, acumuladoAnterior: 0,
  acumuladoVariacionPlan: 0, acumuladoVariacionAnterior: 0
});
const pct = (a, b) => (Math.abs(b || 0) === 0 ? 0 : ((a - b) / Math.abs(b)) * 100);
const addMetrics = (dst, src) => { Object.keys(dst).forEach(k => dst[k] += (src[k] || 0)); return dst; };

// Índices por cuenta
function buildIndex(apiRows) {
  const idx = {};
  (apiRows || []).forEach(r => { idx[String(r.codigo).trim()] = r; });
  return idx;
}

// Recolecta códigos visibles
function collectCodes(layout) {
  const codes = [];
  const walk = (nodos) => nodos.forEach(n => {
    if (n.tipo === 'detalle' && n.codigo) codes.push(String(n.codigo).trim());
    if (Array.isArray(n.hijos)) walk(n.hijos);
  });
  walk(layout);
  return codes;
}

// Cálculo recursivo
function computeNode(node, idx) {
  const metrics = zeroMetrics();
  let children = [];

  if (Array.isArray(node.hijos) && node.hijos.length) {
    children = node.hijos.map(h => computeNode(h, idx));
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

  metrics.mesVariacionPlan = pct(metrics.mesActual, metrics.mesPlan);
  metrics.mesVariacionAnterior = pct(metrics.mesActual, metrics.mesAnterior);
  metrics.acumuladoVariacionPlan = pct(metrics.acumuladoActual, metrics.acumuladoPlan);
  metrics.acumuladoVariacionAnterior = pct(metrics.acumuladoActual, metrics.acumuladoAnterior);

  return { row: node, metrics, children };
}

function computeTree(layout, idx) { return layout.map(n => computeNode(n, idx)); }

function flattenForRender(tree) {
  const out = [];
  const walk = (node, depth = 0) => {
    const { row, metrics, children } = node;

    if (row.tipo === 'categoria' || row.tipo === 'subtotal' || row.tipo === 'total') {
      out.push({
        tipo: 'categoria',
        estilo: row.estilo || 'highlight-primary',
        etiqueta: row.etiqueta || row.label || '',
        ...metrics,
        depth
      });
    } else {
      out.push({
        tipo: 'detalle',
        codigo: row.codigo,
        descripcion: row.descripcion || '',
        ...metrics,
        depth
      });
    }
    (children || []).forEach(ch => walk(ch, depth + 1));
  };
  tree.forEach(n => walk(n, 0));
  return out;
}

// ======================================================
// === FETCH Y POBLADO DE DATOS
// ======================================================
async function fetchSummary({ anio, periodo, empresaId }) {
  const codigos = collectCodes(CURRENT_LAYOUT);
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

// ======================================================
// === UI PRINCIPAL
// ======================================================
async function aplicarSeleccionUI() {
  const anio = Number(document.getElementById('selectAnio').value);
  const mesNombre = document.getElementById('selectMes').value.toLowerCase();
  const periodo = MES_A_PERIODO[mesNombre] || 1;

  setAllYearSpans(anio);
  mostrarEstado('Calculando…');

  try {
    const { detalle, ejercicios } = await fetchSummary({ anio, periodo, empresaId: sesion?.empresaId });
    const idx = buildIndex(detalle);
    const tree = computeTree(CURRENT_LAYOUT, idx);

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

async function cargarDatos() {
  await aplicarSeleccionUI();
}

// ======================================================
// === AGREGAR / QUITAR CUENTAS DEL LAYOUT
// ======================================================
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

// ======================================================
// === EVENTOS DE UI
// ======================================================
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('btnAplicar')?.addEventListener('click', aplicarSeleccionUI);
});
