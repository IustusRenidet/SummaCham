/**
 * Verify all applied fixes are correct in DB
 */
const Database = require('better-sqlite3');
const path = require('path');
const dbPath = path.join(__dirname, 'datos', 'panel.sqlite');
const db = new Database(dbPath);

console.log('=== VERIFYING ALL CONSOLIDATED EXPENSES FIXES ===\n');

// 1. NORESTE fixes
console.log('--- NORESTE CONSOLIDATED EXPENSES ---');
const noreste = db.prepare(`
  SELECT id, clase, operacion_tipo, operacion_label, orden_presentacion, formula_json
  FROM layout_operaciones
  WHERE empresa_id='EMPRESA01' AND modulo='RESUMEN' AND capitulo='NORESTE'
  AND (clase LIKE '%CONSOLIDATED%' OR operacion_etiqueta LIKE '%CONSOLIDATED%')
  ORDER BY orden_presentacion
`).all();
noreste.forEach(r => {
    const f = r.formula_json ? JSON.parse(r.formula_json) : null;
    console.log(`  ID=${r.id} tipo=${r.operacion_tipo} label=${r.operacion_label} ord=${r.orden_presentacion}`);
    if (f) f.forEach(t => console.log(`    ${t.operator} ${t.type}:"${t.value}"`));
});

// 2. NOROESTE fixes
console.log('\n--- NOROESTE CONSOLIDATED EXPENSES ---');
const noroeste = db.prepare(`
  SELECT id, clase, operacion_tipo, operacion_label, orden_presentacion, formula_json
  FROM layout_operaciones
  WHERE empresa_id='EMPRESA01' AND modulo='RESUMEN' AND capitulo='NOROESTE'
  AND (clase LIKE '%CONSOLIDATED%' OR operacion_etiqueta LIKE '%CONSOLIDATED%')
  ORDER BY orden_presentacion
`).all();
noroeste.forEach(r => {
    const f = r.formula_json ? JSON.parse(r.formula_json) : null;
    console.log(`  ID=${r.id} tipo=${r.operacion_tipo} label=${r.operacion_label} ord=${r.orden_presentacion}`);
    if (f) f.forEach(t => console.log(`    ${t.operator} ${t.type}:"${t.value}"`));
});

// 3. CDMX new entries
console.log('\n--- CDMX CONSOLIDATED entries ---');
const cdmx = db.prepare(`
  SELECT id, clase, operacion_tipo, operacion_label, orden_presentacion, anio, formula_json
  FROM layout_operaciones
  WHERE empresa_id='EMPRESA01' AND modulo='RESUMEN' AND (capitulo='CIUDAD DE MEXICO' OR capitulo='CIUDAD DE MÉXICO')
  AND (clase LIKE '%CONSOLIDATED%' OR operacion_etiqueta LIKE '%CONSOLIDATED%' OR operacion_label LIKE '%CONSOLIDATED%')
  ORDER BY orden_presentacion, id
`).all();
cdmx.forEach(r => {
    const f = r.formula_json ? JSON.parse(r.formula_json) : null;
    console.log(`  ID=${r.id} anio=${r.anio} tipo=${r.operacion_tipo} label=${r.operacion_label} ord=${r.orden_presentacion}`);
    if (f) f.forEach(t => console.log(`    ${t.operator} ${t.type}:"${t.value}"`));
});

// 4. GUADALAJARA fixes
console.log('\n--- GUADALAJARA CONSOLIDATED entries ---');
const gdl = db.prepare(`
  SELECT id, clase, operacion_tipo, operacion_label, orden_presentacion, anio, formula_json
  FROM layout_operaciones
  WHERE empresa_id='EMPRESA01' AND modulo='RESUMEN' AND capitulo='GUADALAJARA'
  AND (clase LIKE '%CONSOLIDATED%' OR operacion_etiqueta LIKE '%CONSOLIDATED%' OR operacion_label LIKE '%CONSOLIDATED%')
  ORDER BY orden_presentacion, id
`).all();
gdl.forEach(r => {
    const f = r.formula_json ? JSON.parse(r.formula_json) : null;
    console.log(`  ID=${r.id} anio=${r.anio} tipo=${r.operacion_tipo} label=${r.operacion_label} ord=${r.orden_presentacion}`);
    if (f) f.forEach(t => console.log(`    ${t.operator} ${t.type}:"${t.value}"`));
});

// 5. Check CDMX ord_pres around 48 to understand placement
console.log('\n--- CDMX layout around ord_pres 40-60 ---');
const cdmxAround = db.prepare(`
  SELECT id, clase, operacion_tipo, operacion_label, orden_presentacion
  FROM layout_operaciones
  WHERE empresa_id='EMPRESA01' AND modulo='RESUMEN' AND (capitulo='CIUDAD DE MEXICO' OR capitulo='CIUDAD DE MÉXICO')
  AND anio=2026 AND orden_presentacion BETWEEN 30 AND 65
  ORDER BY orden_presentacion, id
`).all();
cdmxAround.forEach(r => console.log(`  ord=${r.orden_presentacion} tipo=${r.operacion_tipo} label=${r.operacion_label} clase=${r.clase}`));

// 6. Check distinct años in CDMX-like chapters for RESUMEN
console.log('\n--- Available years for RESUMEN/EMPRESA01/CDMX ---');
const years = db.prepare(`
  SELECT DISTINCT anio, capitulo FROM layout_operaciones
  WHERE empresa_id='EMPRESA01' AND modulo='RESUMEN' 
  AND (capitulo LIKE 'CIUDAD%' OR capitulo='GUADALAJARA' OR capitulo='NORESTE' OR capitulo='NOROESTE')
  ORDER BY capitulo, anio
`).all();
years.forEach(r => console.log(`  ${r.capitulo} - ${r.anio}`));

db.close();
