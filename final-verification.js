/**
 * Final verification of all CONSOLIDATED EXPENSES fixes
 */
const Database = require('better-sqlite3');
const path = require('path');
const dbPath = path.join(__dirname, 'datos', 'panel.sqlite');
const db = new Database(dbPath);

console.log('=== FINAL STATE: ALL CONSOLIDATED EXPENSE FIXES ===\n');

const chapters = [
    { cap: 'CIUDAD DE MEXICO', label: 'CDMX' },
    { cap: 'CIUDAD DE MÉXICO', label: 'CDMX (accent)' },
    { cap: 'GUADALAJARA', label: 'GUADALAJARA' },
    { cap: 'NORESTE', label: 'NORESTE' },
    { cap: 'NOROESTE', label: 'NOROESTE' },
];

for (const { cap, label } of chapters) {
    const rows = db.prepare(`
    SELECT id, clase, operacion_tipo, operacion_label, operacion_etiqueta, orden_presentacion, formula_json
    FROM layout_operaciones
    WHERE empresa_id='EMPRESA01' AND modulo='RESUMEN' AND anio=2026 AND capitulo=?
    AND (
      clase LIKE '%CONSOLIDATED%EXPENSE%' 
      OR operacion_etiqueta LIKE '%CONSOLIDATED%EXPENSE%'
      OR operacion_label LIKE '%CONSOLIDATED%EXPENSE%'
    )
    ORDER BY orden_presentacion, id
  `).all(cap);

    if (!rows.length) {
        console.log(`[${label}] No CONSOLIDATED EXPENSE entries found\n`);
        continue;
    }

    // Group by clase
    const byClase = {};
    rows.forEach(r => {
        if (!byClase[r.clase]) byClase[r.clase] = [];
        byClase[r.clase].push(r);
    });

    for (const [clase, claseRows] of Object.entries(byClase)) {
        const formulaRow = claseRows.find(r => r.formula_json);
        const f = formulaRow ? JSON.parse(formulaRow.formula_json) : null;
        const hasFormula = Boolean(f);
        const isCorrect = hasFormula && f.every((t, i) => {
            if (i === 0) return t.operator === '+'; // first term always +
            return t.operator === '-'; // subsequent terms should be -
        });

        console.log(`[${label}] clase="${clase}" ord=${claseRows[0].orden_presentacion} rows=${claseRows.length}`);
        if (f) {
            f.forEach(t => console.log(`    ${t.operator} ${t.type}:"${t.value}"`));
        } else {
            console.log(`    NO FORMULA`);
        }
        console.log(`    Status: ${isCorrect ? '✅ CORRECT' : hasFormula ? '❌ WRONG OPERATORS' : '⚠️  NO FORMULA (will return 0 in strict mode)'}`);
        console.log();
    }
}

db.close();
