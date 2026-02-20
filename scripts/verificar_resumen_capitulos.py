import argparse
import json
import re
import sqlite3
import sys
import unicodedata
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_DB = ROOT / "datos" / "panel.sqlite"


def normalizar_clave(texto: str) -> str:
    base = (texto or "").strip()
    if not base:
        return ""
    base = unicodedata.normalize("NFD", base)
    base = "".join(ch for ch in base if unicodedata.category(ch) != "Mn")
    base = re.sub(r"\s+", " ", base)
    return base.upper()


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Verifica capítulos/layouts del módulo RESUMEN (y comparativo) en SQLite."
        )
    )
    parser.add_argument(
        "--db",
        default=str(DEFAULT_DB),
        help="Ruta a panel.sqlite (default: datos/panel.sqlite).",
    )
    parser.add_argument(
        "--anio",
        type=int,
        default=datetime.now().year,
        help="Año a revisar (default: año actual).",
    )
    parser.add_argument(
        "--comparativo",
        action="store_true",
        help="También revisa el año anterior (anio - 1).",
    )
    parser.add_argument(
        "--modulo",
        default="RESUMEN",
        help="Módulo a revisar (default: RESUMEN).",
    )
    parser.add_argument(
        "--empresas",
        default="EMPRESA01,EMPRESA02,EMPRESA03,EMPRESA04",
        help="Lista CSV de empresa_id (default: EMPRESA01..04).",
    )
    parser.add_argument(
        "--json",
        action="store_true",
        help="Imprime salida en JSON (útil para automatizar).",
    )
    return parser.parse_args()


@dataclass(frozen=True)
class CapituloStats:
    capitulo: str
    cuentas: int
    operaciones: int
    secciones: int
    formulas_json: int
    formulas_texto: int
    formulas_invalidas: int


def contar(conn: sqlite3.Connection, sql: str, params: tuple) -> int:
    cur = conn.execute(sql, params)
    row = cur.fetchone()
    return int(row[0] or 0) if row else 0


def stats_capitulos(
    conn: sqlite3.Connection, empresa_id: str, modulo: str, anio: int
) -> list[CapituloStats]:
    cur = conn.execute(
        """
        SELECT DISTINCT capitulo
        FROM (
          SELECT capitulo FROM layout_cuentas WHERE empresa_id = ? AND modulo = ? AND anio = ?
          UNION
          SELECT capitulo FROM layout_operaciones WHERE empresa_id = ? AND modulo = ? AND anio = ?
          UNION
          SELECT capitulo FROM layout_secciones WHERE empresa_id = ? AND modulo = ? AND anio = ?
        )
        ORDER BY capitulo ASC
        """,
        (empresa_id, modulo, anio, empresa_id, modulo, anio, empresa_id, modulo, anio),
    )
    capitulos = [r[0] for r in cur.fetchall() if r and r[0]]
    out: list[CapituloStats] = []

    for cap in capitulos:
        cuentas = contar(
            conn,
            "SELECT COUNT(*) FROM layout_cuentas WHERE empresa_id=? AND modulo=? AND anio=? AND capitulo=?",
            (empresa_id, modulo, anio, cap),
        )
        operaciones = contar(
            conn,
            "SELECT COUNT(*) FROM layout_operaciones WHERE empresa_id=? AND modulo=? AND anio=? AND capitulo=?",
            (empresa_id, modulo, anio, cap),
        )
        secciones = contar(
            conn,
            "SELECT COUNT(*) FROM layout_secciones WHERE empresa_id=? AND modulo=? AND anio=? AND capitulo=?",
            (empresa_id, modulo, anio, cap),
        )

        cur_ops = conn.execute(
            """
            SELECT formula_json
            FROM layout_operaciones
            WHERE empresa_id=? AND modulo=? AND anio=? AND capitulo=?
              AND formula_json IS NOT NULL
              AND TRIM(formula_json) <> ''
            """,
            (empresa_id, modulo, anio, cap),
        )
        formulas_json = 0
        formulas_texto = 0
        formulas_invalidas = 0
        for (formula_raw,) in cur_ops.fetchall():
            raw = (formula_raw or "").strip()
            if not raw:
                continue
            try:
                parsed = json.loads(raw)
                if isinstance(parsed, (dict, list)):
                    formulas_json += 1
                else:
                    formulas_invalidas += 1
            except Exception:
                # Puede ser fórmula texto (legacy) o un string no JSON.
                # No lo marcamos como inválido a menos que esté vacío.
                formulas_texto += 1

        out.append(
            CapituloStats(
                capitulo=cap,
                cuentas=cuentas,
                operaciones=operaciones,
                secciones=secciones,
                formulas_json=formulas_json,
                formulas_texto=formulas_texto,
                formulas_invalidas=formulas_invalidas,
            )
        )
    return out


