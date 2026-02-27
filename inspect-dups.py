import sqlite3, json

db = sqlite3.connect('./datos/panel.sqlite')
c = db.cursor()

# Find operations that appear to be duplicates after normalizing class names
c.execute("""
SELECT DISTINCT empresa_id, modulo, anio, capitulo, clase, formula_json
FROM layout_operaciones
WHERE modulo = 'RESUMEN' AND anio = 2026 AND empresa_id = 'EMPRESA03' AND capitulo = 'NORESTE'
ORDER BY clase
""")
rows = c.fetchall()

import re
def normalize_key(s):
    """Simulate frontend normalizeOperationMatch"""
    s = s.upper()
    # Remove diacritics
    import unicodedata
    s = unicodedata.normalize('NFD', s)
    s = re.sub(r'[\u0300-\u036f]', '', s)
    # Remove all non-alphanumeric
    s = re.sub(r'[^A-Z0-9]+', '', s)
    return s.lower()

def backend_normalize(s):
    """Simulate backend NORMALIZAR_CLAVE (keeps spaces/underscores)"""
    s = s.upper()
    import unicodedata
    s = unicodedata.normalize('NFD', s)
    s = re.sub(r'[\u0300-\u036f]', '', s)
    return s

# Group by frontend-normalized key
from collections import defaultdict
key_groups = defaultdict(list)
for row in rows:
    _, _, _, _, clase, fj = row
    fkey = normalize_key(clase)
    bkey = backend_normalize(clase)
    key_groups[fkey].append((clase, bkey, fj))

print("=== POTENTIAL DUPLICATES (same frontend key, different backend key) ===")
duplicated = 0
for fkey, entries in sorted(key_groups.items()):
    if len(entries) > 1:
        duplicated += 1
        backend_keys = set(e[1] for e in entries)
        print(f"\nFrontend key: '{fkey}' has {len(entries)} entries (backend keys differ: {len(backend_keys) > 1})")
        for clase, bkey, fj in entries:
            fj_summary = 'null'
            if fj:
                try:
                    parsed = json.loads(fj)
                    if isinstance(parsed, list):
                        types = list(set(t.get('type','') for t in parsed))
                        fj_summary = f"L[{types},{len(parsed)}]"
                    elif isinstance(parsed, dict):
                        refs = [t for t in parsed.get('tokens',[]) if t.get('kind')=='ref']
                        types = list(set(t.get('refType','') for t in refs))
                        fj_summary = f"V2[{types},{len(refs)}]"
                except:
                    fj_summary = f'ERR[{str(fj)[:30]}]'
            print(f"  '{clase}' -> backend_key='{bkey}' -> formula={fj_summary}")

print(f"\nTotal duplicate groups: {duplicated}")

db.close()
