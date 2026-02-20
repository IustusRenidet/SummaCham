const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'datos', 'panel.sqlite');
const db = new Database(dbPath);

console.log('=== Fixing GUADALAJARA CONSOLIDATED EXPENSES ===\n');

// GDL CONSOLIDATED EXPENSES formula: CDMX EXPENSE - Guadalajara Expense - Monterrey Expense - Northwest Expense
// Following NORESTE/NOROESTE pattern but using operation type (GDL has separate operation rows for each chapter's expense)
const gdlFormula = JSON.stringify([
    { operator: '+', type: 'operation', value: 'CDMX EXPENSE', id: 1 },
    { operator: '-', type: 'operation', value: 'Guadalajara Expense', id: 2 },
    { operator: '-', type: 'operation', value: 'Monterrey Expense', id: 3 },
    { operator: '-', type: 'operation', value: 'Northwest Expense', id: 4 },
]);

console.log('New GDL formula:', gdlFormula);

// Update both CONSOLIDATED EXPENSE and CONSOLIDATED EXPENSES entries
const result = db.prepare(`
  UPDATE layout_operaciones SET formula_json = ?, actualizado_en = datetime('now')
  WHERE empresa_id='EMPRESA01' AND modulo='RESUMEN' AND capitulo='GUADALAJARA'
  AND clase IN ('CONSOLIDATED EXPENSE', 'CONSOLIDATED EXPENSES')
  AND formula_json IS NULL
`).run(gdlFormula);

console.log(`Updated ${result.changes} GDL CONSOLIDATED EXPENSE(S) entries`);

// Verify
const verify = db.prepare(`
  SELECT id, clase, operacion_label, formula_json FROM layout_operaciones
  WHERE empresa_id='EMPRESA01' AND modulo='RESUMEN' AND capitulo='GUADALAJARA'
  AND clase IN ('CONSOLIDATED EXPENSE', 'CONSOLIDATED EXPENSES')
`).all();
console.log('\nGDL CONSOLIDATED EXPENSE(S) after fix:');
verify.forEach(op => {
    const terms = JSON.parse(op.formula_json);
    console.log(`  ID:${op.id} clase:${op.clase}: ${terms.map(t => `${t.operator}"${t.value}"`).join(', ')}`);
});

db.close();
console.log('\nDone!');
process.exit(0);
