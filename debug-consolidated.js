const Database = require('better-sqlite3');
const db = new Database('./datos/panel.sqlite', { readonly: true });

// Get all CONSOLIDATED EXPENSES and related rows with full detail
const consOps = db.prepare(`
  SELECT * FROM layout_operaciones 
  WHERE empresa_id='EMPRESA01' AND modulo='RESUMEN' 
  AND (operacion_label LIKE '%CONSOLIDATED%' OR clase LIKE '%CONSOLIDATED%')
  ORDER BY capitulo, orden_presentacion, orden
`).all();
console.log('=== ALL CONSOLIDATED OPS ===');
consOps.forEach(op => {
    console.log(`\n--- ID:${op.id} capitulo:${op.capitulo} clase:${op.clase} label:${op.operacion_label} tipo:${op.operacion_tipo} orden:${op.orden} orden_pres:${op.orden_presentacion} signo:${op.signo}`);
    if (op.formula_json) console.log('  formula_json:', op.formula_json);
});

// Get CDMX sum-row-sumavarios type operations
const sumaVarios = db.prepare(`
  SELECT * FROM layout_operaciones
  WHERE empresa_id='EMPRESA01' AND modulo='RESUMEN' AND capitulo='CIUDAD DE MEXICO'
  AND operacion_tipo IN ('sum-row-sumavarios', 'sum-row-sumavarios-consolidado', 'sum-row-sumavarios2')
  ORDER BY orden
`).all();
console.log('\n=== CDMX SUMA VARIOS OPS ===');
console.log(JSON.stringify(sumaVarios, null, 2));

// Check how CONSOLIDATED INCOME formula works (for reference)
const consIncome = db.prepare(`
  SELECT * FROM layout_operaciones
  WHERE empresa_id='EMPRESA01' AND modulo='RESUMEN' AND capitulo='CIUDAD DE MEXICO'
  AND operacion_label LIKE '%CONSOLIDATED INCOME%'
  ORDER BY orden
`).all();
console.log('\n=== CONSOLIDATED INCOME DETAILS ===');
console.log(JSON.stringify(consIncome, null, 2));

db.close();
process.exit(0);
