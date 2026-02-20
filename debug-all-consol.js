const Database = require('better-sqlite3');
const db = new Database('./datos/panel.sqlite', { readonly: true });

// Get ALL CONSOLIDATED EXPENSES ops with formula_json and without
const allConsolidated = db.prepare(`
  SELECT id, capitulo, clase, operacion_label, operacion_tipo, signo, orden, orden_presentacion, formula_json
  FROM layout_operaciones
  WHERE empresa_id='EMPRESA01' AND modulo='RESUMEN'
  AND (operacion_label LIKE '%CONSOLIDATED EXPENSES%' OR clase LIKE '%CONSOLIDATED EXPENSES%')
  ORDER BY capitulo, orden_presentacion, orden
`).all();

console.log('=== ALL CONSOLIDATED EXPENSES (PLURAL) ===\n');
allConsolidated.forEach(op => {
    let formulaSummary = 'NO formula_json';
    if (op.formula_json) {
        try {
            const f = JSON.parse(op.formula_json);
            if (Array.isArray(f)) {
                formulaSummary = f.map(t => `${t.operator} ${t.type}:"${t.value}"`).join(', ');
            } else {
                formulaSummary = op.formula_json.substring(0, 200);
            }
        } catch (e) {
            formulaSummary = `PARSE_ERROR: ${op.formula_json.substring(0, 100)}`;
        }
    }
    console.log(`ID:${op.id} cap:${op.capitulo} clase:${op.clase} tipo:${op.operacion_tipo} ord_pres:${op.orden_presentacion}`);
    console.log(`  formula: ${formulaSummary}\n`);
});

// Also check all chapters in RESUMEN
const caps = db.prepare(`SELECT DISTINCT capitulo FROM layout_operaciones WHERE empresa_id='EMPRESA01' AND modulo='RESUMEN' ORDER BY capitulo`).all();
console.log('\nAll RESUMEN capitulos:', caps.map(c => c.capitulo).join(', '));

db.close();
process.exit(0);
