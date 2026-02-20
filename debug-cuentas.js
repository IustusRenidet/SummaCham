const Database = require('better-sqlite3');
const db = new Database('./datos/panel.sqlite', { readonly: true });

// Check layout_cuentas for CDMX RESUMEN, specifically Guadalajara Expense section
const cols = db.prepare("PRAGMA table_info(layout_cuentas)").all();
console.log('layout_cuentas cols:', JSON.stringify(cols.map(c => c.name)));

const gdlCuentas = db.prepare(`
  SELECT * FROM layout_cuentas
  WHERE empresa_id='EMPRESA01' AND modulo='RESUMEN' AND capitulo='CIUDAD DE MEXICO'
  AND (seccion LIKE '%Guadalajara%' OR seccion LIKE '%guadalajara%' OR clase LIKE '%Guadalajara%')
  ORDER BY seccion, cuenta
`).all();
console.log('\n=== CDMX Guadalajara Expense accounts ===');
console.log(JSON.stringify(gdlCuentas, null, 2));

// Also check all CDMX sections for expense type
const sects = db.prepare(`
  SELECT DISTINCT seccion, clase FROM layout_cuentas
  WHERE empresa_id='EMPRESA01' AND modulo='RESUMEN' AND capitulo='CIUDAD DE MEXICO'
  AND (seccion LIKE '%Expense%' OR clase LIKE '%expense%')
  ORDER BY seccion
`).all();
console.log('\n=== CDMX expense sections ===');
console.log(JSON.stringify(sects, null, 2));

db.close();
process.exit(0);
