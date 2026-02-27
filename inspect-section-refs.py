import sqlite3, json

db = sqlite3.connect('./datos/panel.sqlite')
c = db.cursor()

# Check ALL unique legacy operations that have just 1 term
# These are likely to be original section-ref entries
c.execute("""
SELECT DISTINCT empresa_id, modulo, anio, capitulo, clase, formula_json
FROM layout_operaciones
WHERE formula_json IS NOT NULL AND formula_json != ''
ORDER BY empresa_id, modulo, anio, capitulo, clase
""")
rows = c.fetchall()

seen = set()
short_legacies = []

for empresa_id, modulo, anio, capitulo, clase, fj in rows:
    key = (empresa_id, modulo, anio, capitulo, clase)
    if key in seen: continue
    seen.add(key)
    try:
        parsed = json.loads(fj)
        if isinstance(parsed, list) and 1 <= len(parsed) <= 2:
            # Short legacy formula - interesting
            short_legacies.append((empresa_id, modulo, anio, capitulo, clase, parsed))
    except:
        pass

print(f"Found {len(short_legacies)} short (1-2 term) legacy formulas:")
print()

# Show them all to see what types and values they have
section_refs = 0
for emp, mod, anio, cap, cls, terms in short_legacies[:50]:
    types = [t.get('type','') for t in terms]
    values = [t.get('value','') for t in terms]
    has_section = 'section' in types
    if has_section:
        section_refs += 1
    marker = "*** SECTION" if has_section else ""
    print(f"[{emp}] {mod}/{anio}/{cap} | {cls[:40]} {marker}")
    for t in terms:
        print(f"  {t.get('operator','+')} {t.get('type','')}:{t.get('value','')}")

print(f"\nTotal with section type: {section_refs}")
print(f"Total short legacy formulas checked: {min(50, len(short_legacies))}")

# Also check ALL for section types in ANY formula
print("\n\n=== FORMULAS WITH section-type TERMS ===")
section_count = 0
c.execute("""
SELECT DISTINCT empresa_id, modulo, anio, capitulo, clase, formula_json
FROM layout_operaciones
WHERE formula_json IS NOT NULL AND formula_json != ''
ORDER BY empresa_id, modulo, anio, capitulo, clase
""")
rows = c.fetchall()
seen2 = set()
for empresa_id, modulo, anio, capitulo, clase, fj in rows:
    key = (empresa_id, modulo, anio, capitulo, clase)
    if key in seen2: continue
    seen2.add(key)
    try:
        parsed = json.loads(fj)
        if isinstance(parsed, list):
            types = [t.get('type','').lower() for t in parsed]
            has_section = any(t in ('section','seccion','subsection') for t in types)
            if has_section:
                section_count += 1
                print(f"[{empresa_id}] {modulo}/{anio}/{capitulo} | {clase[:40]}")
                for t in parsed[:6]:
                    print(f"  {t.get('operator','+')} {t.get('type','')}:{t.get('value','')}")
    except:
        pass

print(f"\nTotal operations with SECTION type terms: {section_count}")

db.close()
