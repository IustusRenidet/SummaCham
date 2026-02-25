#!/usr/bin/env python3
import argparse
import json
import os
import re
import sys
import unicodedata

try:
    from openpyxl import load_workbook
    from openpyxl.chart import BarChart, LineChart, Reference
    from openpyxl.utils import get_column_letter
except Exception as exc:  # pragma: no cover - runtime dependency guard
    print(str(exc), file=sys.stderr)
    raise


def text(v):
    if v is None:
        return ""
    return str(v).strip()


def normalized_text(v):
    raw = text(v)
    if not raw:
        return ""
    decomposed = unicodedata.normalize("NFD", raw)
    stripped = "".join(ch for ch in decomposed if unicodedata.category(ch) != "Mn")
    return stripped.upper()


def sanitize_hex(color, fallback="4472C4"):
    source = text(color).lstrip("#")
    if re.fullmatch(r"[0-9A-Fa-f]{6}", source):
        return source.upper()
    if re.fullmatch(r"[0-9A-Fa-f]{3}", source):
        return "".join(ch * 2 for ch in source).upper()
    return fallback


def clear_sheet(ws):
    if ws.max_row > 0:
        ws.delete_rows(1, ws.max_row)
    if ws.max_column > 0:
        ws.delete_cols(1, ws.max_column)
    ws._charts = []


def clear_charts_only(ws):
    ws._charts = []


def best_table_sheet(wb, preferred_name):
    if preferred_name and preferred_name in wb.sheetnames:
        return wb[preferred_name]
    if wb.sheetnames:
        return wb[wb.sheetnames[0]]
    return None


def autofit_columns(ws, min_width=10, max_width=60):
    if ws is None:
        return
    for col_idx in range(1, ws.max_column + 1):
        max_len = 0
        for row_idx in range(1, ws.max_row + 1):
            v = ws.cell(row=row_idx, column=col_idx).value
            if v is None:
                continue
            candidate = len(str(v))
            if candidate > max_len:
                max_len = candidate
        width = max(min_width, min(max_width, max_len + 2))
        ws.column_dimensions[get_column_letter(col_idx)].width = width


def parse_series_meta(series_meta):
    if not series_meta:
        return []
    try:
        parsed = json.loads(series_meta)
        if isinstance(parsed, list):
            return parsed
        if isinstance(parsed, dict):
            return [parsed]
    except Exception:
        return []
    return []


def find_meta_entry(meta_list, name, idx):
    target = normalized_text(name)
    for entry in meta_list:
        if not isinstance(entry, dict):
            continue
        label = entry.get("label") or entry.get("name") or ""
        if normalized_text(label) == target and target:
            return entry
    if 0 <= idx < len(meta_list):
        entry = meta_list[idx]
        if isinstance(entry, dict):
            return entry
    return None


def resolve_series_type(meta_list, name, idx):
    entry = find_meta_entry(meta_list, name, idx)
    if entry:
        raw = text(entry.get("type") or entry.get("chartType")).lower()
        if raw == "line":
            return "line"
    return "bar"


def resolve_series_color(meta_list, name, idx):
    entry = find_meta_entry(meta_list, name, idx)
    if entry:
        value = text(entry.get("color"))
        if value:
            return sanitize_hex(value, "4472C4")

    norm = normalized_text(name)
    if "NET" in norm or "NETO" in norm:
        return "94A3B8"
    if "ANTERIOR" in norm or "AA" in norm or "PREV" in norm:
        return "94A3B8"
    if "PPTO" in norm or "PRESUPUESTO" in norm or "BUDGET" in norm:
        return "60A5FA"
    if "REAL" in norm:
        return "0D47A1"
    palette = ["0D47A1", "60A5FA", "94A3B8", "F59E0B", "10B981", "4472C4"]
    return palette[idx % len(palette)]


def style_series(series, hex_color, series_type):
    color = sanitize_hex(hex_color, "4472C4")
    try:
        series.graphicalProperties.solidFill = color
    except Exception:
        pass
    try:
        series.graphicalProperties.line.solidFill = color
    except Exception:
        pass
    if series_type == "line":
        try:
            series.marker.symbol = "none"
        except Exception:
            pass


