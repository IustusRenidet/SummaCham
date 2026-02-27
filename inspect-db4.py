import sqlite3, json

db = sqlite3.connect('./datos/panel.sqlite')
c = db.cursor()

# Show current state: what formula formats are in DB for 2026
c.execute("""
SELECT empresa_id, modulo, anio, capitulo, clase, formula_json
FROM layout_operaciones
WHERE anio = 2026 AND formula_json IS NOT NULL AND formula_json != ''
ORDER BY empresa_id, modulo, capitulo, clase
""")
rows = c.fetchall()

# dedupe by (empresa_id, modulo, capitulo, clase)
seen = set()
unique_rows = []
for row in rows:
    key = (row[0], row[1], row[2], row[3])
    if key not in seen:
        seen.add(key)
        unique_rows.append(row)

print(f"Unique operations with formula in 2026: {len(unique_rows)}")
print()

# Categorize by formula format
v2_count = 0
legacy_count = 0
invalid_count = 0
mixed_count = 0

for empresa_id, modulo, anio, capitulo, clase, fj in unique_rows:
    try:
        parsed = json.loads(fj)
        if isinstance(parsed, dict) and isinstance(parsed.get('tokens'), list):
            # V2 format
            v2_count += 1
            refs = [t for t in parsed['tokens'] if t.get('kind') == 'ref']
            ref_types = list(set(t.get('refType', '') for t in refs))
            has_mixed = 'account' in ref_types and ('section' in ref_types or 'subsection' in ref_types)
            if has_mixed:
                mixed_count += 1
                print(f"MIXED [{empresa_id}] {modulo}/{capitulo} | {clase[:40]} | types={ref_types}")
                print(f"  labels: {[t.get('label','') for t in refs[:6]]}")
        elif isinstance(parsed, list):
            # Legacy array format
            legacy_count += 1
    except:
        invalid_count += 1

print(f"\nFormula format breakdown (2026):")
print(f"  V2 (JSON object): {v2_count}")
print(f"  Legacy (array): {legacy_count}")
print(f"  Invalid/other: {invalid_count}")
print(f"  V2 with mixed account+section: {mixed_count}")

print("\n=== LEGACY FORMAT SAMPLES (first 5) ===")
legacy_shown = 0
for empresa_id, modulo, anio, capitulo, clase, fj in unique_rows:
    if legacy_shown >= 5: break
    try:
        parsed = json.loads(fj)
        if isinstance(parsed, list):
            print(f"[{empresa_id}] {modulo}/{capitulo} | {clase[:40]}")
            terms = parsed[:6]
            for t in terms:
                print(f"  {t.get('operator','+')} {t.get('type','')}:{t.get('value','')}")
            legacy_shown += 1
    except:
        pass

db.close()
