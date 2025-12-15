import argparse
import json
import sqlite3
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_DB_PATH = ROOT / "datos" / "panel.sqlite"
DEFAULT_CUENTAS = [
    "info IMPORTANTE/RESUMEN CUENTAS 2025.json",
    "info IMPORTANTE/CUENTAS SUMMARY y RESUMEN 2025.json",
    "info IMPORTANTE/CUENTAS SUMMARY y RESUMEN.json",
]
DEFAULT_OPERACIONES = [
    "info IMPORTANTE/CUENTAS SUMMARY y RESUMEN 2025.json",
    "info IMPORTANTE/CUENTAS SUMMARY y RESUMEN.json",
]
EMPRESA_ID = "EMPRESA01"
TARGET_YEAR = 2025

KEY_PRINCIPAL_TARGET = "SECCI\u00e0N Principal"
KEY_SECUNDARIA_TARGET = "SECCION Secundaria"
PRINCIPAL_KEYS = [
    "SECCI\u00f3N Principal",
    "SECCI\u00e0N Principal",
    "SECCI\u00f3N",
    "SECCI\u00e0N",
    "SECCION Principal",
    "SECCION",
]
SECUNDARIA_KEYS = [
    "SECCION Secundaria",
    "SECCI\u00f3N Secundaria",
    "SECCI\u00e0N Secundaria",
    "Seccion Secundaria",
    "SECCION",
    "SECCI\u00f3N",
    "SECCI\u00e0N",
]
OPERATION_KEYS = [
    "sum-row",
    "sum-row-sumavarios",
    "sum-row-sumavarios-consolidado",
    "sum-row-operativo",
    "sum-row-operativo-consolidado",
    "result-row",
    "net-row",
    "net-row-adicional",
    "result-net-row",
]


def resolve_path(value: str | None, fallbacks: list[str]) -> Path:
    if value:
        candidate = Path(value).expanduser().resolve()
        if candidate.exists():
            return candidate
        raise FileNotFoundError(f"No existe el archivo {candidate}")
    for fallback in fallbacks:
        candidate = (ROOT / fallback).resolve()
        if candidate.exists():
            return candidate
    raise FileNotFoundError(
        "No se encontr\u00f3 archivo de entrada. Usa --cuentas o --operaciones para definirlo."
    )


def load_json(path: Path):
    with path.open(encoding="utf-8") as fh:
        return json.load(fh)


def clean_text(value):
    if value is None:
        return ""
    return str(value).strip()


def normalize_principal(row):
    for key in PRINCIPAL_KEYS:
        if key in row and row[key]:
            return clean_text(row[key])
    return ""


def normalize_secundaria(row):
    for key in SECUNDARIA_KEYS:
        if key in row and row[key]:
            return clean_text(row[key])
    return ""


def group_accounts(rows):
    grouped = {}
    for row in rows:
        capitulo = clean_text(row.get("CAPITULO"))
        if not capitulo:
            continue
        cuenta = clean_text(row.get("CUENTA"))
        nombre = clean_text(row.get("NOMBRE"))
        if not cuenta:
            continue
        grouped.setdefault(capitulo, []).append(
            {
                "CUENTA": cuenta,
                "NOMBRE": nombre,
                KEY_PRINCIPAL_TARGET: normalize_principal(row),
                KEY_SECUNDARIA_TARGET: normalize_secundaria(row),
            }
        )
    return grouped


def build_operations(raw_ops, hoja_expected):
    hoja_upper = hoja_expected.upper()
    filtrados = [
        op for op in raw_ops if clean_text(op.get("HOJA")).upper() == hoja_upper
    ]
    operaciones = []
    for idx, op in enumerate(filtrados):
        capitulo = clean_text(op.get("CAPITULO"))
        clase = clean_text(op.get("Clase"))
        seccion = clean_text(op.get("SECCION"))
        if not capitulo or not clase or not seccion:
            continue
        signo = -1 if "expense" in clase.lower() else 1
        for tipo_idx, tipo in enumerate(OPERATION_KEYS):
            etiqueta = clean_text(op.get(tipo))
            if not etiqueta:
                continue
            operaciones.append(
                {
                    "capitulo": capitulo,
                    "clase": clase,
                    "seccion": seccion,
                    "tipo": tipo,
                    "label": etiqueta,
                    "signo": signo,
                    "orden": idx * 100 + tipo_idx,
                }
            )
    return operaciones


