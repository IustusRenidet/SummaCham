const Database = require('better-sqlite3');
const db = new Database('./datos/panel.sqlite', { readonly: true });

// Get OPERATING RESULTS operations for CDMX
const opRes = db.prepare(`
  SELECT id, capitulo, clase, operacion_label, operacion_tipo, signo, orden_presentacion, formula_json
  FROM layout_operaciones
  WHERE empresa_id='EMPRESA01' AND modulo='RESUMEN'
  AND (operacion_label LIKE '%OPERATING RESULT%' OR operacion_etiqueta LIKE '%OPERATING RESULT%' OR clase LIKE '%OPERATING RESULT%')
  ORDER BY capitulo, orden_presentacion
`).all();
console.log('=== OPERATING RESULTS ===');
opRes.forEach(op => {
    console.log(`\n capitulo:${op.capitulo} clase:${op.clase} label:${op.operacion_label} tipo:${op.operacion_tipo} signo:${op.signo}`);
    if (op.formula_json) {
        try {
            const f = JSON.parse(op.formula_json);
            if (Array.isArray(f)) {
                f.forEach(t => console.log(`  ${t.operator} ${t.type}:${t.value}`));
            } else {
                console.log('  formula_json (non-array):', op.formula_json.substring(0, 200));
            }
        } catch (e) {
            console.log('  formula_json:', op.formula_json.substring(0, 200));
        }
    }
});

// Also check NET RESULTS
const netRes = db.prepare(`
  SELECT id, capitulo, clase, operacion_label, operacion_tipo, signo, orden_presentacion, formula_json
  FROM layout_operaciones
  WHERE empresa_id='EMPRESA01' AND modulo='RESUMEN' AND capitulo='CIUDAD DE MEXICO'
  AND (operacion_label LIKE '%NET RESULT%' OR operacion_label LIKE '%RESULT%')
  ORDER BY orden_presentacion
`).all();
console.log('\n=== CDMX RESULTS ===');
netRes.forEach(op => {
    console.log(`\n clase:${op.clase} label:${op.operacion_label} tipo:${op.operacion_tipo} signo:${op.signo}`);
    if (op.formula_json) {
        try {
            const f = JSON.parse(op.formula_json);
            if (Array.isArray(f)) {
                f.forEach(t => console.log(`  ${t.operator} ${t.type}:${t.value}`));
            }
        } catch (e) { }
    }
});

db.close();
process.exit(0);
