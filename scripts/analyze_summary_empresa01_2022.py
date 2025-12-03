from pathlib import Path
import pandas as pd

EXCEL_PATH = Path(__file__).resolve().parent.parent / "excels" / "SUMMARY EMPRESA01_2022.xlsx"
REPORT_PATH = Path(__file__).resolve().parent.parent / "excels" / "SUMMARY_EMPRESA01_2022_report.md"

def load_workbook(path: Path) -> pd.ExcelFile:
    return pd.ExcelFile(path)

def summarize_sheet_shapes(xls: pd.ExcelFile) -> str:
    lines = ["| Hoja | Filas | Columnas |", "| --- | ---: | ---: |"]
    for sheet in xls.sheet_names:
        df = pd.read_excel(xls, sheet)
        lines.append(f"| {sheet} | {len(df):,} | {df.shape[1]} |")
    return "\n".join(lines)

def summarize_saldos22(xls: pd.ExcelFile) -> tuple[str, str]:
    saldos = pd.read_excel(xls, "SALDOS22")
    cargo_cols = [c for c in saldos.columns if c.startswith("CARGO")]
    abono_cols = [c for c in saldos.columns if c.startswith("ABONO")]

    saldos = saldos.assign(
        TOTAL_CARGO=saldos[cargo_cols].sum(axis=1),
        TOTAL_ABONO=saldos[abono_cols].sum(axis=1),
    )
    saldos["SALDO_FINAL"] = saldos["INICIAL"] + saldos["TOTAL_CARGO"] - saldos["TOTAL_ABONO"]

    grouped = saldos.groupby("NATURALEZA")[
        ["INICIAL", "TOTAL_CARGO", "TOTAL_ABONO", "SALDO_FINAL"]
    ].sum()
    overall = grouped.sum()

    table_lines = ["| Naturaleza | Inicial | Cargos | Abonos | Saldo final |", "| --- | ---: | ---: | ---: | ---: |"]
    for naturaleza, row in grouped.iterrows():
        table_lines.append(
            f"| {int(naturaleza)} | {row['INICIAL']:,.2f} | {row['TOTAL_CARGO']:,.2f} | {row['TOTAL_ABONO']:,.2f} | {row['SALDO_FINAL']:,.2f} |"
        )
    table_lines.append(
        f"| Total | {overall['INICIAL']:,.2f} | {overall['TOTAL_CARGO']:,.2f} | {overall['TOTAL_ABONO']:,.2f} | {overall['SALDO_FINAL']:,.2f} |"
    )

    top_table = ["| # | Cuenta | Saldo final |", "| ---: | --- | ---: |"]
    for idx, row in saldos.nlargest(5, "SALDO_FINAL").iterrows():
        top_table.append(
            f"| {len(top_table)-1} | {row['NUM_CTA']} ({row['NOMBRE']}) | {row['SALDO_FINAL']:,.2f} |"
        )

    return "\n".join(table_lines), "\n".join(top_table)

def summarize_acum22(xls: pd.ExcelFile) -> tuple[str, str, str]:
    acum = pd.read_excel(xls, "ACUM22")
    month_cols = [
        "ENERO", "FEBRERO", "MARZO", "ABRIL", "MAYO", "JUNIO",
        "JULIO", "AGOSTO", "SEPTIEMBRE", "OCTUBRE", "NOVIEMBRE", "DICIEMBRE",
    ]
    presup_cols = [f"PRESUP{str(i).zfill(2)}" for i in range(1, 13)]

    acum = acum.assign(
        YTD=acum[month_cols].sum(axis=1),
        PRESUP_TOTAL=acum[presup_cols].sum(axis=1),
    )
    acum["VAR_ABS"] = acum["YTD"] - acum["PRESUP_TOTAL"]
    acum["VAR_PCT"] = acum["VAR_ABS"] / acum["PRESUP_TOTAL"].replace({0: pd.NA}) * 100

    grouped = acum.groupby("NATURALEZA")[["YTD", "PRESUP_TOTAL", "VAR_ABS"]].sum()
    grouped["VAR_PCT"] = grouped["VAR_ABS"] / grouped["PRESUP_TOTAL"] * 100

    table_lines = ["| Naturaleza | YTD | Presupuesto | Variación | Variación % |", "| --- | ---: | ---: | ---: | ---: |"]
    for naturaleza, row in grouped.iterrows():
        table_lines.append(
            f"| {int(naturaleza)} | {row['YTD']:,.2f} | {row['PRESUP_TOTAL']:,.2f} | {row['VAR_ABS']:,.2f} | {row['VAR_PCT']:,.2f}% |"
        )

    favorable = acum.nlargest(5, "VAR_ABS")
    unfavorable = acum.nsmallest(5, "VAR_ABS")

    def variance_table(df: pd.DataFrame, title: str) -> str:
        lines = [f"| {title} | YTD | Presupuesto | Variación |", "| --- | ---: | ---: | ---: |"]
        for _, row in df.iterrows():
            lines.append(
                f"| {row['CUENTA']} | {row['YTD']:,.2f} | {row['PRESUP_TOTAL']:,.2f} | {row['VAR_ABS']:,.2f} |"
            )
        return "\n".join(lines)

    return "\n".join(table_lines), variance_table(favorable, "Cuenta"), variance_table(unfavorable, "Cuenta")

def build_report() -> None:
    xls = load_workbook(EXCEL_PATH)
    sheet_summary = summarize_sheet_shapes(xls)
    saldos_table, saldos_top = summarize_saldos22(xls)
    acum_table, acum_fav, acum_unfav = summarize_acum22(xls)

    report = f"""# Resumen técnico de SUMMARY EMPRESA01_2022.xlsx

## Estructura del libro
{sheet_summary}

## SALDOS22
Balances calculados sumando cargos y abonos mensuales para estimar el saldo final por cuenta y naturaleza.
{saldos_table}

Principales saldos finales:
{saldos_top}

## ACUM22
Acumulados mensuales comparados contra el presupuesto anual por naturaleza.
{acum_table}

Variaciones más favorables (mayor superávit sobre presupuesto):
{acum_fav}

Variaciones más desfavorables (mayor déficit sobre presupuesto):
{acum_unfav}
"""
    REPORT_PATH.write_text(report, encoding="utf-8")
    print(f"Reporte generado en {REPORT_PATH}")

if __name__ == "__main__":
    build_report()