def parse_resumen_blocks(ws_data):
    blocks = []
    max_row = ws_data.max_row
    max_col = ws_data.max_column
    row = 1
    while row <= max_row:
        marker = normalized_text(ws_data.cell(row=row, column=1).value)
        if marker != "CHART":
            row += 1
            continue
        title = text(ws_data.cell(row=row, column=2).value) or f"Grafica {len(blocks) + 1}"
        header_row = row + 1
        if header_row > max_row:
            break

        col = 2
        while col <= max_col and text(ws_data.cell(row=header_row, column=col).value):
            col += 1
        last_col = col - 1

        data_start = header_row + 1
        data_end = data_start - 1
        while data_start <= max_row and text(ws_data.cell(row=data_start, column=1).value):
            data_end = data_start
            data_start += 1

        if last_col >= 2 and data_end >= header_row + 1:
            blocks.append(
                {
                    "title": title,
                    "header_row": header_row,
                    "data_start": header_row + 1,
                    "data_end": data_end,
                    "series_cols": list(range(2, last_col + 1)),
                }
            )
            row = data_end + 2
        else:
            row += 1
    return blocks


def get_series_columns_for_row(ws_data, row_number):
    max_col = ws_data.max_column
    last_col = 1
    for col in range(max_col, 1, -1):
        if text(ws_data.cell(row=row_number, column=col).value):
            last_col = col
            break
    if last_col < 2:
        return []

    columns = []
    for col in range(2, last_col + 1):
        series_name = text(ws_data.cell(row=row_number, column=col).value)
        if not series_name:
            continue
        columns.append({"col": col, "name": series_name})
    return columns


def detect_operativo_header(ws_data):
    max_row = ws_data.max_row
    max_scan = min(120, max_row)
    max_col = ws_data.max_column

    for row in range(1, max_scan + 1):
        parts = []
        for col in range(1, min(12, max_col) + 1):
            candidate = text(ws_data.cell(row=row, column=col).value).lower()
            if candidate:
                parts.append(candidate)
        row_text = " ".join(parts)
        if (
            ("ppto" in row_text or "presupuesto" in row_text or "real" in row_text)
            and "acum" in row_text
        ):
            return row

    metadata_rows = {
        "RESULTADOS OPERATIVOS",
        "CATEGORIA",
        "EMPRESA",
        "PERIODO",
        "FECHA EXPORTACION",
    }

    for row in range(1, max_scan + 1):
        series = get_series_columns_for_row(ws_data, row)
        if not series:
            continue
        first_norm = normalized_text(ws_data.cell(row=row, column=1).value)
        if first_norm in metadata_rows:
            continue
        row_join = []
        for col in range(1, min(12, max_col) + 1):
            v = text(ws_data.cell(row=row, column=col).value)
            if v:
                row_join.append(v)
        row_normalized = normalized_text(" ".join(row_join))
        looks_like_header = bool(
            re.search(r"PPTO|PRESUPUESTO|REAL|ACUM|BUDGET|ACTUAL|YTD|20[0-9]{2}", row_normalized)
        )
        next_label = text(ws_data.cell(row=row + 1, column=1).value) if row + 1 <= max_row else ""
        if looks_like_header or next_label:
            return row
    return 1


def parse_operativo_chart_blocks(ws_data):
    blocks = []
    max_row = ws_data.max_row
    row = 1
    while row <= max_row:
        marker = normalized_text(ws_data.cell(row=row, column=1).value)
        if marker != "CHART":
            row += 1
            continue

        title = text(ws_data.cell(row=row, column=2).value) or f"Grafica {len(blocks) + 1}"
        header_row = row + 1
        if header_row > max_row:
            break

        series = get_series_columns_for_row(ws_data, header_row)
        if not series:
            row = header_row + 1
            continue

        data_start = header_row + 1
        while data_start <= max_row:
            lbl = text(ws_data.cell(row=data_start, column=1).value)
            if not lbl:
                data_start += 1
                continue
            if normalized_text(lbl) == "CHART":
                break
            break
        if data_start > max_row:
            break

        data_end = data_start
        while data_end <= max_row:
            current = text(ws_data.cell(row=data_end, column=1).value)
            if not current:
                break
            if normalized_text(current) == "CHART":
                break
            data_end += 1
        data_end -= 1

        if data_end >= data_start:
            blocks.append(
                {
                    "title": title,
                    "header_row": header_row,
                    "data_start": data_start,
                    "data_end": data_end,
                    "series": series,
                }
            )
            row = data_end + 1
            continue
        row = header_row + 1
    return blocks


