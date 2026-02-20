/**
 * Diagnose CDMX CONSOLIDATED EXPENSES calculation
 * Checks: 
 *   1. What operations exist in CDMX config
 *   2. What seccion_principal/secundaria structure exists for expenses  
 *   3. What the free-op formula currently resolves to
 */
const Database = require('better-sqlite3');
const path = require('path');
const dbPath = path.join(__dirname, 'datos', 'panel.sqlite');
const db = new Database(dbPath);

console.log('=== CDMX EXPENSE STRUCTURE DIAGNOSIS ===\n');

// 1. All CDMX operations in configAgrupacion (layout_operaciones)
console.log('--- CDMX operations (ALL, sorted by ord) ---');
const opsAll = db.prepare(`
  SELECT id, clase, operacion_tipo, operacion_label, operacion_etiqueta, orden_presentacion
  FROM layout_operaciones
  WHERE empresa_id='EMPRESA01' AND modulo='RESUMEN' AND anio=2026
  AND (capitulo='CIUDAD DE MEXICO' OR capitulo='CIUDAD DE MÉXICO')
  ORDER BY orden_presentacion, id
`).all();
opsAll.forEach(r => console.log(`  ord=${r.orden_presentacion} tipo="${r.operacion_tipo}" label="${r.operacion_label}" clase="${r.clase}"`));

console.log(`\nTotal operations: ${opsAll.length}\n`);

// 2. EXPENSE-related sections in layout_cuentas
console.log('--- CDMX EXPENSE section structure ---');
const expSections = db.prepare(`
  SELECT DISTINCT 
    seccion_principal,
    seccion_secundaria,
    COUNT(*) as cuenta_count,
    SUM(CASE WHEN operacion_factor IS NOT NULL THEN 1 ELSE 0 END) as with_factor
  FROM layout_cuentas
  WHERE empresa_id='EMPRESA01' AND modulo='RESUMEN' AND anio=2026
  AND (capitulo='CIUDAD DE MEXICO' OR capitulo='CIUDAD DE MÉXICO')
  AND (seccion_principal LIKE '%EXPENSE%' OR seccion_secundaria LIKE '%Expense%')
  GROUP BY seccion_principal, seccion_secundaria
  ORDER BY seccion_principal, seccion_secundaria
`).all();
expSections.forEach(r => {
    console.log(`  principal="${r.seccion_principal}" secundaria="${r.seccion_secundaria}" accounts=${r.cuenta_count}`);
});

// 3. Check if "Guadalajara Expense" is under EXPENSE principal or its own principal
console.log('\n--- Is "Guadalajara Expense" a principal section or subsection? ---');
const gExpPrincipal = db.prepare(`
  SELECT COUNT(*) as cnt FROM layout_cuentas
  WHERE empresa_id='EMPRESA01' AND modulo='RESUMEN' AND anio=2026
  AND (capitulo='CIUDAD DE MEXICO' OR capitulo='CIUDAD DE MÉXICO')
  AND seccion_principal = 'Guadalajara Expense'
`).get();
const gExpSubsection = db.prepare(`
  SELECT COUNT(*) as cnt FROM layout_cuentas
  WHERE empresa_id='EMPRESA01' AND modulo='RESUMEN' AND anio=2026
  AND (capitulo='CIUDAD DE MEXICO' OR capitulo='CIUDAD DE MÉXICO')
  AND seccion_secundaria = 'Guadalajara Expense'
`).get();
console.log(`  As principal section (seccion_principal="Guadalajara Expense"): ${gExpPrincipal.cnt} accounts`);
console.log(`  As subsection (seccion_secundaria="Guadalajara Expense"): ${gExpSubsection.cnt} accounts`);

// 4. Check all distinct seccion_principal values for CDMX EXPENSE-related
console.log('\n--- All EXPENSE-related principal sections in CDMX ---');
const principals = db.prepare(`
  SELECT DISTINCT seccion_principal, COUNT(*) as cnt
  FROM layout_cuentas
  WHERE empresa_id='EMPRESA01' AND modulo='RESUMEN' AND anio=2026
  AND (capitulo='CIUDAD DE MEXICO' OR capitulo='CIUDAD DE MÉXICO')
  GROUP BY seccion_principal
  ORDER BY seccion_principal
`).all();
principals.forEach(r => console.log(`  "${r.seccion_principal}" (${r.cnt} accounts)`));

// 5. The CDMX CONSOLIDATED_EXPENSES free-op formula
console.log('\n--- Current CDMX CONSOLIDATED_EXPENSES formula ---');
const freeOp = db.prepare(`
  SELECT id, clase, operacion_tipo, operacion_label, orden_presentacion, formula_json
  FROM layout_operaciones
  WHERE empresa_id='EMPRESA01' AND modulo='RESUMEN' AND anio=2026
  AND (capitulo='CIUDAD DE MEXICO' OR capitulo='CIUDAD DE MÉXICO')
  AND operacion_tipo='free-operation' AND clase='CONSOLIDATED_EXPENSES'
`).get();
if (freeOp) {
    const f = JSON.parse(freeOp.formula_json);
    console.log(`  Formula: ${f.map(t => `${t.operator}${t.type}:"${t.value}"`).join(' ')}`);
} else {
    console.log('  NOT FOUND');
}

db.close();
