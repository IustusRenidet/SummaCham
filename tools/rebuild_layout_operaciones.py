import json
import re
import shutil
import sqlite3
import unicodedata
from collections import defaultdict
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[1]
DB_PATH = REPO_ROOT / "panel.sqlite"
CUENTAS_DATA_JS = REPO_ROOT / "vistas" / "js" / "cuentas-data.js"

# These appear when operations are mistakenly saved as {operacion_tipo: 'sum-row', ...}
# and the backend interprets each property as an "operation type". They break rendering.
BAD_OPERATION_TYPES = {"operacion_tipo", "operacion_label", "orden_presentacion", "visible"}

ACCOUNT_RE = re.compile(r"^\d+(?:-\d+){3}$")


def norm_text(value: str) -> str:
    value = (value or "").strip()
    if not value:
        return ""
    # Remove accents and normalize whitespace/casing for robust matching.
    value = (
        unicodedata.normalize("NFD", value)
        .encode("ascii", "ignore")
        .decode("ascii")
        .upper()
    )
    value = re.sub(r"\s+", " ", value).strip()
    return value


def load_cuentas_sumas() -> dict:
    """
    Parse window.CUENTAS_SUMAS from vistas/js/cuentas-data.js (JS assignment).
    """
    text = CUENTAS_DATA_JS.read_text(encoding="utf-8", errors="ignore")
    m = re.search(r"window\.CUENTAS_SUMAS\s*=\s*(\{.*?\});", text, re.DOTALL)
    if not m:
        raise RuntimeError("No se encontro window.CUENTAS_SUMAS en cuentas-data.js")
    raw = m.group(1)
    # Strip trailing semicolon for JSON parse safety.
    if raw.endswith(";"):
        raw = raw[:-1]
    return json.loads(raw)


def infer_section_sign(seccion: str, modulo: str) -> int:
    s = norm_text(seccion)
    if not s:
        return 1
    if modulo and norm_text(modulo) == "COMITES":
        if "COMISIONES" in s:
            return -1
    if re.search(r"\b(GASTOS?|COSTOS?)\b", s):
        return -1
    if "COMISIONES" in s:
        return -1
    if "INGRESOS" in s:
        return 1
    return 1


def build_formula_terms_for_accounts(accounts: list[str]) -> list[dict]:
    terms = []
    base_id = 1
    for acc in accounts:
        acc = (acc or "").strip()
        if not acc:
            continue
        terms.append({"id": base_id, "operator": "+", "type": "account", "value": acc, "constant": None})
        base_id += 1
    return terms


def build_formula_terms_for_sections(sections: list[tuple[str, int]]) -> list[dict]:
    terms = []
    base_id = 1
    for sec, sign in sections:
        sec = (sec or "").strip()
        if not sec:
            continue
        op = "+" if sign >= 0 else "-"
        terms.append({"id": base_id, "operator": op, "type": "section", "value": sec, "constant": None})
        base_id += 1
    return terms