def anchor_start_row(ws_data, ws_charts):
    if ws_data is ws_charts:
        return ws_data.max_row + 2
    return 2


def add_chart_for_block(ws_data, ws_charts, block, meta_list, top_row, is_combined=False):
    categories = Reference(
        ws_data, min_col=1, min_row=block["data_start"], max_row=block["data_end"]
    )

    bar_chart = BarChart()
    bar_chart.type = "col"
    bar_chart.grouping = "clustered"
    bar_chart.overlap = 0
    bar_chart.title = block.get("title") or "Grafica"
    bar_chart.y_axis.number_format = "#,##0.00"
    bar_chart.y_axis.title = ""
    bar_chart.x_axis.title = ""

    line_chart = LineChart()
    line_chart.y_axis.number_format = "#,##0.00"
    line_chart.y_axis.axId = 200
    line_chart.y_axis.crosses = "max"

    bar_count = 0
    line_count = 0

    if block.get("series"):
        iterable = [(s["col"], s["name"]) for s in block["series"]]
    else:
        iterable = []
        for col in block.get("series_cols", []):
            iterable.append((col, text(ws_data.cell(row=block["header_row"], column=col).value)))

    for idx, (col_idx, series_name) in enumerate(iterable):
        series_name = series_name or f"Serie {idx + 1}"
        ref = Reference(
            ws_data,
            min_col=col_idx,
            max_col=col_idx,
            min_row=block["header_row"],
            max_row=block["data_end"],
        )
        series_type = resolve_series_type(meta_list, series_name, idx)
        series_color = resolve_series_color(meta_list, series_name, idx)
        if series_type == "line":
            line_chart.add_data(ref, titles_from_data=True)
            line_chart.set_categories(categories)
            style_series(line_chart.series[-1], series_color, series_type)
            line_count += 1
        else:
            bar_chart.add_data(ref, titles_from_data=True)
            style_series(bar_chart.series[-1], series_color, series_type)
            bar_count += 1

    if bar_count == 0 and line_count > 0:
        base_chart = line_chart
        base_chart.title = block.get("title") or "Grafica"
    else:
        base_chart = bar_chart
        base_chart.set_categories(categories)
        if line_count > 0:
            base_chart += line_chart

    labels_count = max(1, block["data_end"] - block["data_start"] + 1)
    if is_combined:
        base_chart.width = 20
        base_chart.height = 8
        row_step = 24
    else:
        base_chart.width = 20
        base_chart.height = max(6.0, min(13.5, 4.5 + labels_count * 0.18))
        row_step = max(18, min(40, int(12 + labels_count * 0.6)))

    ws_charts.add_chart(base_chart, f"A{top_row}")
    return top_row + row_step


def process_resumen(wb, ws_data, ws_charts, table_sheet_name):
    blocks = parse_resumen_blocks(ws_data)
    if not blocks:
        raise RuntimeError(f"No chart blocks found in {ws_data.title}.")
    top_row = anchor_start_row(ws_data, ws_charts)
    meta_list = []
    for block in blocks:
        top_row = add_chart_for_block(ws_data, ws_charts, block, meta_list, top_row)

    ws_table = best_table_sheet(wb, table_sheet_name)
    autofit_columns(ws_table)
    if ws_table is not None:
        wb.active = wb.sheetnames.index(ws_table.title)
    elif ws_charts is not None:
        wb.active = wb.sheetnames.index(ws_charts.title)


