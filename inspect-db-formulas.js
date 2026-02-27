// Direct DB inspection for formula duplication bug
const Database = require('better-sqlite3');
const db = new Database('./datos/panel.sqlite', { readonly: true });

// Check all modules for mixed account+section formulas
const rows = db.prepare(`
  SELECT DISTINCT empresa_id, modulo, anio, capitulo, clase, operacion_etiqueta, formula_json
  FROM layout_operaciones
  WHERE formula_json IS NOT NULL AND formula_json != '' AND formula_json != '[]'
  AND empresa_id = 'empresa1'
  ORDER BY anio DESC, modulo, capitulo, clase
`).all();

console.log(`Total rows with formula_json: ${rows.length}`);

const seen = new Set();
const issues = [];

rows.forEach(r => {
  const key = `${r.modulo}|${r.anio}|${r.capitulo}|${r.clase}`;
  if (seen.has(key)) return; // dedupe - same formula across tipo rows
  seen.add(key);

  let parsed = null;
  try { parsed = JSON.parse(r.formula_json); } catch (e) { return; }
  if (!parsed || !Array.isArray(parsed.tokens)) return;

  const refs = parsed.tokens.filter(t => t.kind === 'ref');
  const types = refs.map(t => t.refType);
  const uniqueTypes = [...new Set(types)];
  const hasMixed = types.includes('account') && (types.includes('section') || types.includes('subsection'));

  if (hasMixed) {
    issues.push({
      modulo: r.modulo,
      anio: r.anio,
      capitulo: r.capitulo,
      clase: r.clase.substring(0, 50),
      refTypes: uniqueTypes,
      tokens: refs.map(t => ({ refType: t.refType, label: t.label || t.refId }))
    });
  }
});

if (issues.length === 0) {
  console.log('\n✓ No formulas with mixed account+section refs found in DB.');
  console.log('=> The duplication is NOT in stored data, it happens during load/rendering.');
} else {
  console.log(`\n⚠ Found ${issues.length} operations with MIXED account+section refs:\n`);
  issues.forEach(i => console.log(JSON.stringify(i, null, 2)));
}

// Additionally show a sample of formula_json to understand their structure
console.log('\n=== SAMPLE FORMULAS (first 10 unique) ===');
const sampleSeen = new Set();
let count = 0;
rows.forEach(r => {
  const key = `${r.modulo}|${r.anio}|${r.capitulo}|${r.clase}`;
  if (sampleSeen.has(key) || count >= 10) return;
  sampleSeen.add(key);
  count++;
  let parsed = null;
  try { parsed = JSON.parse(r.formula_json); } catch (e) {}
  const refs = parsed && Array.isArray(parsed.tokens) ? parsed.tokens.filter(t => t.kind === 'ref') : [];
  console.log(`[${r.modulo}/${r.anio}/${r.capitulo}] ${r.clase.substring(0,40)}`);
  console.log(`  refTypes: [${[...new Set(refs.map(t => t.refType))].join(', ')}]`);
  console.log(`  labels: [${refs.map(t => t.label || t.refId).join(', ')}]`);
  console.log();
});

db.close();
