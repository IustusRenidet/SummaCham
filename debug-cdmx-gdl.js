const Database = require('better-sqlite3');
const db = new Database('./datos/panel.sqlite', { readonly: true });

// Check CDMX variant (with accent) ops
const cdmxAccent = db.prepare(`
  SELECT id, capitulo, clase, operacion_label, operacion_tipo, signo, orden_presentacion, formula_json
  FROM layout_operaciones
  WHERE empresa_id='EMPRESA01' AND modulo='RESUMEN' AND capitulo='CIUDAD DE MÉXICO'
  AND (operacion_label LIKE '%CONSOLIDATED%' OR clase LIKE '%CONSOLIDATED%')
  ORDER BY orden_presentacion, orden
`).all();
console.log('=== CIUDAD DE MÉXICO (accent) CONSOLIDATED ===');
cdmxAccent.forEach(op => {
    let f = 'NO formula_json';
    if (op.formula_json) {
        try { const fa = JSON.parse(op.formula_json); if (Array.isArray(fa)) f = fa.map(t => `${t.operator} ${t.type}:"${t.value}"`).join(' | '); } catch (e) { }
    }
    console.log(`ID:${op.id} clase:${op.clase} tipo:${op.operacion_tipo} ord_pres:${op.orden_presentacion}\n  formula: ${f}`);
});

// Check CDMX (without accent) CONSOLIDATED EXPENSES
const cdmxNoAccent = db.prepare(`
  SELECT id, capitulo, clase, operacion_label, operacion_tipo, signo, orden_presentacion, formula_json
  FROM layout_operaciones
  WHERE empresa_id='EMPRESA01' AND modulo='RESUMEN' AND capitulo='CIUDAD DE MEXICO'
  AND (operacion_label LIKE '%CONSOLIDATED%' OR clase LIKE '%CONSOLIDATED%')
  ORDER BY orden_presentacion, orden
`).all();
console.log('\n=== CIUDAD DE MEXICO (no accent) CONSOLIDATED ===');
cdmxNoAccent.forEach(op => {
    let f = 'NO formula_json';
    if (op.formula_json) {
        try { const fa = JSON.parse(op.formula_json); if (Array.isArray(fa)) f = fa.map(t => `${t.operator} ${t.type}:"${t.value}"`).join(' | '); } catch (e) { }
    }
    console.log(`ID:${op.id} clase:${op.clase} tipo:${op.operacion_tipo} ord_pres:${op.orden_presentacion}\n  formula: ${f}`);
});

// Also check GUADALAJARA CONSOLIDATED
const gdl = db.prepare(`
  SELECT id, capitulo, clase, operacion_label, operacion_tipo, signo, orden_presentacion, formula_json
  FROM layout_operaciones
  WHERE empresa_id='EMPRESA01' AND modulo='RESUMEN' AND capitulo='GUADALAJARA'
  AND (operacion_label LIKE '%CONSOLIDATED%' OR clase LIKE '%CONSOLIDATED%')
  ORDER BY orden_presentacion, orden
`).all();
console.log('\n=== GUADALAJARA CONSOLIDATED ===');
gdl.forEach(op => {
    let f = 'NO formula_json';
    if (op.formula_json) {
        try { const fa = JSON.parse(op.formula_json); if (Array.isArray(fa)) f = fa.map(t => `${t.operator} ${t.type}:"${t.value}"`).join(' | '); } catch (e) { }
    }
    console.log(`ID:${op.id} clase:${op.clase} tipo:${op.operacion_tipo} ord_pres:${op.orden_presentacion}\n  formula: ${f}`);
});

db.close();
process.exit(0);
