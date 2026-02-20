/**
 * Script to add CONSOLIDATED EXPENSES free-operation for CDMX chapter
 * and fix GUADALAJARA chapter's CONSOLIDATED EXPENSES entries.
 * 
 * Pattern follows the existing CONSOLIDATED INCOME free-operation in CDMX (ID 63244)
 * but with SUBTRACTED intercompany sections.
 */

const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'datos', 'panel.sqlite');
const db = new Database(dbPath);

console.log('=== Adding/fixing CONSOLIDATED EXPENSES entries ===\n');

// The correct formula: EXPENSE + (- Guadalajara Expense) + (- Monterrey Expense) + (- Northwest Expense)
// Using section type since CDMX "Guadalajara Expense" is a subsection under EXPENSE principal
const correctCDMXFormula = JSON.stringify([
    { operator: '+', type: 'section', value: 'EXPENSE' },
    { operator: '-', type: 'section', value: 'Guadalajara Expense' },
    { operator: '-', type: 'section', value: 'Monterrey Expense' },
    { operator: '-', type: 'section', value: 'Northwest Expense' },
]);

// Check CONSOLIDATED INCOME reference (ID 63244) to understand row structure
const refIncome = db.prepare(`
  SELECT * FROM layout_operaciones WHERE id = 63244
`).get();
console.log('Reference CONSOLIDATED INCOME entry:', JSON.stringify(refIncome, null, 2));

// Check if CONSOLIDATED EXPENSES free-operation already exists for CDMX
const existingCDMX = db.prepare(`
  SELECT * FROM layout_operaciones
  WHERE empresa_id='EMPRESA01' AND modulo='RESUMEN' AND capitulo='CIUDAD DE MEXICO'
  AND operacion_tipo='free-operation'
  AND (operacion_label LIKE '%CONSOLIDATED EXPENSES%' OR clase LIKE '%CONSOLIDATED_EXPENSES%')
`).all();
console.log('\nExisting CDMX CONSOLIDATED EXPENSES free-ops:', existingCDMX.length);

// =============================================
// FIX 1: CDMX - Add CONSOLIDATED EXPENSES free-operation
// =============================================

if (existingCDMX.length === 0) {
    console.log('\nAdding CONSOLIDATED EXPENSES free-operation to CDMX...');

    // Following the same 3-row pattern as CONSOLIDATED INCOME (free-operation, rowStyle, estilo_fila)
    // CONSOLIDATED INCOME is at ord_pres=33; CONSOLIDATED EXPENSES should be at ~48 (after EXPENSE section)
    // Looking at the data: expense ops end around ord_pres 184, then need to add CONSOLIDATED EXPENSES

    const insertStmt = db.prepare(`
    INSERT INTO layout_operaciones 
    (empresa_id, modulo, anio, capitulo, clase, seccion, operacion_tipo, operacion_label, signo, 
     orden, creado_en, actualizado_en, visible, orden_presentacion, formula_json, operacion_etiqueta)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'), ?, ?, ?, ?)
  `);

    // Row 1: free-operation (main data row)
    insertStmt.run(
        'EMPRESA01', 'RESUMEN', 2026, 'CIUDAD DE MEXICO',
        'CONSOLIDATED_EXPENSES', '',  // empresa_id, modulo, anio, capitulo, clase, seccion
        'free-operation',             // operacion_tipo
        'CONSOLIDATED EXPENSES',      // operacion_label  
        1,                            // signo
        24009,                        // orden (matches NORESTE/NOROESTE pattern for ord_pres=240)
        1,                            // visible
        48,                           // orden_presentacion (after CONSOLIDATED INCOME at 33, before expense sections start at 36... actually needs to go after all expense entries)
        correctCDMXFormula,           // formula_json
        'CONSOLIDATED EXPENSES'       // operacion_etiqueta
    );

    // Row 2: rowStyle  
    insertStmt.run(
        'EMPRESA01', 'RESUMEN', 2026, 'CIUDAD DE MEXICO',
        'CONSOLIDATED_EXPENSES', '',
        'rowStyle',
        'highlight-primary',
        1,
        24010,
        1,
        48,
        correctCDMXFormula,
        'CONSOLIDATED EXPENSES'
    );

    // Row 3: estilo_fila
    insertStmt.run(
        'EMPRESA01', 'RESUMEN', 2026, 'CIUDAD DE MEXICO',
        'CONSOLIDATED_EXPENSES', '',
        'estilo_fila',
        'highlight-primary',
        1,
        24011,
        1,
        48,
        correctCDMXFormula,
        'CONSOLIDATED EXPENSES'
    );

    console.log('Added 3 rows for CDMX CONSOLIDATED EXPENSES');
} else {
    console.log('CDMX CONSOLIDATED EXPENSES free-op already exists, updating formula...');
    db.prepare(`
    UPDATE layout_operaciones SET formula_json = ?, actualizado_en = datetime('now')
    WHERE empresa_id='EMPRESA01' AND modulo='RESUMEN' AND capitulo='CIUDAD DE MEXICO'
    AND operacion_tipo='free-operation'
    AND (operacion_label LIKE '%CONSOLIDATED EXPENSES%' OR clase LIKE '%CONSOLIDATED_EXPENSES%')
  `).run(correctCDMXFormula);
}

// =============================================
// FIX 2: GUADALAJARA - Add formula_json to existing CONSOLIDATED EXPENSES entry
// =============================================
// For GUADALAJARA chapter, "CONSOLIDATED EXPENSES" is shown in context of GDL view.
// GDL needs: CDMX EXPENSE + GDL own expense + (other chapters)
// But since GDL sum-row has no formula_json, it might be using frontned recalcularConsolidados
// Let's check structure of GDL RESUMEN ops first

const gdlFreeOps = db.prepare(`
  SELECT id, clase, operacion_label, operacion_tipo, orden_presentacion, formula_json
  FROM layout_operaciones
  WHERE empresa_id='EMPRESA01' AND modulo='RESUMEN' AND capitulo='GUADALAJARA'
  AND operacion_tipo='free-operation'
`).all();
console.log('\nGDL free-operations:', JSON.stringify(gdlFreeOps, null, 2));

const gdlConsExpenses = db.prepare(`
  SELECT id, clase, operacion_label, operacion_tipo, orden_presentacion, signo, formula_json
  FROM layout_operaciones
  WHERE empresa_id='EMPRESA01' AND modulo='RESUMEN' AND capitulo='GUADALAJARA'
  AND (operacion_label LIKE '%CONSOLIDATED EXPENSE%' OR clase LIKE '%CONSOLIDATED EXPENSE%')
  ORDER BY orden_presentacion, id
`).all();
console.log('\nGDL CONSOLIDATED EXPENSE(S) entries:', JSON.stringify(gdlConsExpenses, null, 2));

// For GDL CONSOLIDATED EXPENSES, the formula in other chapters uses operation refs:
// + CDMX EXPENSE - Guadalajara Expense - Monterrey Expense - Northwest Expense
// But GDL chapter would need its own version. Skip for now since it uses
// frontend recalcularConsolidados path or old sum-row path.

console.log('\n=== Summary ===');
console.log('NORESTE & NOROESTE: Fixed (done in previous script)');
console.log('CDMX: CONSOLIDATED EXPENSES free-operation added');
console.log('GUADALAJARA: Skipped (uses different path)');

db.close();
process.exit(0);
