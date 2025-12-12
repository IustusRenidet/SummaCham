import argparse
import json
import sqlite3
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_DB_PATH = ROOT / "datos" / "panel.sqlite"
EMPRESA_ID = "EMPRESA01"
TARGET_YEAR = 2025

KEY_PRINCIPAL_TARGET = "SECCI\u00e0N Principal"
KEY_SECUNDARIA_TARGET = "SECCION Secundaria"
PRINCIPAL_KEYS = [
    "SECCI\u00e0N Principal",
    "SECCIÓN Principal",
    "SECCION Principal",
    "SECCION",
    "SECCIÓN",
]
SECUNDARIA_KEYS = [
    "SECCION Secundaria",
    "SECCIÓN Secundaria",
    "Seccion Secundaria",
    "SECCION",
    "SECCIÓN",
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


def load_json(relative_path: str):
    path = ROOT / relative_path
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
    filtrados = [
        op
        for op in raw_ops
        if clean_text(op.get("HOJA")).upper() == hoja_expected.upper()
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


def insert_cuentas(conn, modulo, grouped):
    conn.execute(
        "DELETE FROM layout_cuentas WHERE empresa_id = ? AND modulo = ? AND anio = ?",
        (EMPRESA_ID, modulo, TARGET_YEAR),
    )
    insert_sql = """
        INSERT OR REPLACE INTO layout_cuentas (
            empresa_id, modulo, anio, cuenta, nombre, capitulo,
            seccion_principal, seccion_secundaria, orden, actualizado_en
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    """
    total = 0
    for capitulo, cuentas in grouped.items():
        for index, cuenta in enumerate(cuentas):
            conn.execute(
                insert_sql,
                (
                    EMPRESA_ID,
                    modulo,
                    TARGET_YEAR,
                    cuenta["CUENTA"],
                    cuenta["NOMBRE"],
                    capitulo,
                    cuenta[KEY_PRINCIPAL_TARGET],
                    cuenta[KEY_SECUNDARIA_TARGET],
                    index,
                ),
            )
            total += 1
    return total


def insert_operaciones(conn, modulo, operaciones):
    conn.execute(
        "DELETE FROM layout_operaciones WHERE empresa_id = ? AND modulo = ? AND anio = ?",
        (EMPRESA_ID, modulo, TARGET_YEAR),
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
                EMPRESA_ID,
                modulo,
                TARGET_YEAR,
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


def import_module(conn, modulo, cuentas, operaciones):
    total_cuentas = insert_cuentas(conn, modulo, cuentas)
    total_operaciones = insert_operaciones(conn, modulo, operaciones)
    print(
        f"[{modulo}] {total_cuentas} cuentas y {total_operaciones} operaciones cargadas para {TARGET_YEAR}"
    )


def parse_args():
    parser = argparse.ArgumentParser(
        description="Importa los layouts 2025 de SUMMARY y RESUMEN hacia SQLite."
    )
    parser.add_argument(
        "--db",
        dest="db_path",
        default=str(DEFAULT_DB_PATH),
        help="Ruta al archivo panel.sqlite a actualizar (por defecto: datos/panel.sqlite).",
    )
    return parser.parse_args()


def main():
    args = parse_args()
    db_path = Path(args.db_path).expanduser()
    resumen_data = load_json("info IMPORTANTE/CUENTAS SUMMARY y RESUMEN 2025.json")
    summary_data = load_json("info IMPORTANTE/CUENTAS SUMMARY.json")
    operaciones_base = load_json("info IMPORTANTE/CUENTAS SUMMARY y RESUMEN.json")[
        "SUMA DE VARIAS SECCIONES"
    ]

    resumen_accounts = group_accounts(resumen_data.get("RESUMEN", []))
    summary_accounts = group_accounts(summary_data.get("SUMMARY", []))
    resumen_ops = build_operations(operaciones_base, "RESUMEN")
    summary_ops = build_operations(summary_data.get("SUMA DE VARIAS SECCIONES", []), "SUMMARY")

    conn = sqlite3.connect(db_path)
    try:
        import_module(conn, "RESUMEN", resumen_accounts, resumen_ops)
        import_module(conn, "SUMMARY", summary_accounts, summary_ops)
        conn.commit()
    finally:
        conn.close()
    print(f"Base de datos actualizada: {db_path}")


if __name__ == "__main__":
    main()
