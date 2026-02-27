"""
cleanup-2026-layouts.py
=======================
Limpia la base de datos de layout_operaciones para TODOS los años:
- Detecta grupos de operaciones duplicadas (misma clave normalizada, distinta clase literal)
- Dentro de cada grupo, conserva el registro con formula V2 (mas nueva)
  Si ninguno tiene V2, conserva el que tenga formula mas completa
- Elimina los registros legacy/redundantes

Uso:
  python cleanup-2026-layouts.py            -> modo simulacion (no modifica)
  python cleanup-2026-layouts.py --execute  -> ejecuta los cambios
  python cleanup-2026-layouts.py --anio=2026 --execute -> solo un año especifico

El script emite un informe de lo que hace antes de comprometer cualquier cambio.
"""

import sqlite3
import json
import re
import sys
import unicodedata
from collections import defaultdict

DB_PATH = "datos/panel.sqlite"
DRY_RUN = "--execute" not in sys.argv
FILTER_ANIO = next((int(a.split("=")[1]) for a in sys.argv if a.startswith("--anio=")), None)

# ── normalización equivalente a NORMALIZAR_ID_SEGMENTO del backend ──────────
def normalizar_id_segmento(s):
    if not s:
        return ""
    s = unicodedata.normalize("NFD", s)
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    s = s.upper()
    s = re.sub(r"[^A-Z0-9]+", "_", s)
    s = s.strip("_")
    return s

def formula_score(formula_json):
    """
    Devuelve la calidad de una fórmula:
      3 = V2 con tokens (versión más nueva)
      2 = json no vacío (legacy con contenido)
      1 = json explícitamente vacío "[]"
      0 = sin fórmula
    """
    if not formula_json:
        return 0
    raw = str(formula_json).strip()
    if not raw or raw == "null":
        return 0
    try:
        parsed = json.loads(raw)
        if isinstance(parsed, dict) and parsed.get("version") == 2:
            tokens = parsed.get("tokens", [])
            if tokens:
                return 3
            return 2
        if isinstance(parsed, list):
            if len(parsed) == 0:
                return 1
            return 2
    except Exception:
        pass
    if raw and raw != "[]":
        return 2
    return 1

def token_count(formula_json):
    """Número de tokens/términos en la fórmula."""
    if not formula_json:
        return 0
    try:
        parsed = json.loads(str(formula_json).strip())
        if isinstance(parsed, dict) and parsed.get("version") == 2:
            return len(parsed.get("tokens", []))
        if isinstance(parsed, list):
            return len(parsed)
    except Exception:
        pass
    return 0

# ── leer registros (todos los años o uno específico) ─────────────────────────
conn = sqlite3.connect(DB_PATH)
conn.row_factory = sqlite3.Row
cur = conn.cursor()

if FILTER_ANIO:
    cur.execute("""
        SELECT empresa_id, modulo, anio, capitulo, clase,
               operacion_tipo, operacion_label, formula_json
        FROM layout_operaciones
        WHERE anio = ?
        ORDER BY empresa_id, modulo, anio, capitulo, clase, operacion_tipo
    """, (FILTER_ANIO,))
else:
    cur.execute("""
        SELECT empresa_id, modulo, anio, capitulo, clase,
               operacion_tipo, operacion_label, formula_json
        FROM layout_operaciones
        ORDER BY empresa_id, modulo, anio, capitulo, clase, operacion_tipo
    """)
rows = cur.fetchall()
anio_label = str(FILTER_ANIO) if FILTER_ANIO else "todos los años"
print(f"Total de registros ({anio_label}) en DB: {len(rows)}")

# ── agrupar por (empresa, modulo, capitulo, clase_normalizada) ────────────────
# Dentro de cada grupo capturamos los distintos valores literales de "clase"
groups = defaultdict(lambda: defaultdict(list))
for row in rows:
    norm = normalizar_id_segmento(row["clase"])
    key = (row["empresa_id"], row["modulo"], row["anio"], row["capitulo"], norm)
    d = {k: row[k] for k in row.keys()}
    groups[key][row["clase"]].append(d)

