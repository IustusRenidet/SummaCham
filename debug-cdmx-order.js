/**
 * Check CDMX layout around the end of expense section to find good ord_pres for CONSOLIDATED EXPENSES
 */
const Database = require('better-sqlite3');
const path = require('path');
const dbPath = path.join(__dirname, 'datos', 'panel.sqlite');
const db = new Database(dbPath);

// Show all CDMX ops from ord_pres 180 onwards
console.log('=== CDMX layout after expense section (ord >= 180) ===');
const after = db.prepare(`
  SELECT id, clase, operacion_tipo, operacion_label, operacion_etiqueta, orden_presentacion
  FROM layout_operaciones
  WHERE empresa_id='EMPRESA01' AND modulo='RESUMEN' AND anio=2026
  AND (capitulo='CIUDAD DE MEXICO' OR capitulo='CIUDAD DE MÉXICO')
  AND orden_presentacion >= 180
  ORDER BY orden_presentacion, id
`).all();
after.forEach(r => console.log(`  ord=${r.orden_presentacion} tipo="${r.operacion_tipo}" label="${r.operacion_label}" clase="${r.clase}"`));

// Also show CDMX current CONSOLIDATED EXPENSES position
console.log('\n=== Current CONSOLIDATED EXPENSES entry in CDMX ===');
const consExp = db.prepare(`
  SELECT id, clase, operacion_tipo, operacion_label, orden_presentacion, formula_json
  FROM layout_operaciones
  WHERE empresa_id='EMPRESA01' AND modulo='RESUMEN' AND anio=2026
  AND (capitulo='CIUDAD DE MEXICO' OR capitulo='CIUDAD DE MÉXICO')
  AND clase = 'CONSOLIDATED_EXPENSES'
  ORDER BY id
`).all();
consExp.forEach(r => {
    const f = r.formula_json ? JSON.parse(r.formula_json) : null;
    const ops = f ? f.map(t => `${t.operator}${t.type}:${t.value}`).join(', ') : 'NO FORMULA';
    console.log(`  ID=${r.id} ord=${r.orden_presentacion} tipo="${r.operacion_tipo}" label="${r.operacion_label}"`);
    console.log(`    Formula: ${ops}`);
});

// Show NORESTE consolidated structure for reference
console.log('\n=== NORESTE consolidated structure (for reference) ===');
const noresteConsolidated = db.prepare(`
  SELECT id, clase, operacion_tipo, operacion_label, orden_presentacion
  FROM layout_operaciones
  WHERE empresa_id='EMPRESA01' AND modulo='RESUMEN' AND capitulo='NORESTE' AND anio=2026
  AND orden_presentacion IN (100, 240, 290, 390)
  ORDER BY orden_presentacion, id
`).all();
noresteConsolidated.forEach(r => console.log(`  ord=${r.orden_presentacion} tipo="${r.operacion_tipo}" label="${r.operacion_label}" clase="${r.clase}"`));

db.close();