def process_operativo(wb, ws_data, ws_charts, table_sheet_name, chart_mode, series_meta):
    meta_list = parse_series_meta(series_meta)
    mode = text(chart_mode).lower() or "split"
    top_row = anchor_start_row(ws_data, ws_charts)

    if mode == "combined":
        header_row = detect_operativo_header(ws_data)
        series = get_series_columns_for_row(ws_data, header_row)
        if not series:
            raise RuntimeError(f"No series columns found in {ws_data.title}.")
        data_start = header_row + 1
        while data_start <= ws_data.max_row and not text(ws_data.cell(row=data_start, column=1).value):
            data_start += 1
        if data_start > ws_data.max_row:
            raise RuntimeError(f"No data rows found in {ws_data.title}.")
        block = {
            "title": "Resultados operativos",
            "header_row": header_row,
            "data_start": data_start,
            "data_end": ws_data.max_row,
            "series": series,
        }
        top_row = add_chart_for_block(
            ws_data, ws_charts, block, meta_list, top_row, is_combined=True
        )
    else:
        blocks = parse_operativo_chart_blocks(ws_data)
        if blocks:
            for block in blocks:
                top_row = add_chart_for_block(ws_data, ws_charts, block, meta_list, top_row)
        else:
            header_row = detect_operativo_header(ws_data)
            series = get_series_columns_for_row(ws_data, header_row)
            if not series:
                raise RuntimeError(f"No series columns found in {ws_data.title}.")
            data_start = header_row + 1
            while data_start <= ws_data.max_row and not text(ws_data.cell(row=data_start, column=1).value):
                data_start += 1
            if data_start > ws_data.max_row:
                raise RuntimeError(f"No data rows found in {ws_data.title}.")
            for idx, serie in enumerate(series):
                block = {
                    "title": serie["name"] or f"Serie {idx + 1}",
                    "header_row": header_row,
                    "data_start": data_start,
                    "data_end": ws_data.max_row,
                    "series": [serie],
                }
                top_row = add_chart_for_block(ws_data, ws_charts, block, meta_list, top_row)

    ws_table = best_table_sheet(wb, table_sheet_name)
    autofit_columns(ws_table)
    if ws_table is not None:
        wb.active = wb.sheetnames.index(ws_table.title)
    elif ws_charts is not None:
        wb.active = wb.sheetnames.index(ws_charts.title)


def run():
    parser = argparse.ArgumentParser()
    parser.add_argument("--kind", default="operativo")
    parser.add_argument("--input-path", required=True)
    parser.add_argument("--output-path", required=True)
    parser.add_argument("--data-sheet-name", default="GraficasData")
    parser.add_argument("--charts-sheet-name", default="Graficas")
    parser.add_argument("--table-sheet-name", default="")
    parser.add_argument("--chart-mode", default="split")
    parser.add_argument("--series-meta", default="")
    args = parser.parse_args()

    if not os.path.exists(args.input_path):
        raise RuntimeError(f"Input file not found: {args.input_path}")

    wb = load_workbook(args.input_path)

    if args.data_sheet_name not in wb.sheetnames:
        available = ", ".join(wb.sheetnames)
        raise RuntimeError(
            f"Data sheet not found: {args.data_sheet_name}. Available: {available}"
        )
    ws_data = wb[args.data_sheet_name]

    if args.charts_sheet_name:
        if args.charts_sheet_name in wb.sheetnames:
            ws_charts = wb[args.charts_sheet_name]
            if ws_charts is ws_data:
                clear_charts_only(ws_charts)
            else:
                clear_sheet(ws_charts)
        else:
            ws_charts = wb.create_sheet(args.charts_sheet_name)
    else:
        ws_charts = ws_data
        clear_charts_only(ws_charts)

    kind = text(args.kind).lower()
    if kind == "resumen":
        process_resumen(wb, ws_data, ws_charts, args.table_sheet_name)
    else:
        process_operativo(
            wb, ws_data, ws_charts, args.table_sheet_name, args.chart_mode, args.series_meta
        )

    os.makedirs(os.path.dirname(os.path.abspath(args.output_path)), exist_ok=True)
    wb.save(args.output_path)
    print(f"Charts created: {args.output_path}")


if __name__ == "__main__":
    try:
        run()
    except Exception as exc:
        print(str(exc), file=sys.stderr)
        sys.exit(1)

