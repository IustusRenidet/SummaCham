import sqlite3, json

db = sqlite3.connect('./datos/panel.sqlite')
c = db.cursor()

c.execute('''
  SELECT DISTINCT modulo, anio, capitulo, clase, formula_json
  FROM layout_operaciones
  WHERE formula_json IS NOT NULL AND formula_json != '' AND formula_json != "[]"
  AND empresa_id = "empresa1"
  ORDER BY anio DESC, modulo, capitulo, clase
''')

rows = c.fetchall()
print(f'Total unique formula rows: {len(rows)}')

issues = []
samples = []

for modulo, anio, capitulo, clase, formula_json in rows:
    try:
        parsed = json.loads(formula_json)
    except:
        continue
    if not isinstance(parsed, dict) or not isinstance(parsed.get('tokens'), list):
        continue
    refs = [t for t in parsed['tokens'] if t.get('kind') == 'ref']
    ref_types = list(set(t.get('refType', '') for t in refs))
    has_mixed = 'account' in ref_types and ('section' in ref_types or 'subsection' in ref_types)
    labels = [t.get('label', t.get('refId', '')) for t in refs[:8]]
    if has_mixed:
        issues.append({
            'modulo': modulo, 'anio': anio, 'capitulo': capitulo,
            'clase': clase[:50], 'refTypes': ref_types, 'labels': labels
        })
    if len(samples) < 10:
        samples.append({
            'modulo': modulo, 'anio': anio, 'capitulo': capitulo,
            'clase': clase[:50], 'refTypes': ref_types
        })

if not issues:
    print('\nOK: No mixed account+section formulas found in DB.')
    print('=> Corruption happens AFTER loading (in frontend rendering/dedup).')
else:
    print(f'\nBUG: {len(issues)} operations with mixed account+section refs:')
    for i in issues[:10]:
        print(json.dumps(i, ensure_ascii=False))

print('\n=== SAMPLE FORMULAS ===')
for s in samples:
    modulo_s = s['modulo']
    anio_s = s['anio']
    capitulo_s = s['capitulo']
    clase_s = s['clase']
    reftypes_s = s['refTypes']
    print(f'  [{modulo_s}/{anio_s}/{capitulo_s}] {clase_s} => {reftypes_s}')

db.close()