def main() -> None:
    if not DB_PATH.exists():
        raise SystemExit(f"No existe DB: {DB_PATH}")
    if not CUENTAS_DATA_JS.exists():
        raise SystemExit(f"No existe {CUENTAS_DATA_JS}")

    # Backup DB once per run.
    backup_path = DB_PATH.with_suffix(".sqlite.bak")
    if not backup_path.exists():
        shutil.copy2(DB_PATH, backup_path)

    cuentas_sumas = load_cuentas_sumas()

    # Build normalized lookup: modulo -> capitulo -> seccion -> config
    sumas_lookup: dict[str, dict[str, dict[str, dict]]] = {}
    for modulo, caps in (cuentas_sumas or {}).items():
        mod_key = norm_text(modulo)
        sumas_lookup.setdefault(mod_key, {})
        for capitulo, secciones in (caps or {}).items():
            cap_key = norm_text(capitulo)
            sumas_lookup[mod_key].setdefault(cap_key, {})
            for seccion, cfg in (secciones or {}).items():
                sec_key = norm_text(seccion)
                sumas_lookup[mod_key][cap_key][sec_key] = cfg or {}

    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()

    # 1) Remove known-bad operation types globally (they prevent correct grouping/rendering).
    cur.execute(
        f"DELETE FROM layout_operaciones WHERE operacion_tipo IN ({','.join(['?']*len(BAD_OPERATION_TYPES))})",
        tuple(BAD_OPERATION_TYPES),
    )
    removed_bad = cur.rowcount

    # 2) Build section inventory from layout_cuentas.
    cur.execute(
        """
        SELECT empresa_id, modulo, anio, capitulo, seccion_principal,
               MIN(orden) AS orden_min
        FROM layout_cuentas
        GROUP BY empresa_id, modulo, anio, capitulo, seccion_principal
        ORDER BY empresa_id, modulo, anio, capitulo, orden_min
        """
    )
    sections = cur.fetchall()

    # Precompute membership maps for sumavarios/sumavarios2/resultRow by (empresa/modulo/anio/capitulo).
    membership = defaultdict(lambda: {"sumavarios": defaultdict(list), "sumavarios2": defaultdict(list), "result": defaultdict(list)})

    for row in sections:
        empresa_id = row["empresa_id"]
        modulo = row["modulo"]
        anio = int(row["anio"])
        capitulo = row["capitulo"]
        seccion = row["seccion_principal"]

        mod_key = norm_text(modulo)
        cap_key = norm_text(capitulo)
        sec_key = norm_text(seccion)

        cfg = sumas_lookup.get(mod_key, {}).get(cap_key, {}).get(sec_key, {}) or {}
        sign = infer_section_sign(seccion, modulo)

        sumav = (cfg.get("sumRowSumavarios") or "").strip()
        sumav2 = (cfg.get("sumRowSumavarios2") or "").strip()
        res = (cfg.get("resultRow") or "").strip()

        key = (empresa_id, modulo, anio, capitulo)
        if sumav:
            membership[key]["sumavarios"][sumav].append((seccion, sign))
        if sumav2:
            membership[key]["sumavarios2"][sumav2].append((seccion, sign))
        if res:
            membership[key]["result"][res].append((seccion, sign))

    # 3) Upsert core operation rows per section for all existing layouts (minucioso across modules/years).
    insert_sql = """
      INSERT OR REPLACE INTO layout_operaciones (
        empresa_id, modulo, anio, capitulo, clase, operacion_etiqueta, seccion,
        operacion_tipo, operacion_label, signo, orden, orden_presentacion, visible, formula_json, actualizado_en
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    """

    updated = 0
    inserted = 0

    for row in sections:
        empresa_id = row["empresa_id"]
        modulo = row["modulo"]
        anio = int(row["anio"])
        capitulo = row["capitulo"]
        seccion = row["seccion_principal"]
        orden_min = int(row["orden_min"] or 0)

        mod_key = norm_text(modulo)
        cap_key = norm_text(capitulo)
        sec_key = norm_text(seccion)
        cfg = sumas_lookup.get(mod_key, {}).get(cap_key, {}).get(sec_key, {}) or {}

        sum_row_label = (cfg.get("sumRow") or "").strip() or (f"Suma de {seccion}".strip() if seccion else "")
        sumav_label = (cfg.get("sumRowSumavarios") or "").strip()
        sumav2_label = (cfg.get("sumRowSumavarios2") or "").strip()
        result_label = (cfg.get("resultRow") or "").strip()

        # Use sum-row label as the operation identity (so operation references by label work).
        clase = sum_row_label or (seccion or "Operacion")
        operacion_etiqueta = clase
        signo = infer_section_sign(seccion, modulo)
        orden_presentacion = orden_min

        # Accounts for sum-row formula
        cur.execute(
            """
            SELECT cuenta FROM layout_cuentas
            WHERE empresa_id = ? AND modulo = ? AND anio = ? AND capitulo = ? AND seccion_principal = ?
            ORDER BY orden
            """,
            (empresa_id, modulo, anio, capitulo, seccion),
        )
        accounts = [r[0] for r in cur.fetchall() if r[0]]
        sum_row_formula = json.dumps(build_formula_terms_for_accounts(accounts), ensure_ascii=False)

        # For grouped totals, store a section-based formula. It repeats per section, but keeps DB complete.
        key = (empresa_id, modulo, anio, capitulo)
        sumav_formula = None
        if sumav_label:
            sumav_formula = json.dumps(build_formula_terms_for_sections(membership[key]["sumavarios"][sumav_label]), ensure_ascii=False)
        sumav2_formula = None
        if sumav2_label:
            sumav2_formula = json.dumps(build_formula_terms_for_sections(membership[key]["sumavarios2"][sumav2_label]), ensure_ascii=False)
        result_formula = None
        if result_label:
            result_formula = json.dumps(build_formula_terms_for_sections(membership[key]["result"][result_label]), ensure_ascii=False)

        # Upsert rows. If they already exist, this updates them (keeps labels consistent and fixes formula_json).
        rows_to_write = []
        if sum_row_label:
            rows_to_write.append(("sum-row", sum_row_label, sum_row_formula))
        if sumav_label:
            rows_to_write.append(("sum-row-sumavarios", sumav_label, sumav_formula))
        if sumav2_label:
            rows_to_write.append(("sum-row-sumavarios2", sumav2_label, sumav2_formula))
        if result_label:
            rows_to_write.append(("result-row", result_label, result_formula))

        for tipo, label, formula in rows_to_write:
            # Try to detect whether the row existed to report stats.
            cur.execute(
                """
                SELECT id FROM layout_operaciones
                WHERE empresa_id=? AND modulo=? AND anio=? AND capitulo=? AND clase=? AND operacion_tipo=?
                """,
                (empresa_id, modulo, anio, capitulo, clase, tipo),
            )
            existed = cur.fetchone() is not None
            cur.execute(
                insert_sql,
                (
                    empresa_id,
                    modulo,
                    anio,
                    capitulo,
                    clase,
                    operacion_etiqueta,
                    seccion or "",
                    tipo,
                    label,
                    signo,
                    orden_presentacion * 100 + {"sum-row": 0, "sum-row-sumavarios": 1, "sum-row-sumavarios2": 2, "result-row": 3}.get(tipo, 9),
                    orden_presentacion,
                    1,
                    formula,
                ),
            )
            if existed:
                updated += 1
            else:
                inserted += 1

    conn.commit()
    conn.close()

    print(f"Backup DB: {backup_path}")
    print(f"Deleted bad operation rows: {removed_bad}")
    print(f"Upserted core operations: inserted={inserted}, updated={updated}")


if __name__ == "__main__":
    main()

