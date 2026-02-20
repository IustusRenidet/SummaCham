const Database = require('better-sqlite3');
const db = new Database('./datos/panel.sqlite', { readonly: true });

// Get the HIGHEST orden_presentacion for CDMX to understand layout end
const maxOrd = db.prepare(`
  SELECT MAX(orden_presentacion) as max_ord FROM layout_operaciones
  WHERE empresa_id='EMPRESA01' AND modulo='RESUMEN' AND capitulo='CIUDAD DE MEXICO'
  AND visible=1
`).get();
console.log('Max ord_presentacion for CDMX:', maxOrd.max_ord);

// Get all unique ord_presentacion values after 180
const highOps = db.prepare(`
  SELECT DISTINCT orden_presentacion, operacion_tipo, operacion_label
  FROM layout_operaciones
  WHERE empresa_id='EMPRESA01' AND modulo='RESUMEN' AND capitulo='CIUDAD DE MEXICO'
  AND visible=1 AND orden_presentacion >= 140
  ORDER BY orden_presentacion
`).all();
console.log('\nCDMX ops from ord_pres 140+:');
highOps.forEach(op => console.log(`  ${op.orden_presentacion}: ${op.operacion_tipo} "${op.operacion_label}"`));

// Compare with NORESTE to understand ord_pres=240 area
const noresteHigh = db.prepare(`
  SELECT DISTINCT orden_presentacion, operacion_tipo, operacion_label, clase
  FROM layout_operaciones
  WHERE empresa_id='EMPRESA01' AND modulo='RESUMEN' AND capitulo='NORESTE'
  AND visible=1 AND orden_presentacion >= 200
  ORDER BY orden_presentacion
`).all();
console.log('\nNORESTE ops from ord_pres 200+:');
noresteHigh.forEach(op => console.log(`  ${op.orden_presentacion}: ${op.operacion_tipo} clase:${op.clase} "${op.operacion_label}"`));

db.close();
process.exit(0);
