import sqlite3, json

db = sqlite3.connect('./datos/panel.sqlite')
c = db.cursor()

# Check what empresa_ids exist and formula counts
c.execute("""
SELECT empresa_id, COUNT(*) as cnt, 
       COUNT(CASE WHEN formula_json IS NOT NULL AND formula_json != '' THEN 1 END) as with_formula 
FROM layout_operaciones 
GROUP BY empresa_id
""")
print("empresa_id counts:")
for row in c.fetchall():
    print(f"  empresa_id={row[0]}  total={row[1]}  with_formula={row[2]}")

print()
c.execute("SELECT COUNT(*) FROM layout_operaciones")
print(f"Total layout_operaciones rows: {c.fetchone()[0]}")

print()
# Sample some rows with formulas (any empresa_id)
c.execute("""
SELECT empresa_id, modulo, anio, capitulo, clase, formula_json 
FROM layout_operaciones 
WHERE formula_json IS NOT NULL AND formula_json != '' AND formula_json != '[]' 
LIMIT 10
""")
rows = c.fetchall()
print(f"Sample rows with formula ({len(rows)} shown):")
for row in rows:
    empresa_id, modulo, anio, capitulo, clase, fj = row
    try:
        parsed = json.loads(fj)
        refs = [t for t in (parsed.get('tokens') or []) if t.get('kind') == 'ref']
        ref_types = list(set(t.get('refType','') for t in refs))
    except:
        ref_types = ['parse_error']
    print(f"  [{empresa_id}] {modulo}/{anio}/{capitulo} | {clase[:30]} | refTypes: {ref_types}")

db.close()
