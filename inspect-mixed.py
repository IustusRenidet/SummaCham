import sqlite3, json

db = sqlite3.connect('./datos/panel.sqlite')
c = db.cursor()

# Get the old legacy formula for Gastos Administrativos NORESTE
c.execute("""
SELECT empresa_id, modulo, anio, capitulo, clase, formula_json
FROM layout_operaciones
WHERE modulo = 'RESUMEN' AND anio = 2026 AND empresa_id = 'EMPRESA03'
AND capitulo = 'NORESTE' AND clase IN ('Gastos Administrativos', 'GASTOS_ADMINISTRATIVOS')
GROUP BY clase
""")
rows = c.fetchall()
for row in rows:
    empresa_id, modulo, anio, capitulo, clase, fj = row
    print(f"\n=== {clase} ===")
    try:
        parsed = json.loads(fj)
        if isinstance(parsed, list):
            print(f"Legacy format, {len(parsed)} terms:")
            for t in parsed:
                print(f"  {t.get('operator','+')} {t.get('type','')}:{t.get('value','')}")
        elif isinstance(parsed, dict):
            tokens = parsed.get('tokens', [])
            refs = [t for t in tokens if t.get('kind') == 'ref']
            print(f"V2 format, {len(refs)} ref tokens:")
            for t in refs:
                print(f"  {t.get('refType','')}:{t.get('label', t.get('refId',''))}")
    except Exception as e:
        print(f"Error: {e}")
        print(f"Raw: {fj[:500]}")

# Also check any operation with BOTH account and section terms in legacy format
print("\n\n=== SEARCHING FOR MIXED account+section IN LEGACY FORMULAS ===")
c.execute("""
SELECT DISTINCT empresa_id, modulo, anio, capitulo, clase, formula_json
FROM layout_operaciones
WHERE formula_json IS NOT NULL AND formula_json != ''
ORDER BY empresa_id, modulo, anio, capitulo, clase
""")
rows = c.fetchall()
seen = set()
for empresa_id, modulo, anio, capitulo, clase, fj in rows:
    key = (empresa_id, modulo, anio, capitulo, clase)
    if key in seen: continue
    seen.add(key)
    try:
        parsed = json.loads(fj)
        if isinstance(parsed, list):
            types = [t.get('type','').lower() for t in parsed]
            has_account = any(t in ('account','cuenta') for t in types)
            has_section = any(t in ('section','seccion','subsection') for t in types)
            if has_account and has_section:
                print(f"\nMIXED: [{empresa_id}] {modulo}/{anio}/{capitulo} | {clase[:40]}")
                for t in parsed[:8]:
                    print(f"  {t.get('operator','+')} {t.get('type','')}:{t.get('value','')}")
    except:
        pass

db.close()
