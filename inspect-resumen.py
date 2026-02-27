import sqlite3, json

db = sqlite3.connect('./datos/panel.sqlite')
c = db.cursor()

# Investigate RESUMEN 2026 operations and their formulas
c.execute("""
SELECT empresa_id, modulo, anio, capitulo, clase, operacion_etiqueta, operacion_tipo, formula_json
FROM layout_operaciones
WHERE modulo = 'RESUMEN' AND anio = 2026
ORDER BY empresa_id, capitulo, operacion_tipo, clase
""")
rows = c.fetchall()

print(f"Total RESUMEN 2026 rows: {len(rows)}")
print()

# Group by (empresa_id, capitulo, clase) and show unique operations
seen = set()
for row in rows:
    empresa_id, modulo, anio, capitulo, clase, etiqueta, op_tipo, fj = row
    key = (empresa_id, capitulo, clase)
    if key in seen: continue
    seen.add(key)
    
    fj_summary = 'null'
    if fj:
        try:
            parsed = json.loads(fj)
            if isinstance(parsed, list):
                types = list(set(t.get('type','') for t in parsed))
                fj_summary = f"LEGACY[types={types},len={len(parsed)}]"
            elif isinstance(parsed, dict) and 'tokens' in parsed:
                refs = [t for t in parsed['tokens'] if t.get('kind') == 'ref']
                types = list(set(t.get('refType','') for t in refs))
                fj_summary = f"V2[types={types},len={len(refs)}]"
        except:
            fj_summary = f"INVALID[{fj[:50]}]"
    
    print(f"[{empresa_id}] {capitulo} | {clase[:50]}")
    print(f"  formula: {fj_summary}")

print()
print("\n=== RESUMEN 2026 - WHICH MODELS HAVE SECTION REFS? ===")
all_issues = []

c.execute("""
SELECT DISTINCT empresa_id, modulo, anio, capitulo, clase, formula_json
FROM layout_operaciones
WHERE modulo = 'RESUMEN' AND anio = 2026
AND formula_json IS NOT NULL AND formula_json != ''
ORDER BY empresa_id, capitulo, clase
""")
rows = c.fetchall()
seen = set()
for row in rows:
    empresa_id, modulo, anio, capitulo, clase, fj = row
    key = (empresa_id, capitulo, clase)
    if key in seen: continue
    seen.add(key)
    try:
        parsed = json.loads(fj)
        if isinstance(parsed, list):
            types = list(set(t.get('type','') for t in parsed))
            has_section = 'section' in types or 'subsection' in types
            has_account = 'account' in types
            if has_section or has_account:
                mixed_label = "MIXED" if (has_section and has_account) else ("SECTION" if has_section else "ACCOUNT")
                all_issues.append((empresa_id, capitulo, clase, mixed_label, parsed[:4]))
    except:
        pass

for emp, cap, cls, label, terms in all_issues[:20]:
    print(f"[{label}] [{emp}] {cap} | {cls[:40]}")
    for t in terms[:4]:
        print(f"  {t.get('operator','+')} {t.get('type','')}:{t.get('value','')}")

db.close()
