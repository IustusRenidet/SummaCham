/**
 * Cleanup script: 
 * 1. Fix the OLD NORESTE rows (IDs 59304-59307, clase="CONSOLIDATED EXPENSE") - update formula to correct operators
 * 2. Delete the NEW duplicate NORESTE rows (IDs 59400-59403, clase="CONSOLIDATED EXPENSES") - redundant entries
 * 3. Fix the OLD NOROESTE rows (IDs 59862-59865, clase="CONSOLIDATED EXPENSE") - update formula to correct operators
 * 4. Delete the NEW duplicate NOROESTE rows (IDs 59958-59961, clase="CONSOLIDATED EXPENSES") - redundant entries
 * 5. Also fix IDs 58642-58643 in NOROESTE (legacy sum-row with no formula) - set correct formula
 *
 * End state: 
 * - NORESTE: single CONSOLIDATED EXPENSE entry with correct formula (- intercompany)
 * - NOROESTE: single CONSOLIDATED EXPENSE and CONSOLIDATED EXPENSES entries with correct formula
 */
const Database = require('better-sqlite3');
const path = require('path');
const dbPath = path.join(__dirname, 'datos', 'panel.sqlite');
const db = new Database(dbPath);

const correctFormula = JSON.stringify([
    { operator: '+', type: 'operation', value: 'CDMX EXPENSE' },
    { operator: '-', type: 'operation', value: 'Guadalajara Expense' },
    { operator: '-', type: 'operation', value: 'Monterrey Expense' },
    { operator: '-', type: 'operation', value: 'Northwest Expense' },
]);

console.log('=== CLEANUP AND FIX DUPLICATE CONSOLIDATED EXPENSE ENTRIES ===\n');

const runInTransaction = db.transaction(() => {
    // =============================================
    // 1. Fix OLD NORESTE rows (IDs 59304-59307)
    //    clase="CONSOLIDATED EXPENSE" (no trailing S) - update formula
    // =============================================
    const noreste59304 = db.prepare(`UPDATE layout_operaciones SET formula_json=? WHERE id IN (59304, 59305, 59306, 59307)`);
    const res1 = noreste59304.run(correctFormula);
    console.log(`1. Updated NORESTE old rows (59304-59307): ${res1.changes} rows`);

    // =============================================
    // 2. Delete NEW duplicate NORESTE rows (IDs 59400-59403)
    //    clase="CONSOLIDATED EXPENSES" - these are duplicates we added
    // =============================================
    const delNoreste = db.prepare(`DELETE FROM layout_operaciones WHERE id IN (59400, 59401, 59402, 59403)`);
    const res2 = delNoreste.run();
    console.log(`2. Deleted duplicate NORESTE new rows (59400-59403): ${res2.changes} rows`);

    // =============================================
    // 3. Fix OLD NOROESTE rows (IDs 59862-59865)
    //    clase="CONSOLIDATED EXPENSE" (no trailing S) - update formula
    // =============================================
    const noroeste59862 = db.prepare(`UPDATE layout_operaciones SET formula_json=? WHERE id IN (59862, 59863, 59864, 59865)`);
    const res3 = noroeste59862.run(correctFormula);
    console.log(`3. Updated NOROESTE old rows (59862-59865): ${res3.changes} rows`);

    // =============================================
    // 4. Delete NEW duplicate NOROESTE rows (IDs 59958-59961)
    //    clase="CONSOLIDATED EXPENSES" - these are duplicates we added
    // =============================================
    const delNoroeste = db.prepare(`DELETE FROM layout_operaciones WHERE id IN (59958, 59959, 59960, 59961)`);
    const res4 = delNoroeste.run();
    console.log(`4. Deleted duplicate NOROESTE new rows (59958-59961): ${res4.changes} rows`);

    // =============================================
    // 5. Fix legacy NOROESTE rows (IDs 58642, 58643) - typ="sum-row"
    //    These are legacy rows with no formula. Add correct formula.
    // =============================================
    const noroesteL = db.prepare(`UPDATE layout_operaciones SET formula_json=? WHERE id IN (58642, 58643)`);
    const res5 = noroesteL.run(correctFormula);
    console.log(`5. Updated legacy NOROESTE rows (58642, 58643): ${res5.changes} rows`);
});

try {
    runInTransaction();
    console.log('\n✓ All changes applied successfully');
} catch (err) {
    console.error('\n✗ Error during transaction:', err.message);
}

// Verify final state
console.log('\n\n=== FINAL VERIFICATION ===\n');

['NORESTE', 'NOROESTE'].forEach(capitulo => {
    console.log(`--- ${capitulo} CONSOLIDATED EXPENSE entries ---`);
    const rows = db.prepare(`
      SELECT id, clase, operacion_etiqueta, operacion_tipo, operacion_label, orden_presentacion, formula_json
      FROM layout_operaciones
      WHERE empresa_id='EMPRESA01' AND modulo='RESUMEN' AND capitulo=?
      AND (clase LIKE '%CONSOLIDATED EXPENSE%' OR operacion_etiqueta LIKE '%CONSOLIDATED EXPENSE%')
      ORDER BY orden_presentacion, id
    `).all(capitulo);
    rows.forEach(r => {
        const f = r.formula_json ? JSON.parse(r.formula_json) : null;
        const ops = f ? f.map(t => `${t.operator}${t.type}:${t.value}`).join(', ') : 'NO FORMULA';
        console.log(`  ID=${r.id} clase="${r.clase}" tipo="${r.operacion_tipo}" label="${r.operacion_label}"`);
        console.log(`    Formula: ${ops}`);
    });
    console.log();
});

db.close();
