const Database = require('better-sqlite3');
const db = new Database('./datos/panel.sqlite', { readonly: true });

// Check all CDMX ops with sum-row-* fields (old style) 
// They are stored in the operacion_tipo column for old records
const cdmxOldStyle = db.prepare(`
  SELECT id, capitulo, clase, operacion_label, operacion_tipo, signo, orden_presentacion, formula_json
  FROM layout_operaciones
  WHERE empresa_id='EMPRESA01' AND modulo='RESUMEN' AND capitulo='CIUDAD DE MEXICO'
  AND operacion_tipo IN ('sum-row', 'sum-row-sumavarios', 'sum-row-sumavarios-consolidado', 'result-row', 'sum-row-operativo', 'sum-row-operativo-consolidado')
  ORDER BY orden_presentacion, orden
`).all();
console.log('=== CDMX old-style ops ===');
cdmxOldStyle.forEach(op => {
    console.log(`ID:${op.id} tipo:${op.operacion_tipo} ord_pres:${op.orden_presentacion} clase:${op.clase} label:${op.operacion_label} formula:${op.formula_json ? op.formula_json.substring(0, 100) : 'null'}`);
});

// More importanly - check free-operations in CDMX
const cdmxFreeOps = db.prepare(`
  SELECT id, capitulo, clase, operacion_label, operacion_tipo, signo, orden_presentacion, formula_json
  FROM layout_operaciones
  WHERE empresa_id='EMPRESA01' AND modulo='RESUMEN' AND capitulo='CIUDAD DE MEXICO'
  AND operacion_tipo='free-operation'
  ORDER BY orden_presentacion, orden
`).all();
console.log('\n=== CDMX free-operations ===');
cdmxFreeOps.forEach(op => {
    let f = 'NO formula_json';
    if (op.formula_json) {
        try { const fa = JSON.parse(op.formula_json); if (Array.isArray(fa)) f = fa.map(t => `${t.operator} ${t.type}:"${t.value}"`).join(' | '); } catch (e) { }
    }
    console.log(`ID:${op.id} clase:${op.clase} ord_pres:${op.orden_presentacion}`);
    console.log(`  formula: ${f}`);
});

// Also check related CDMX ops that set consolidated labels
const relatedOps = db.prepare(`
  SELECT id, capitulo, clase, operacion_label, operacion_tipo, signo, orden_presentacion
  FROM layout_operaciones
  WHERE empresa_id='EMPRESA01' AND modulo='RESUMEN' AND capitulo='CIUDAD DE MEXICO'
  ORDER BY orden_presentacion, orden
  LIMIT 100
`).all();
console.log('\n=== CDMX ALL OPS (first 100 by orden_presentacion) ===');
relatedOps.forEach(op => {
    console.log(`ord_pres:${op.orden_presentacion} tipo:${op.operacion_tipo} clase:${op.clase} label:${op.operacion_label}`);
});

db.close();
process.exit(0);
