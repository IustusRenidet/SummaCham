EXPORT OPERATIVO EXCEL

1) Export data + charts (from the app)
- Use the "Excel + Graficas" button in Comites, Eventos, T&IC, or Serv Membresia.
- If Excel is installed, the file is generated with native charts automatically.
- If Excel is not available, the app falls back to data-only export.
- If COM fails, the app falls back to image-based charts inside the same sheet.

2) Template workflow (charts on open)
- Template file: excels/Operativo_Template.xlsx
- Open the template and paste the exported rows into "OperativoData" starting at the first data row (below the headers).
- The charts in "OperativoCharts" update after the paste.

3) COM automation (Excel installed)
- Quick UI: run scripts/export-operativo-charts-ui.ps1 and pick the exported file.
- Command line (same result):

  powershell -ExecutionPolicy Bypass -File scripts/export-operativo-charts.ps1 -InputPath "C:\\path\\to\\Export_Operativo.xlsx"

- Output file: same folder, with "_graficas.xlsx" suffix.
