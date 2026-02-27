import sqlite3, json

db = sqlite3.connect('./datos/panel.sqlite')
c = db.cursor()

# Find the ONE V2 format formula in 2026
c.execute("""
SELECT empresa_id, modulo, anio, capitulo, clase, formula_json
FROM layout_operaciones
WHERE anio = 2026 AND formula_json IS NOT NULL AND formula_json != ''
ORDER BY empresa_id, modulo, capitulo, clase
""")
rows = c.fetchall()

print("=== V2 FORMAT FORMULAS IN 2026 ===")
for empresa_id, modulo, anio, capitulo, clase, fj in rows:
    try:
        parsed = json.loads(fj)
        if isinstance(parsed, dict) and isinstance(parsed.get('tokens'), list):
            refs = [t for t in parsed['tokens'] if t.get('kind') == 'ref']
            ref_types = list(set(t.get('refType', '') for t in refs))
            print(f"[{empresa_id}] {modulo}/{anio}/{capitulo} | {clase[:50]}")
            print(f"  version: {parsed.get('version')}")
            print(f"  refTypes: {ref_types}")
            print(f"  tokens: {json.dumps(parsed['tokens'][:5], ensure_ascii=False)}")
            print()
    except:
        pass

# Now look at what a "fixed" formula looks like vs legacy
print("\n=== COMPARISON OF FORMULA FORMATS ===")
c.execute("""
SELECT empresa_id, modulo, anio, capitulo, clase, formula_json
FROM layout_operaciones
WHERE anio = 2026 
AND clase LIKE 'Suma de Ingresos%'
ORDER BY empresa_id, modulo, capitulo, clase
LIMIT 8
""")
rows = c.fetchall()
seen = set()
for row in rows:
    empresa_id, modulo, anio, capitulo, clase, fj = row
    key = (empresa_id, modulo, capitulo, clase)
    if key in seen: continue
    seen.add(key)
    print(f"\n[{empresa_id}] {modulo}/{capitulo} | {clase}")
    print(f"  formula_json: {fj[:200]}")

db.close()