# ── identificar grupos con duplicados (más de un "clase" literal) ─────────────
dup_groups = {k: v for k, v in groups.items() if len(v) > 1}
print(f"Grupos con clase duplicada (distinto literal, misma clave normalizada): {len(dup_groups)}\n")

to_delete_keys = []   # (empresa_id, modulo, anio, capitulo, clase, operacion_tipo)
summary = []

for (empresa, modulo, anio, capitulo, norm_clase), clase_variants in sorted(dup_groups.items()):
    # Determinar la "mejor" clase literal (la que usaremos como ganadora)
    # Criterio: máximo score de sus variantes de fórmula; en empate, más tokens
    best_clase = None
    best_score = -1
    best_tokens = -1

    variant_scores = {}
    for clase_literal, tipo_rows in clase_variants.items():
        # La fórmula puede estar repartida entre varias filas (una por operacion_tipo)
        # Usamos la fórmula de cualquier fila no nula
        best_formula = None
        for r in tipo_rows:
            fj = r.get("formula_json")
            if fj and str(fj).strip() not in ("", "null", "[]"):
                s = formula_score(fj)
                if best_formula is None or s > formula_score(best_formula):
                    best_formula = fj
        sc = formula_score(best_formula) if best_formula else 0
        tc = token_count(best_formula) if best_formula else 0
        variant_scores[clase_literal] = (sc, tc, best_formula)
        if sc > best_score or (sc == best_score and tc > best_tokens):
            best_score = sc
            best_tokens = tc
            best_clase = clase_literal

    # Si hay empate, preferir la que tiene underscores (más reciente por convención)
    if best_clase is None:
        # fallback: escoger la que tiene underscores
        for cl in clase_variants:
            if "_" in cl:
                best_clase = cl
                break
        if best_clase is None:
            best_clase = list(clase_variants.keys())[0]

    losers = [cl for cl in clase_variants if cl != best_clase]
    n_loser_rows = sum(len(clase_variants[cl]) for cl in losers)
    keys_to_del = [
        (r["empresa_id"], r["modulo"], r["anio"], r["capitulo"], r["clase"], r["operacion_tipo"])
        for cl in losers for r in clase_variants[cl]
    ]
    to_delete_keys.extend(keys_to_del)

    sc_win, tc_win, fj_win = variant_scores[best_clase]
    loser_info = []
    for cl in losers:
        sc, tc, fj = variant_scores[cl]
        loser_info.append(f'  ❌ BORRAR "{cl}" (score={sc}, tokens={tc}, filas={len(clase_variants[cl])})')
    summary.append(
        f'[{empresa}/{modulo}/{anio}/{capitulo}] -> "{best_clase}" (score={sc_win}, tokens={tc_win}) GANA\n'
        + "\n".join(loser_info)
    )

for s in summary:
    print(s)

print(f"\n------------------------------------------------------")
print(f"Total filas a eliminar: {len(to_delete_keys)}")

if DRY_RUN:
    print("\nMODO SIMULACION -- no se modifico nada.")
    print("    Para ejecutar: python cleanup-2026-layouts.py --execute")
else:
    print(f"\nEjecutando limpieza...")
    eliminados = 0
    for (emp, mod, anio, cap, clase, tipo) in to_delete_keys:
        cur.execute("""
            DELETE FROM layout_operaciones
            WHERE empresa_id=? AND modulo=? AND anio=? AND capitulo=? AND clase=? AND operacion_tipo=?
        """, (emp, mod, anio, cap, clase, tipo))
        eliminados += cur.rowcount
    conn.commit()
    print(f"[OK] {eliminados} registros eliminados.")

    # Estado final
    if FILTER_ANIO:
        cur.execute("SELECT COUNT(*) FROM layout_operaciones WHERE anio = ?", (FILTER_ANIO,))
    else:
        cur.execute("SELECT COUNT(*) FROM layout_operaciones")
    total_final = cur.fetchone()[0]
    print(f"Registros ({anio_label}) restantes en DB: {total_final}")

conn.close()

