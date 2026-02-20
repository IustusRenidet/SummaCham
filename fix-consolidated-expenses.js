/**
 * FIX: CONSOLIDATED EXPENSES formula_json - change GDL/MTY/NW operators from "+" to "-"
 * 
 * Problem: CONSOLIDATED EXPENSES = CDMX EXPENSE + Guadalajara Expense + Monterrey Expense + Northwest Expense
 * These operations resolve to POSITIVE values internally, but the intercompany allocations
 * (Guadalajara Expense, Monterrey Expense, Northwest Expense) represent costs FROM CDMX
 * that are allocated TO other chapters, so they must be SUBTRACTED.
 * 
 * Correct formula: CONSOLIDATED EXPENSES = CDMX EXPENSE - Guadalajara Expense - Monterrey Expense - Northwest Expense
 * 
 * Affected chapters: NORESTE, NOROESTE
 * Also needs: CDMX and GUADALAJARA need CONSOLIDATED EXPENSES free-operation added
 */

const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'datos', 'panel.sqlite');
const db = new Database(dbPath); // writable

console.log('Starting CONSOLIDATED EXPENSES fix...\n');

// Helper to build corrected formula_json
const correctFormulaExpenses = (oldFormulaJson) => {
    let terms;
    try {
        terms = JSON.parse(oldFormulaJson);
    } catch (e) {
        console.error('  PARSE ERROR:', e.message);
        return null;
    }

    if (!Array.isArray(terms)) return null;

    const expenseLabelsToSubtract = new Set([
        'Guadalajara Expense', 'GDL Expense', 'Guadalajara Expense Section',
        'Monterrey Expense', 'MTY Expense', 'Monterrey Expense Section',
        'Northwest Expense', 'NW Expense', 'Northwest Expense Section',
        'CDMX EXPENSE',  // do NOT subtract CDMX EXPENSE (it's the base)
    ]);

    // Expense labels that should be SUBTRACTED (not CDMX EXPENSE itself)
    const subtractLabels = new Set([
        'Guadalajara Expense', 'GDL Expense',
        'Monterrey Expense', 'MTY Expense',
        'Northwest Expense', 'NW Expense',
    ]);

    const corrected = terms.map(term => {
        const val = (term.value || '').toString().trim();
        if (subtractLabels.has(val)) {
            return { ...term, operator: '-' };
        }
        return term;
    });

    // Check if anything changed
    const changed = corrected.some((t, i) => t.operator !== terms[i].operator);
    if (!changed) {
        console.log('  No changes needed for this formula');
        return null;
    }

    return JSON.stringify(corrected);
};

// Get all NORESTE and NOROESTE CONSOLIDATED EXPENSES entries
const opsToFix = db.prepare(`
  SELECT id, capitulo, clase, operacion_tipo, formula_json
  FROM layout_operaciones
  WHERE empresa_id='EMPRESA01' AND modulo='RESUMEN'
  AND capitulo IN ('NORESTE', 'NOROESTE')
  AND clase LIKE '%CONSOLIDATED EXPENSES%'
  AND formula_json IS NOT NULL
  ORDER BY capitulo, id
`).all();

console.log(`Found ${opsToFix.length} CONSOLIDATED EXPENSES ops to potentially fix:\n`);

const updateStmt = db.prepare(`
  UPDATE layout_operaciones SET formula_json = ?, actualizado_en = datetime('now')
  WHERE id = ?
`);

let fixedCount = 0;
const fixes = [];

opsToFix.forEach(op => {
    console.log(`ID:${op.id} ${op.capitulo} clase:${op.clase} tipo:${op.operacion_tipo}`);
    const currentTerms = JSON.parse(op.formula_json);
    console.log('  Current:', currentTerms.map(t => `${t.operator} ${t.type}:"${t.value}"`).join(', '));

    const newFormula = correctFormulaExpenses(op.formula_json);
    if (newFormula) {
        const newTerms = JSON.parse(newFormula);
        console.log('  Fixed:  ', newTerms.map(t => `${t.operator} ${t.type}:"${t.value}"`).join(', '));
        fixes.push({ id: op.id, newFormula });
        fixedCount++;
    }
    console.log();
});

if (fixes.length === 0) {
    console.log('No fixes needed!');
    db.close();
    process.exit(0);
}

// Ask for confirmation and apply
console.log(`\n=== APPLYING ${fixes.length} FIXES ===\n`);

const applyAll = db.transaction(() => {
    fixes.forEach(fix => {
        updateStmt.run(fix.newFormula, fix.id);
        console.log(`Updated ID:${fix.id}`);
    });
});

applyAll();
console.log('\nAll fixes applied successfully!');

// Verify the fix
console.log('\n=== VERIFICATION ===');
const verifyOps = db.prepare(`
  SELECT id, capitulo, clase, operacion_tipo, formula_json
  FROM layout_operaciones
  WHERE empresa_id='EMPRESA01' AND modulo='RESUMEN'
  AND capitulo IN ('NORESTE', 'NOROESTE')
  AND clase LIKE '%CONSOLIDATED EXPENSES%'
  AND formula_json IS NOT NULL
  ORDER BY capitulo, id
`).all();

verifyOps.forEach(op => {
    const terms = JSON.parse(op.formula_json);
    console.log(`ID:${op.id} ${op.capitulo}: ${terms.map(t => `${t.operator}"${t.value}"`).join(', ')}`);
});

db.close();
console.log('\nDone!');
process.exit(0);
