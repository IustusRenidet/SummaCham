import sqlite3, json

db = sqlite3.connect('./datos/panel.sqlite')
c = db.cursor()

# Get all operations referencing accounts (type=account in legacy or refType=account in V2)
c.execute("""
SELECT empresa_id, modulo, anio, capitulo, clase, formula_json
FROM layout_operaciones
WHERE anio = 2026 AND formula_json IS NOT NULL AND formula_json != ''
ORDER BY empresa_id, modulo, capitulo, clase
""")
rows = c.fetchall()

seen = set()
account_ops = []
for row in rows:
    empresa_id, modulo, anio, capitulo, clase, fj = row
    key = (empresa_id, modulo, anio, capitulo, clase)
    if key in seen: continue
    seen.add(key)
    try:
        parsed = json.loads(fj)
        if isinstance(parsed, list):
            types = [t.get('type','') for t in parsed]
            has_account = any(t == 'account' for t in types)
            has_section = any(t == 'section' for t in types)
            has_operation = any(t == 'operation' for t in types)
            if has_account:
                account_ops.append((empresa_id, modulo, capitulo, clase, parsed, has_section, has_operation))
        elif isinstance(parsed, dict) and isinstance(parsed.get('tokens'), list):
            refs = [t for t in parsed['tokens'] if t.get('kind') == 'ref']
            has_account = any(t.get('refType') == 'account' for t in refs)
            has_section = any(t.get('refType') in ('section','subsection') for t in refs)
            has_operation = any(t.get('refType') == 'operation' for t in refs)
            if has_account:
                account_ops.append((empresa_id, modulo, capitulo, clase, refs, has_section, has_operation))
    except:
        pass

print(f"\nOperations with account refs in 2026: {len(account_ops)}")
print("= Whether formula also has section refs (potential DUPLICATION):")

mixed = 0
for emp, mod, cap, cls, terms, has_sec, has_op in account_ops:
    if has_sec:
        mixed += 1
        print(f"\n  *** MIXED: [{emp}] {mod}/{cap} | {cls[:40]}")
        for t in terms[:8]:
            if isinstance(t, dict):
                typ = t.get('type', t.get('refType', ''))
                val = t.get('value', t.get('label',''))
                op = t.get('operator', '+')
                print(f"      {op} {typ}:{val}")
    else:
        pass  # clean, no print needed

print(f"\n  Mixed (account+section) count: {mixed}")
print(f"  Clean account-only: {len(account_ops) - mixed}")

# Also show sample of pure account ops to understand what user fixed
print("\n=== SAMPLE ACCOUNT FORMULAS (first 5 clean) ===")
count = 0
for emp, mod, cap, cls, terms, has_sec, has_op in account_ops:
    if count >= 5: break
    if not has_sec:
        print(f"[{emp}] {mod}/{cap} | {cls[:40]}")
        term_list = terms if isinstance(terms, list) else []
        for t in term_list[:6]:
            if isinstance(t, dict):
                typ = t.get('type', t.get('refType',''))
                val = t.get('value', t.get('label',''))
                op = t.get('operator', '+')
                print(f"  {op} {typ}:{val}")
        count += 1

db.close()
