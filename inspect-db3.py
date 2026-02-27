import sqlite3, json

db = sqlite3.connect('./datos/panel.sqlite')
c = db.cursor()

# Look at actual formula_json values
c.execute("""
SELECT empresa_id, modulo, anio, capitulo, clase, formula_json 
FROM layout_operaciones 
WHERE formula_json IS NOT NULL AND formula_json != '' AND formula_json != '[]' 
AND empresa_id = 'EMPRESA01'
LIMIT 5
""")
rows = c.fetchall()
print("Raw formula_json samples for EMPRESA01:")
for row in rows:
    empresa_id, modulo, anio, capitulo, clase, fj = row
    print(f"\n[{modulo}/{anio}/{capitulo}] {clase[:40]}")
    print(f"  formula_json: {repr(fj[:300])}")

print("\n\n=== CHECKING FOR MIXED FORMULAS (EMPRESA01) ===")

c.execute("""
SELECT DISTINCT modulo, anio, capitulo, clase, formula_json 
FROM layout_operaciones 
WHERE formula_json IS NOT NULL AND formula_json != '' AND formula_json != '[]'
AND empresa_id = 'EMPRESA01'
ORDER BY anio DESC, modulo, capitulo, clase
""")
rows = c.fetchall()
print(f"Total unique operations with formula: {len(rows)}")

issues = []
for modulo, anio, capitulo, clase, fj in rows:
    # Try parsing as JSON
    try:
        parsed = json.loads(fj)
        if isinstance(parsed, dict) and isinstance(parsed.get('tokens'), list):
            refs = [t for t in parsed['tokens'] if t.get('kind') == 'ref']
            ref_types = list(set(t.get('refType', '') for t in refs))
            has_mixed = 'account' in ref_types and ('section' in ref_types or 'subsection' in ref_types)
            if has_mixed:
                issues.append({
                    'modulo': modulo, 'anio': anio, 'capitulo': capitulo,
                    'clase': clase[:50], 'refTypes': ref_types,
                    'labels': [t.get('label', '') for t in refs[:8]]
                })
    except:
        pass

if not issues:
    print("OK: No mixed formulas found in EMPRESA01 DB.")
else:
    print(f"\nBUG: {len(issues)} mixed formulas:")
    for i in issues[:10]:
        print(json.dumps(i, ensure_ascii=False))

db.close()
