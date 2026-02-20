const Database = require('better-sqlite3');
const db = new Database('./datos/panel.sqlite', { readonly: true });

// Check accounts for Guadalajara Expense in CDMX RESUMEN
const gdlCuentas = db.prepare(`
  SELECT * FROM layout_cuentas
  WHERE empresa_id='EMPRESA01' AND modulo='RESUMEN' AND capitulo='CIUDAD DE MEXICO'
  AND (seccion_principal LIKE '%Guadalajara%' OR seccion_secundaria LIKE '%Guadalajara%')
  ORDER BY seccion_principal, cuenta
`).all();
console.log('=== CDMX Guadalajara section accounts ===');
console.log(JSON.stringify(gdlCuentas, null, 2));

// All distinct sections in CDMX RESUMEN
const sects = db.prepare(`
  SELECT DISTINCT seccion_principal FROM layout_cuentas
  WHERE empresa_id='EMPRESA01' AND modulo='RESUMEN' AND capitulo='CIUDAD DE MEXICO'
  ORDER BY seccion_principal
`).all();
console.log('\n=== CDMX RESUMEN sections ===');
console.log(JSON.stringify(sects.map(s => s.seccion_principal)));

// Get EXPENSE section accounts with factors
const expenseCuentas = db.prepare(`
  SELECT cuenta, nombre, seccion_principal, operacion_factor, orden
  FROM layout_cuentas
  WHERE empresa_id='EMPRESA01' AND modulo='RESUMEN' AND capitulo='CIUDAD DE MEXICO'
  AND seccion_principal IN ('EXPENSE','Guadalajara Expense','Monterrey Expense','Northwest Expense','Guadalajara Other Income','Monterrey Other Income','Northwest Other Income')
  ORDER BY seccion_principal, orden
`).all();
console.log('\n=== CDMX Consolidated expense accounts ===');
console.log(JSON.stringify(expenseCuentas, null, 2));

db.close();
process.exit(0);
