const Database = require('better-sqlite3');
const db = new Database('./datos/panel.sqlite', { readonly: true });

// Get GDL RESUMEN ops sorted
const gdlOps = db.prepare(`
  SELECT DISTINCT clase, operacion_label, operacion_tipo, orden_presentacion, visible
  FROM layout_operaciones
  WHERE empresa_id='EMPRESA01' AND modulo='RESUMEN' AND capitulo='GUADALAJARA'
  AND visible=1
  ORDER BY orden_presentacion
  LIMIT 60
`).all();
console.log('=== GUADALAJARA RESUMEN ops ===');
gdlOps.forEach(op => console.log(`  ord_pres:${op.orden_presentacion} tipo:${op.operacion_tipo} clase:${op.clase} label:${op.operacion_label}`));

// Show GDL ops around CONSOLIDATED area (ord_pres 80-260)
const gdlConsolidated = db.prepare(`
  SELECT id, clase, operacion_label, operacion_tipo, orden_presentacion, signo, formula_json
  FROM layout_operaciones
  WHERE empresa_id='EMPRESA01' AND modulo='RESUMEN' AND capitulo='GUADALAJARA'
  AND orden_presentacion >= 80
  ORDER BY orden_presentacion, id
`).all();
console.log('\n=== GUADALAJARA ops from ord_pres 80+:');
gdlConsolidated.forEach(op => {
    let f = op.formula_json ? op.formula_json.substring(0, 150) : 'null';
    console.log(`  ord_pres:${op.orden_presentacion} tipo:${op.operacion_tipo} clase:${op.clase} label:${op.operacion_label} formula:${f}`);
});

db.close();
process.exit(0);