def encontrar_duplicados(capitulos: list[str]) -> dict[str, list[str]]:
    buckets: dict[str, list[str]] = {}
    for cap in capitulos:
        key = normalizar_clave(cap)
        if not key:
            continue
        buckets.setdefault(key, []).append(cap)
    return {k: v for k, v in buckets.items() if len(v) > 1}


def main() -> int:
    args = parse_args()
    db_path = Path(args.db).expanduser().resolve()
    if not db_path.exists():
        print(f"ERROR: No existe la base: {db_path}", file=sys.stderr)
        return 2

    modulo = (args.modulo or "RESUMEN").strip().upper()
    empresas = [
        e.strip()
        for e in (args.empresas or "").split(",")
        if e and e.strip()
    ]
    if not empresas:
        print("ERROR: No hay empresas a revisar.", file=sys.stderr)
        return 2

    anios = [int(args.anio)]
    if args.comparativo:
        anios.append(int(args.anio) - 1)

    con = sqlite3.connect(db_path)
    con.row_factory = sqlite3.Row

    resultado = {
        "db": str(db_path),
        "modulo": modulo,
        "anios": anios,
        "empresas": {},
    }

    try:
        for empresa_id in empresas:
            empresa_info = {"anios": {}}
            for anio in anios:
                caps_stats = stats_capitulos(con, empresa_id, modulo, anio)
                caps = [c.capitulo for c in caps_stats]
                duplicados = encontrar_duplicados(caps)

                empresa_info["anios"][str(anio)] = {
                    "capitulos": [
                        {
                            "capitulo": c.capitulo,
                            "cuentas": c.cuentas,
                            "operaciones": c.operaciones,
                            "secciones": c.secciones,
                            "formulas_json": c.formulas_json,
                            "formulas_texto": c.formulas_texto,
                            "formulas_invalidas": c.formulas_invalidas,
                        }
                        for c in caps_stats
                    ],
                    "duplicados_normalizados": duplicados,
                }
            resultado["empresas"][empresa_id] = empresa_info
    finally:
        con.close()

    if args.json:
        print(json.dumps(resultado, ensure_ascii=False, indent=2))
        return 0

    print(f"DB: {db_path}")
    print(f"Módulo: {modulo}")
    print(f"Años: {', '.join(map(str, anios))}")

    ok = True
    for empresa_id, empresa_info in resultado["empresas"].items():
        print(f"\n== {empresa_id} ==")
        for anio in anios:
            anio_key = str(anio)
            data_anio = empresa_info["anios"].get(anio_key, {})
            caps = data_anio.get("capitulos", [])
            print(f"  {anio}: {len(caps)} capítulos")
            if not caps:
                ok = False
                print("    ERROR: Sin capítulos/layouts para este año.")
                continue
            duplicados = data_anio.get("duplicados_normalizados", {})
            if duplicados:
                ok = False
                print("    WARN: Duplicados por normalización (tildes/espacios):")
                for key, values in duplicados.items():
                    print(f"      - {key}: {values}")

            # resumen rápido por capítulo
            for c in caps:
                cap = c["capitulo"]
                cuentas = c["cuentas"]
                ops = c["operaciones"]
                secs = c["secciones"]
                fj = c["formulas_json"]
                ft = c["formulas_texto"]
                fi = c["formulas_invalidas"]
                if cuentas == 0:
                    ok = False
                print(
                    f"    - {cap}: cuentas={cuentas}, ops={ops}, secciones={secs}, formulas(json/text/invalid)={fj}/{ft}/{fi}"
                )

    if not ok:
        print("\nResultado: WARN: Hay hallazgos (faltantes o duplicados).")
        return 1
    print("\nResultado: OK (capítulos y layouts presentes).")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
