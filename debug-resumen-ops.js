const Database = require('better-sqlite3');
const db = new Database('./datos/panel.sqlite', { readonly: true });

// All RESUMEN CDMX operations
const cdmxOps = db.prepare(`
  SELECT * FROM layout_operaciones 
  WHERE empresa_id='EMPRESA01' AND modulo='RESUMEN' AND capitulo='CIUDAD DE MEXICO'
  ORDER BY orden
`).all();
console.log('=== CDMX RESUMEN ops ===');
console.log(JSON.stringify(cdmxOps, null, 2));

// Any op with label containing "CONSOLIDATED"
const consOps = db.prepare(`
  SELECT * FROM layout_operaciones 
  WHERE empresa_id='EMPRESA01' AND modulo='RESUMEN' 
  AND (operacion_label LIKE '%CONSOLIDATED%' OR operacion_etiqueta LIKE '%CONSOLIDATED%' OR clase LIKE '%CONSOLIDATED%')
  ORDER BY capitulo, orden
`).all();
console.log('\n=== CONSOLIDATED ops ===');
console.log(JSON.stringify(consOps, null, 2));

// Guadalajara expense operations 
const gdlExpense = db.prepare(`
  SELECT * FROM layout_operaciones
  WHERE empresa_id='EMPRESA01' AND modulo='RESUMEN' AND capitulo='GUADALAJARA'
  AND (seccion LIKE '%Expense%' OR seccion LIKE '%EXPENSE%' OR clase LIKE '%Expense%')
  ORDER BY orden
`).all();
console.log('\n=== GDL Expense ops ===');
console.log(JSON.stringify(gdlExpense, null, 2));

// Distinct capitulos in RESUMEN
const caps = db.prepare(`
  SELECT DISTINCT capitulo FROM layout_operaciones 
  WHERE empresa_id='EMPRESA01' AND modulo='RESUMEN'
`).all();
console.log('\n=== RESUMEN Capitulos ===', JSON.stringify(caps));

db.close();
process.exit(0);
