EXPORT OPERATIVO EXCEL

1) Export data (from the app)
- Use the "Excel + Graficas" button in Comites, Eventos, T&IC, or Serv Membresia.
- This creates a workbook that includes a sheet named "OperativoData" with:
  - Column A: label (Evento/Programa/Servicio)
  - Column B: Ppto Acumulado
  - Column C: Real Acumulado

2) Template workflow (charts on open)
- Template file: excels/Operativo_Template.xlsx
- Open the template and paste the exported rows into "OperativoData" starting at the first data row (below the headers).
- The charts in "OperativoCharts" update after the paste.

3) COM automation (Excel installed)
- Run PowerShell to build charts directly in the exported file:

  powershell -ExecutionPolicy Bypass -File scripts/export-operativo-charts.ps1 -InputPath "C:\\path\\to\\Export_Operativo.xlsx"

- Output file: same folder, with "_graficas.xlsx" suffix.
