const Database = require('better-sqlite3');
const db = new Database('./datos/panel.sqlite');

const ops = db.prepare(`SELECT empresa_id, modulo, anio, capitulo, clase, operacion_etiqueta, operacion_tipo, operacion_label, signo, 
  CASE WHEN formula_json IS NOT NULL THEN substr(formula_json,1,150) ELSE 'NULL' END as formula_preview
FROM layout_operaciones WHERE modulo='RESUMEN' ORDER BY capitulo, orden_presentacion LIMIT 100`).all();

// Group and show distinct etiqueta per capitulo
const byCapitulo = {};
ops.forEach(r => {
    const cap = r.capitulo;
    if (!byCapitulo[cap]) byCapitulo[cap] = [];
    const key = r.operacion_etiqueta;
    if (!byCapitulo[cap].find(x => x.key === key)) {
        byCapitulo[cap].push({ key, tipo: r.operacion_tipo, label: r.operacion_label, formula: r.formula_preview });
    }
});

Object.keys(byCapitulo).forEach(cap => {
    console.log(`\n=== Capítulo: ${cap} ===`);
    byCapitulo[cap].forEach(r => {
        console.log(`  ${r.key} | tipo:${r.tipo} | label:${r.label} | formula:${r.formula}`);
    });
});

process.exit(0);
