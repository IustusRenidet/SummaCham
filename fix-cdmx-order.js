/**
 * Move CDMX CONSOLIDATED EXPENSES from ord_pres=48 to ord_pres=240
 * to match NORESTE/NOROESTE pattern where CONSOLIDATED EXPENSE appears at ord=240
 */
const Database = require('better-sqlite3');
const path = require('path');
const dbPath = path.join(__dirname, 'datos', 'panel.sqlite');
const db = new Database(dbPath);

console.log('=== Moving CDMX CONSOLIDATED EXPENSES to ord_pres=240 ===\n');

// Update the 3 CDMX CONSOLIDATED_EXPENSES rows from ord_pres=48 to 240
const stmt = db.prepare(`
  UPDATE layout_operaciones 
  SET orden_presentacion = 240, orden = 24009
  WHERE empresa_id='EMPRESA01' AND modulo='RESUMEN' AND anio=2026
  AND (capitulo='CIUDAD DE MEXICO' OR capitulo='CIUDAD DE MÉXICO')
  AND clase = 'CONSOLIDATED_EXPENSES'
`);
const result = stmt.run();
console.log(`Updated ${result.changes} rows to ord_pres=240`);

// Verify
console.log('\nVerification:');
const rows = db.prepare(`
  SELECT id, clase, operacion_tipo, operacion_label, orden_presentacion, orden
  FROM layout_operaciones
  WHERE empresa_id='EMPRESA01' AND modulo='RESUMEN' AND anio=2026
  AND (capitulo='CIUDAD DE MEXICO' OR capitulo='CIUDAD DE MÉXICO')
  AND clase = 'CONSOLIDATED_EXPENSES'
  ORDER BY id
`).all();
rows.forEach(r => console.log(`  ID=${r.id} ord_pres=${r.orden_presentacion} orden=${r.orden} tipo="${r.operacion_tipo}" label="${r.operacion_label}"`));

db.close();
