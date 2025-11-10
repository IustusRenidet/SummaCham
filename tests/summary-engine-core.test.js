const test = require('node:test');
const assert = require('node:assert/strict');

const {
  buildSummaryRows,
  collectCodes,
  safeDiv,
  variationPercent
} = require('../vistas/js/summary-engine-core.js');

const SAMPLE_LAYOUT = [
  { id: 'ING', tipo: 'categoria', titulo: 'INGRESOS', componentes: ['ING_A', 'ING_B'] },
  { id: 'ING_A', tipo: 'cuenta', codigo: '401', titulo: 'Ingreso A', padre: 'ING' },
  { id: 'ING_B', tipo: 'cuenta', codigo: '402', titulo: 'Ingreso B', padre: 'ING' },
  { id: 'ING_SUB', tipo: 'subtotal', titulo: 'Total Ingresos', padre: 'ING', componentes: ['ING_A', 'ING_B'] },
  { id: 'GAS', tipo: 'categoria', titulo: 'GASTOS', componentes: ['GAS_A'] },
  { id: 'GAS_A', tipo: 'cuenta', codigo: '501', titulo: 'Gasto A', padre: 'GAS' },
  { id: 'GAS_SUB', tipo: 'subtotal', titulo: 'Total Gastos', padre: 'GAS', componentes: ['GAS_A'] },
  { id: 'RESULT', tipo: 'categoria', titulo: 'RESULTADO', componentes: ['UTI'] },
  { id: 'UTI', tipo: 'total', titulo: 'Utilidad', padre: 'RESULT', componentes: ['ING_SUB', 'GAS_SUB'] },
  { id: 'KPIS', tipo: 'categoria', titulo: 'INDICADORES', componentes: [] },
  {
    id: 'KPI_YTD_PLAN',
    tipo: 'kpi',
    titulo: '% YTD vs Plan',
    padre: 'KPIS',
    formula: 'UTI.acumuladoActual / UTI.acumuladoPlan',
    columnaYtd: 'acumuladoVariacionPlan',
    factor: 100
  },
  {
    id: 'KPI_MES_ANT',
    tipo: 'kpi',
    titulo: '% Mes vs Año Anterior',
    padre: 'KPIS',
    formulaMes: 'UTI.mesActual / UTI.mesAnterior',
    columnaMes: 'mesVariacionAnterior',
    factor: 100
  }
];

const DETALLE_BASE = [
  {
    codigo: '401',
    descripcion: 'Ingreso A',
    mesActual: 100,
    mesPlan: 90,
    mesAnterior: 80,
    acumuladoActual: 300,
    acumuladoPlan: 270,
    acumuladoAnterior: 240
  },
  {
    codigo: '402',
    descripcion: 'Ingreso B',
    mesActual: 50,
    mesPlan: 40,
    mesAnterior: 55,
    acumuladoActual: 120,
    acumuladoPlan: 100,
    acumuladoAnterior: 110
  },
  {
    codigo: '501',
    descripcion: 'Gasto A',
    mesActual: -30,
    mesPlan: -25,
    mesAnterior: -20,
    acumuladoActual: -90,
    acumuladoPlan: -80,
    acumuladoAnterior: -60
  }
];

test('collectCodes devuelve códigos únicos', () => {
  const codigos = collectCodes(SAMPLE_LAYOUT);
  assert.deepEqual(codigos.sort(), ['401', '402', '501']);
});

test('suma jerárquica y KPIs', () => {
  const filas = buildSummaryRows(SAMPLE_LAYOUT, DETALLE_BASE);
  const mapa = new Map(filas.map((fila) => [fila.rowId, fila]));

  assert.strictEqual(mapa.get('ING_SUB').mesActual, 150);
  assert.strictEqual(mapa.get('GAS_SUB').mesActual, -30);
  assert.strictEqual(mapa.get('UTI').mesActual, 120);
  assert.strictEqual(mapa.get('UTI').acumuladoActual, 330);

  const kpiYtd = mapa.get('KPI_YTD_PLAN');
  assert.ok(Math.abs(kpiYtd.acumuladoVariacionPlan - 113.793103) < 1e-3);

  const kpiMesAnt = mapa.get('KPI_MES_ANT');
  assert.ok(Math.abs(kpiMesAnt.mesVariacionAnterior - 104.347826) < 1e-3);

  assert.strictEqual(mapa.get('ING').depth, 0);
  assert.strictEqual(mapa.get('ING_A').depth, 1);
});

test('variaciones seguras y divisiones', () => {
  assert.strictEqual(safeDiv(10, 0), 0);
  assert.strictEqual(variationPercent(100, 0), 0);
  assert.ok(Math.abs(variationPercent(150, 130) - 15.384615) < 1e-6);
});

test('manejo de cuentas faltantes', () => {
  const detalle = DETALLE_BASE.filter((item) => item.codigo !== '402');
  const filas = buildSummaryRows(SAMPLE_LAYOUT, detalle);
  const mapa = new Map(filas.map((fila) => [fila.rowId, fila]));
  assert.strictEqual(mapa.get('ING_B').mesActual, 0);
  assert.strictEqual(mapa.get('ING_SUB').mesActual, 100);
});
