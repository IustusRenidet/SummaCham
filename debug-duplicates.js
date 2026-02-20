/**
 * Deep check on NORESTE/NOROESTE duplicate entries to understand key collision
 */
const Database = require('better-sqlite3');
const path = require('path');
const dbPath = path.join(__dirname, 'datos', 'panel.sqlite');
const db = new Database(dbPath);

console.log('=== DEEP CHECK: NORESTE duplicate entries ===\n');

const noreste = db.prepare(`
  SELECT id, clase, seccion, operacion_tipo, operacion_label, operacion_etiqueta, signo, orden, orden_presentacion, visible, formula_json
  FROM layout_operaciones
  WHERE empresa_id='EMPRESA01' AND modulo='RESUMEN' AND capitulo='NORESTE'
  AND (clase LIKE '%CONSOLIDATED%' OR operacion_etiqueta LIKE '%CONSOLIDATED%' OR operacion_label LIKE '%CONSOLIDATED EXPENSE%')
  ORDER BY orden_presentacion, id
`).all();

console.log('NORESTE rows:');
noreste.forEach(r => {
    const f = r.formula_json ? JSON.parse(r.formula_json) : null;
    const ops = f ? f.map(t => `${t.operator}${t.type}:${t.value}`).join(', ') : 'NO FORMULA';
    console.log(`  ID=${r.id} clase="${r.clase}" etiqueta="${r.operacion_etiqueta}" tipo="${r.operacion_tipo}" label="${r.operacion_label}" ord=${r.orden_presentacion}`);
    console.log(`    Formula: ${ops}`);
});

console.log('\n\n=== DEEP CHECK: NOROESTE duplicate entries ===\n');

const noroeste = db.prepare(`
  SELECT id, clase, seccion, operacion_tipo, operacion_label, operacion_etiqueta, signo, orden, orden_presentacion, visible, formula_json
  FROM layout_operaciones
  WHERE empresa_id='EMPRESA01' AND modulo='RESUMEN' AND capitulo='NOROESTE'
  AND (clase LIKE '%CONSOLIDATED%' OR operacion_etiqueta LIKE '%CONSOLIDATED%' OR operacion_label LIKE '%CONSOLIDATED EXPENSE%')
  ORDER BY orden_presentacion, id
`).all();

console.log('NOROESTE rows:');
noroeste.forEach(r => {
    const f = r.formula_json ? JSON.parse(r.formula_json) : null;
    const ops = f ? f.map(t => `${t.operator}${t.type}:${t.value}`).join(', ') : 'NO FORMULA';
    console.log(`  ID=${r.id} clase="${r.clase}" etiqueta="${r.operacion_etiqueta}" tipo="${r.operacion_tipo}" label="${r.operacion_label}" ord=${r.orden_presentacion}`);
    console.log(`    Formula: ${ops}`);
});

db.close();