def insert_cuentas(conn, modulo, grouped, empresa_id, anio):
    conn.execute(
        "DELETE FROM layout_cuentas WHERE empresa_id = ? AND modulo = ? AND anio = ?",
        (empresa_id, modulo, anio),
    )
    conn.execute(
        "DELETE FROM layout_secciones WHERE empresa_id = ? AND modulo = ? AND anio = ?",
        (empresa_id, modulo, anio),
    )
    insert_cuenta_sql = """
        INSERT OR REPLACE INTO layout_cuentas (
            empresa_id, modulo, anio, cuenta, nombre, capitulo,
            seccion_principal, seccion_secundaria, orden, actualizado_en
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    """
    insert_seccion_sql = """
        INSERT OR REPLACE INTO layout_secciones (
            empresa_id, modulo, anio, capitulo,
            seccion_principal, seccion_secundaria, tipo, orden,
            creado_en, actualizado_en
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    """
    total = 0
    for capitulo, cuentas in grouped.items():
        principales = set()
        secundarias = set()
        for index, cuenta in enumerate(cuentas):
            principal = cuenta[KEY_PRINCIPAL_TARGET]
            secundaria = cuenta[KEY_SECUNDARIA_TARGET] or None
            conn.execute(
                insert_cuenta_sql,
                (
                    empresa_id,
                    modulo,
                    anio,
                    cuenta["CUENTA"],
                    cuenta["NOMBRE"],
                    capitulo,
                    principal,
                    secundaria,
                    index,
                ),
            )
            total += 1
            if principal and (capitulo, principal) not in principales:
                conn.execute(
                    insert_seccion_sql,
                    (
                        empresa_id,
                        modulo,
                        anio,
                        capitulo,
                        principal,
                        None,
                        "principal",
                        index,
                    ),
                )
                principales.add((capitulo, principal))
            if secundaria and (capitulo, principal, secundaria) not in secundarias:
                conn.execute(
                    insert_seccion_sql,
                    (
                        empresa_id,
                        modulo,
                        anio,
                        capitulo,
                        principal,
                        secundaria,
                        "secundaria",
                        index,
                    ),
                )
                secundarias.add((capitulo, principal, secundaria))
    return total


def insert_operaciones(conn, modulo, operaciones, empresa_id, anio):
    conn.execute(
        "DELETE FROM layout_operaciones WHERE empresa_id = ? AND modulo = ? AND anio = ?",
        (empresa_id, modulo, anio),
    )
    insert_sql = """
        INSERT INTO layout_operaciones (
            empresa_id, modulo, anio, capitulo, clase, seccion,
            operacion_tipo, operacion_label, signo, orden, actualizado_en
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    """
    for op in operaciones:
        conn.execute(
            insert_sql,
            (
                empresa_id,
                modulo,
                anio,
                op["capitulo"],
                op["clase"],
                op["seccion"],
                op["tipo"],
                op["label"],
                op["signo"],
                op["orden"],
            ),
        )
    return len(operaciones)


def import_module(conn, modulo, cuentas, operaciones, empresa_id, anio):
    total_cuentas = insert_cuentas(conn, modulo, cuentas, empresa_id, anio)
    total_operaciones = insert_operaciones(conn, modulo, operaciones, empresa_id, anio)
    print(
        f"[{modulo}] {total_cuentas} cuentas y {total_operaciones} operaciones cargadas para {anio}"
    )


def parse_args():
    parser = argparse.ArgumentParser(
        description="Importa los layouts de SUMMARY y RESUMEN hacia SQLite."
    )
    parser.add_argument(
        "--db",
        dest="db_path",
        default=str(DEFAULT_DB_PATH),
        help="Ruta al archivo panel.sqlite (default datos/panel.sqlite).",
    )
    parser.add_argument(
        "--cuentas",
        dest="cuentas_path",
        default=None,
        help="Archivo JSON con las cuentas de SUMMARY/RESUMEN.",
    )
    parser.add_argument(
        "--operaciones",
        dest="ops_path",
        default=None,
        help="Archivo JSON con la secci\u00f3n 'SUMA DE VARIAS SECCIONES'.",
    )
    parser.add_argument(
        "--empresa",
        dest="empresa_id",
        default=EMPRESA_ID,
        help="Empresa objetivo (default EMPRESA01).",
    )
    parser.add_argument(
        "--anio",
        dest="anio",
        default=str(TARGET_YEAR),
        help="A\u00f1o objetivo (default 2025).",
    )
    return parser.parse_args()


def ensure_rows(data, key, fallback_files):
    rows = data.get(key, [])
    if rows:
        return rows
    for candidate in fallback_files:
        path = (ROOT / candidate).resolve()
        if path.exists():
            return load_json(path).get(key, [])
    return []


def main():
    args = parse_args()
    db_path = Path(args.db_path).expanduser()
    anio = int(args.anio)
    empresa_id = args.empresa_id

    cuentas_path = resolve_path(args.cuentas_path, DEFAULT_CUENTAS)
    operaciones_path = resolve_path(args.ops_path, DEFAULT_OPERACIONES)

    cuentas_data = load_json(cuentas_path)
    operaciones_data = load_json(operaciones_path)["SUMA DE VARIAS SECCIONES"]

    summary_rows = ensure_rows(
        cuentas_data, "SUMMARY", ["info IMPORTANTE/CUENTAS SUMMARY.json"]
    )
    resumen_rows = ensure_rows(
        cuentas_data, "RESUMEN", ["info IMPORTANTE/CUENTAS SUMMARY y RESUMEN 2025.json"]
    )
    if not summary_rows:
        raise ValueError("No hay datos de SUMMARY en el archivo proporcionado.")
    if not resumen_rows:
        raise ValueError("No hay datos de RESUMEN en el archivo proporcionado.")

    summary_accounts = group_accounts(summary_rows)
    resumen_accounts = group_accounts(resumen_rows)
    summary_ops = build_operations(operaciones_data, "SUMMARY")
    resumen_ops = build_operations(operaciones_data, "RESUMEN")

    conn = sqlite3.connect(db_path)
    try:
        import_module(conn, "RESUMEN", resumen_accounts, resumen_ops, empresa_id, anio)
        import_module(conn, "SUMMARY", summary_accounts, summary_ops, empresa_id, anio)
        conn.commit()
    finally:
        conn.close()
    print(f"Base de datos actualizada: {db_path}")


if __name__ == "__main__":
    main()
