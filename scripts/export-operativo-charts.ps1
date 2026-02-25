param(
  [Parameter(Mandatory = $true)]
  [string]$InputPath,
  [string]$OutputPath,
  [string]$DataSheetName = "OperativoData",
  [string]$ChartsSheetName = "OperativoData",
  [string]$TableSheetName = "",
  [string]$ChartMode = "split",
  [string]$SeriesMeta = ""
)

Add-Type -AssemblyName System.Drawing | Out-Null

if (-not ("ExcelMessageFilter" -as [type])) {
  Add-Type -Language CSharp -ErrorAction SilentlyContinue -TypeDefinition @"
using System;
using System.Runtime.InteropServices;

public class ExcelMessageFilter : IOleMessageFilter {
  [DllImport("Ole32.dll")]
  private static extern int CoRegisterMessageFilter(IOleMessageFilter newFilter, out IOleMessageFilter oldFilter);

  public static void Register() {
    IOleMessageFilter oldFilter = null;
    CoRegisterMessageFilter(new ExcelMessageFilter(), out oldFilter);
  }

  public static void Revoke() {
    IOleMessageFilter oldFilter = null;
    CoRegisterMessageFilter(null, out oldFilter);
  }

  int IOleMessageFilter.HandleInComingCall(int dwCallType, IntPtr hTaskCaller, int dwTickCount, IntPtr lpInterfaceInfo) {
    return 0; // SERVERCALL_ISHANDLED
  }

  int IOleMessageFilter.RetryRejectedCall(IntPtr hTaskCallee, int dwTickCount, int dwRejectType) {
    if (dwRejectType == 2) { // SERVERCALL_RETRYLATER
      return 120; // retry in 120ms
    }
    return -1; // cancel
  }

  int IOleMessageFilter.MessagePending(IntPtr hTaskCallee, int dwTickCount, int dwPendingType) {
    return 2; // PENDINGMSG_WAITDEFPROCESS
  }
}

[ComImport, Guid("00000016-0000-0000-C000-000000000046"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface IOleMessageFilter {
  [PreserveSig]
  int HandleInComingCall(int dwCallType, IntPtr hTaskCaller, int dwTickCount, IntPtr lpInterfaceInfo);

  [PreserveSig]
  int RetryRejectedCall(IntPtr hTaskCallee, int dwTickCount, int dwRejectType);

  [PreserveSig]
  int MessagePending(IntPtr hTaskCallee, int dwTickCount, int dwPendingType);
}
"@
}

function Invoke-ComRetry {
  param(
    [Parameter(Mandatory = $true)]
    [scriptblock]$Action,
    [int]$Retries = 30,
    [int]$DelayMs = 150
  )

  for ($attempt = 0; $attempt -lt $Retries; $attempt++) {
    try {
      return & $Action
    }
    catch [System.Runtime.InteropServices.COMException] {
      $hr = $_.Exception.HResult
      # 0x80010001 RPC_E_CALL_REJECTED, 0x800AC472 (Excel busy)
      if ($hr -eq -2147418111 -or $hr -eq -2146777998) {
        Start-Sleep -Milliseconds $DelayMs
        continue
      }
      throw
    }
  }

  return & $Action
}

function Get-WorkbookSheetNames {
  param([Parameter(Mandatory = $true)]$Workbook)
  $names = @()
  $count = Invoke-ComRetry { $Workbook.Worksheets.Count }
  for ($i = 1; $i -le $count; $i++) {
    try {
      $ws = Invoke-ComRetry { $Workbook.Worksheets.Item($i) }
      $names += (Invoke-ComRetry { [string]$ws.Name })
    }
    catch {
    }
  }
  return $names
}

function Open-WorkbookSafely {
  param(
    [Parameter(Mandatory = $true)]$ExcelApp,
    [Parameter(Mandatory = $true)][string]$WorkbookPath
  )

  $missing = [System.Type]::Missing
  try {
    return Invoke-ComRetry {
      $ExcelApp.Workbooks.Open(
        $WorkbookPath,  # Filename
        0,              # UpdateLinks: no actualizar vínculos
        $true,          # ReadOnly
        $missing,       # Format
        $missing,       # Password
        $missing,       # WriteResPassword
        $true,          # IgnoreReadOnlyRecommended
        $missing,       # Origin
        $missing,       # Delimiter
        $false,         # Editable
        $false,         # Notify
        $missing,       # Converter
        $false,         # AddToMru
        $true,          # Local
        1               # CorruptLoad: xlRepairFile
      )
    }
  }
  catch {
    # Fallback conservador por compatibilidad entre versiones de Excel.
    return Invoke-ComRetry { $ExcelApp.Workbooks.Open($WorkbookPath) }
  }
}

$excel = $null
$wb = $null

trap {
  $msg = $_.Exception.Message
  if (-not $msg) { $msg = $_.ToString() }
  Write-Error $msg
  try { if ($wb) { Invoke-ComRetry { $wb.Close($false) } } } catch {}
  try { if ($excel) { Invoke-ComRetry { $excel.Quit() } } } catch {}
  try { [ExcelMessageFilter]::Revoke() } catch {}
  exit 1
}

try { [ExcelMessageFilter]::Register() } catch {}

$xlChartTypeLine = 4
$xlChartTypeBarClustered = 57
$xlLegendPositionBottom = -4107
$xlAxisTypeValue = 1

function Convert-HexToOle {
  param([string]$HexColor)
  if (-not $HexColor) { return $null }
  $hex = $HexColor.Trim().TrimStart("#")
  if ($hex.Length -ne 6) { return $null }
  $r = [Convert]::ToInt32($hex.Substring(0, 2), 16)
  $g = [Convert]::ToInt32($hex.Substring(2, 2), 16)
  $b = [Convert]::ToInt32($hex.Substring(4, 2), 16)
  return [System.Drawing.ColorTranslator]::ToOle([System.Drawing.Color]::FromArgb($r, $g, $b))
}

function Normalize-Text {
  param([string]$Text)
  if (-not $Text) { return "" }
  $normalized = $Text.Normalize([Text.NormalizationForm]::FormD)
  $sb = New-Object System.Text.StringBuilder
  foreach ($char in $normalized.ToCharArray()) {
    $category = [Globalization.CharUnicodeInfo]::GetUnicodeCategory($char)
    if ($category -ne [Globalization.UnicodeCategory]::NonSpacingMark) {
      [void]$sb.Append($char)
    }
  }
  return $sb.ToString().ToUpperInvariant()
}

function Get-ColumnLetter {
  param([int]$ColumnNumber)
  $dividend = $ColumnNumber
  $columnName = ""
  while ($dividend -gt 0) {
    $modulo = ($dividend - 1) % 26
    $columnName = [char](65 + $modulo) + $columnName
    $dividend = [math]::Floor(($dividend - $modulo) / 26)
  }
  return $columnName
}

function Find-SeriesMetaEntry {
  param(
    [array]$MetaList,
    [string]$SeriesName,
    [int]$SeriesIndex
  )
  if (-not $MetaList) { return $null }
  $normalizedSeries = Normalize-Text $SeriesName

  foreach ($entry in $MetaList) {
    if (-not $entry) { continue }
    $entryLabel = ""
    if ($entry.PSObject.Properties.Name -contains "label") {
      $entryLabel = [string]$entry.label
    }
    elseif ($entry.PSObject.Properties.Name -contains "name") {
      $entryLabel = [string]$entry.name
    }
    if (-not $entryLabel) { continue }
    if ((Normalize-Text $entryLabel) -eq $normalizedSeries) {
      return $entry
    }
  }

  if ($SeriesIndex -ge 0 -and $SeriesIndex -lt $MetaList.Count) {
    return $MetaList[$SeriesIndex]
  }
  return $null
}

function Resolve-SeriesColorHex {
  param(
    [array]$MetaList,
    [string]$SeriesName,
    [int]$SeriesIndex
  )
  $entry = Find-SeriesMetaEntry -MetaList $MetaList -SeriesName $SeriesName -SeriesIndex $SeriesIndex
  if ($entry) {
    $rawColor = ""
    if ($entry.PSObject.Properties.Name -contains "color") {
      $rawColor = [string]$entry.color
    }
    if ($rawColor -match "^#?[0-9A-Fa-f]{6}$") {
      if ($rawColor.StartsWith("#")) { return $rawColor }
      return "#$rawColor"
    }
  }

  $name = Normalize-Text $SeriesName
  if ($name -match "PRESUPUESTO" -and $name -notmatch "ACUM") { return "#2F5597" }
  if (($name -match "PPTO" -or $name -match "PRESUPUESTO") -and $name -match "ACUM") { return "#4472C4" }
  if ($name -match "REAL") { return "#7F7F7F" }

  $palette = @("#4472C4", "#A5A5A5", "#2F5597", "#70AD47", "#ED7D31", "#5B9BD5")
  return $palette[$SeriesIndex % $palette.Count]
}

function Resolve-SeriesType {
  param(
    [array]$MetaList,
    [string]$SeriesName,
    [int]$SeriesIndex
  )
  $entry = Find-SeriesMetaEntry -MetaList $MetaList -SeriesName $SeriesName -SeriesIndex $SeriesIndex
  if ($entry) {
    $rawType = ""
    if ($entry.PSObject.Properties.Name -contains "type") {
      $rawType = [string]$entry.type
    }
    elseif ($entry.PSObject.Properties.Name -contains "chartType") {
      $rawType = [string]$entry.chartType
    }
    $normalized = $rawType.ToString().Trim().ToLowerInvariant()
    if ($normalized -eq "line") { return "line" }
  }
  return "bar"
}

function Apply-SeriesStyle {
  param(
    $Series,
    [string]$HexColor,
    [string]$SeriesType
  )
  if (-not $Series) { return }

  if ($SeriesType -eq "line") {
    try { $Series.ChartType = $xlChartTypeLine } catch {}
    try { $Series.MarkerStyle = -4142 } catch {}
    try { $Series.Format.Line.Weight = 2 } catch {}
  }
  else {
    try { $Series.ChartType = $xlChartTypeBarClustered } catch {}
  }

  $oleColor = Convert-HexToOle $HexColor
  if ($oleColor -eq $null) { return }

  try {
    $Series.Format.Fill.Visible = $true
    $Series.Format.Fill.Solid()
    $Series.Format.Fill.ForeColor.RGB = $oleColor
  }
  catch {}
  try {
    $Series.Format.Line.Visible = $true
    $Series.Format.Line.ForeColor.RGB = $oleColor
  }
  catch {}
  try { $Series.Interior.Color = $oleColor } catch {}
}

function Set-ChartBarLayout {
  param($ChartObject)
  if (-not $ChartObject) { return }
  try {
    $group = $ChartObject.Chart.ChartGroups(1)
    if (-not $group) { return }
    $group.Overlap = 0
    $group.GapWidth = 150
  }
  catch {}
}

if (-not (Test-Path $InputPath)) {
  Write-Error "Input file not found: $InputPath"
  exit 1
}

$inputFull = (Resolve-Path $InputPath).Path

$seriesMetaList = @()
if ($SeriesMeta) {
  try {
    $parsedMeta = $SeriesMeta | ConvertFrom-Json -ErrorAction Stop
    if ($parsedMeta -is [System.Array]) {
      $seriesMetaList = @($parsedMeta)
    }
    elseif ($parsedMeta) {
      $seriesMetaList = @($parsedMeta)
    }
  }
  catch {
    Write-Host "SeriesMeta no valido. Se usaran colores por defecto."
  }
}

try {
  $excel = New-Object -ComObject Excel.Application
  $excel.Visible = $false
  $excel.DisplayAlerts = $false
  try { $excel.AskToUpdateLinks = $false } catch {}
  try { $excel.AutomationSecurity = 3 } catch {}
  try { $excel.AlertBeforeOverwriting = $false } catch {}
  try { $excel.EnableEvents = $false } catch {}
  try { $excel.ScreenUpdating = $false } catch {}

  Write-Host "Excel: abriendo workbook..."
  $wb = Open-WorkbookSafely -ExcelApp $excel -WorkbookPath $inputFull
  Write-Host "Excel: workbook abierto."

try {
  $wsData = Invoke-ComRetry { $wb.Worksheets.Item($DataSheetName) }
}
catch {
  $sheets = @()
  try { $sheets = Get-WorkbookSheetNames -Workbook $wb } catch {}
  if ($sheets.Count) {
    Write-Error ("Data sheet not found: {0}. Disponibles: {1}" -f $DataSheetName, ($sheets -join ", "))
  }
  else {
    Write-Error "Data sheet not found: $DataSheetName"
  }
  try { if ($wb) { Invoke-ComRetry { $wb.Close($false) } } } catch {}
  try { if ($excel) { Invoke-ComRetry { $excel.Quit() } } } catch {}
  exit 1
}

function Get-SeriesColumnsForHeaderRow {
  param(
    $Values,
    [int]$RowNumber,
    [int]$MaxCol
  )
  if (-not $Values -or $RowNumber -lt 1) { return @() }
  $lastCol = 1
  for ($c = $MaxCol; $c -ge 2; $c--) {
    if (([string]$Values[$RowNumber, $c]).Trim()) {
      $lastCol = $c
      break
    }
  }
  if ($lastCol -lt 2) { return @() }
  $result = @()
  for ($col = 2; $col -le $lastCol; $col++) {
    $seriesName = ([string]$Values[$RowNumber, $col]).Trim()
    if (-not $seriesName) { continue }
    $result += [PSCustomObject]@{
      Column = $col
      Name   = $seriesName
    }
  }
  return @($result)
}

function Get-ChartBlocks {
  param(
    $Values,
    [int]$SheetLastRow,
    [int]$MaxCol
  )
  if (-not $Values -or $SheetLastRow -lt 1) { return @() }
  $blocks = @()
  $row = 1
  while ($row -le $SheetLastRow) {
    $marker = ([string]$Values[$row, 1]).Trim().ToUpperInvariant()
    if ($marker -ne "CHART") {
      $row++
      continue
    }

    $title = ([string]$Values[$row, 2]).Trim()
    if (-not $title) { $title = "Grafica" }
    $headerRow = $row + 1
    if ($headerRow -gt $SheetLastRow) { break }

    $seriesColumns = Get-SeriesColumnsForHeaderRow -Values $Values -RowNumber $headerRow -MaxCol $MaxCol
    if ($seriesColumns.Count -eq 0) {
      $row = $headerRow + 1
      continue
    }

    $dataStart = $headerRow + 1
    while ($dataStart -le $SheetLastRow) {
      $candidateLabel = ([string]$Values[$dataStart, 1]).Trim()
      if (-not $candidateLabel) {
        $dataStart++
        continue
      }
      if ((Normalize-Text $candidateLabel) -eq "CHART") {
        break
      }
      break
    }
    if ($dataStart -gt $SheetLastRow) { break }

    $dataEnd = $dataStart
    while ($dataEnd -le $SheetLastRow) {
      $currentLabel = ([string]$Values[$dataEnd, 1]).Trim()
      if (-not $currentLabel) { break }
      if ((Normalize-Text $currentLabel) -eq "CHART") { break }
      $dataEnd++
    }
    $dataEnd -= 1

    if ($dataEnd -ge $dataStart) {
      $blocks += [PSCustomObject]@{
        Title         = $title
        HeaderRow     = $headerRow
        DataStart     = $dataStart
        DataEnd       = $dataEnd
        SeriesColumns = $seriesColumns
      }
      $row = $dataEnd + 1
      continue
    }
    $row = $headerRow + 1
  }
  return @($blocks)
}

$values = $null
for ($attempt = 0; $attempt -lt 30; $attempt++) {
  try {
    $usedRange = $wsData.UsedRange
    $values = $usedRange.Value2
    break
  } catch [System.Runtime.InteropServices.COMException] {
    Start-Sleep -Milliseconds 150
  }
}

if ($null -eq $values -or $values -isnot [System.Array] -or $values.Rank -lt 2) {
  Write-Error "No data found in $DataSheetName."
  try { if ($wb) { Invoke-ComRetry { $wb.Close($false) } } } catch {}
  try { if ($excel) { Invoke-ComRetry { $excel.Quit() } } } catch {}
  exit 1
}
$lastRow = $values.GetUpperBound(0)
$maxCol = $values.GetUpperBound(1)

$headerRow = 1
$maxHeaderScan = [Math]::Min(120, $lastRow)
for ($i = 1; $i -le $maxHeaderScan; $i++) {
  $parts = @()
  for ($c = 1; $c -le [Math]::Min(12, $maxCol); $c++) {
    $txt = [string]$values[$i, $c]
    if ($txt) { $parts += $txt.ToLowerInvariant() }
  }
  $rowText = ($parts -join " ")
  if ((($rowText -match "ppto") -or ($rowText -match "presupuesto") -or ($rowText -match "real")) -and ($rowText -match "acum")) {
    $headerRow = $i
    break
  }
}

$seriesColumns = Get-SeriesColumnsForHeaderRow -Values $values -RowNumber $headerRow -MaxCol $maxCol
if ($seriesColumns.Count -eq 0) {
  $metadataRows = @("RESULTADOS OPERATIVOS", "CATEGORIA", "EMPRESA", "PERIODO", "FECHA EXPORTACION")
  for ($candidate = 1; $candidate -le $maxHeaderScan; $candidate++) {
    $candidateSeries = Get-SeriesColumnsForHeaderRow -Values $values -RowNumber $candidate -MaxCol $maxCol
    if ($candidateSeries.Count -eq 0) { continue }
    $firstCellNorm = Normalize-Text ([string]$values[$candidate, 1])
    if (-not $firstCellNorm) { continue }
    if ($metadataRows -contains $firstCellNorm) { continue }

    $parts = @()
    for ($c = 1; $c -le [Math]::Min(12, $maxCol); $c++) {
      $txt = [string]$values[$candidate, $c]
      if ($txt) { $parts += $txt }
    }
    $candidateText = Normalize-Text ($parts -join " ")
    $looksLikeHeader = $candidateText -match "PPTO|PRESUPUESTO|REAL|ACUM|BUDGET|ACTUAL|YTD|20[0-9]{2}"
    $nextLabel = ([string]$values[$candidate + 1, 1]).Trim()
    if (-not $looksLikeHeader -and -not $nextLabel) { continue }

    $headerRow = $candidate
    $seriesColumns = $candidateSeries
    break
  }
}

$dataStart = $headerRow + 1
while ($dataStart -le $lastRow -and -not ([string]$values[$dataStart, 1]).Trim()) {
  $dataStart++
}

if ($lastRow -lt $dataStart) {
  Write-Error "No data rows found in $DataSheetName."
  try { if ($wb) { Invoke-ComRetry { $wb.Close($false) } } } catch {}
  try { if ($excel) { Invoke-ComRetry { $excel.Quit() } } } catch {}
  exit 1
}

$chartBlocks = Get-ChartBlocks -Values $values -SheetLastRow $lastRow -MaxCol $maxCol
if ($seriesColumns.Count -eq 0 -and $chartBlocks.Count -eq 0) {
  Write-Error "No series columns found in $DataSheetName."
  try { if ($wb) { Invoke-ComRetry { $wb.Close($false) } } } catch {}
  try { if ($excel) { Invoke-ComRetry { $excel.Quit() } } } catch {}
  exit 1
}

$wsCharts = $null
if ($ChartsSheetName -and $ChartsSheetName -ne $DataSheetName) {
  try {
    $wsCharts = $wb.Worksheets.Item($ChartsSheetName)
  }
  catch {
    $wsCharts = $null
  }

  if ($wsCharts) {
    try { Invoke-ComRetry { $wsCharts.Cells.Clear() } } catch {}
    try { Invoke-ComRetry { $wsCharts.ChartObjects().Delete() } } catch {}
  }
  else {
    $wsCharts = Invoke-ComRetry { $wb.Worksheets.Add($null, $wb.Worksheets.Item($wb.Worksheets.Count)) }
    Invoke-ComRetry { $wsCharts.Name = $ChartsSheetName }
  }
}
else {
  $wsCharts = $wsData
}

$chartModeNormalized = $ChartMode
if (-not $chartModeNormalized) {
  $chartModeNormalized = "split"
}
$chartModeNormalized = $chartModeNormalized.ToString().Trim().ToLowerInvariant()

$baseTop = 20
if ($wsCharts -eq $wsData) {
  $baseTop = $wsData.Rows.Item($lastRow + 2).Top
}

if ($chartModeNormalized -eq "combined") {
  $rangeLabels = $wsData.Range("A$($dataStart):A$($lastRow)")
  $chart = $wsCharts.ChartObjects().Add(20, $baseTop, 1120, 420)
  $chart.Chart.ChartType = $xlChartTypeBarClustered
  try {
    while ($chart.Chart.SeriesCollection().Count -gt 0) {
      [void]$chart.Chart.SeriesCollection(1).Delete()
    }
  }
  catch {}
  $chart.Chart.HasLegend = $true
  try { $chart.Chart.Legend.Position = $xlLegendPositionBottom } catch {}
  $chart.Chart.HasTitle = $true
  $chart.Chart.ChartTitle.Text = "Resultados operativos"

  for ($idx = 0; $idx -lt $seriesColumns.Count; $idx++) {
    $seriesInfo = $seriesColumns[$idx]
    $colLetter = Get-ColumnLetter $seriesInfo.Column
    $rangeValues = $wsData.Range("$colLetter$($dataStart):$colLetter$($lastRow)")

    $series = $chart.Chart.SeriesCollection().NewSeries()
    $series.Values = $rangeValues

    $series.XValues = $rangeLabels
    $series.Name = $seriesInfo.Name

    $seriesType = Resolve-SeriesType -MetaList $seriesMetaList -SeriesName $seriesInfo.Name -SeriesIndex $idx
    $seriesColor = Resolve-SeriesColorHex -MetaList $seriesMetaList -SeriesName $seriesInfo.Name -SeriesIndex $idx
    Apply-SeriesStyle -Series $series -HexColor $seriesColor -SeriesType $seriesType
  }

  Set-ChartBarLayout -ChartObject $chart
  try {
    $valueAxis = $chart.Chart.Axes($xlAxisTypeValue)
    $valueAxis.TickLabels.NumberFormat = "#,##0.00"
  }
  catch {}
}
elseif ($chartBlocks.Count -gt 0) {
  $chartTop = $baseTop
  for ($blockIdx = 0; $blockIdx -lt $chartBlocks.Count; $blockIdx++) {
    $block = $chartBlocks[$blockIdx]
    $rangeLabels = $wsData.Range("A$($block.DataStart):A$($block.DataEnd)")
    $labelsCount = $block.DataEnd - $block.DataStart + 1
    $chartHeight = [Math]::Max(320, [Math]::Min(700, 220 + ($labelsCount * 18)))
    $chart = $wsCharts.ChartObjects().Add(20, $chartTop, 1120, $chartHeight)
    $chart.Chart.ChartType = $xlChartTypeBarClustered
    try {
      while ($chart.Chart.SeriesCollection().Count -gt 0) {
        [void]$chart.Chart.SeriesCollection(1).Delete()
      }
    }
    catch {}
    $chart.Chart.HasLegend = $block.SeriesColumns.Count -gt 1
    try { $chart.Chart.Legend.Position = $xlLegendPositionBottom } catch {}
    $chart.Chart.HasTitle = $true
    $chart.Chart.ChartTitle.Text = if ($block.Title) { $block.Title } else { "Resultados operativos" }

    for ($seriesIdx = 0; $seriesIdx -lt $block.SeriesColumns.Count; $seriesIdx++) {
      $seriesInfo = $block.SeriesColumns[$seriesIdx]
      $colLetter = Get-ColumnLetter $seriesInfo.Column
      $rangeValues = $wsData.Range("$colLetter$($block.DataStart):$colLetter$($block.DataEnd)")

      $series = $chart.Chart.SeriesCollection().NewSeries()
      $series.Values = $rangeValues

      $series.XValues = $rangeLabels
      $series.Name = $seriesInfo.Name

      $seriesType = Resolve-SeriesType -MetaList $seriesMetaList -SeriesName $seriesInfo.Name -SeriesIndex $seriesIdx
      $seriesColor = Resolve-SeriesColorHex -MetaList $seriesMetaList -SeriesName $seriesInfo.Name -SeriesIndex $seriesIdx
      Apply-SeriesStyle -Series $series -HexColor $seriesColor -SeriesType $seriesType
    }

    Set-ChartBarLayout -ChartObject $chart
    try {
      $valueAxis = $chart.Chart.Axes($xlAxisTypeValue)
      $valueAxis.TickLabels.NumberFormat = "#,##0.00"
    }
    catch {}

    $chartTop += $chartHeight + 35
  }
}
else {
  $rangeLabels = $wsData.Range("A$($dataStart):A$($lastRow)")
  $splitSeries = @($seriesColumns)
  for ($idx = 0; $idx -lt $splitSeries.Count; $idx++) {
    $seriesInfo = $splitSeries[$idx]
    $colLetter = Get-ColumnLetter $seriesInfo.Column
    $rangeValues = $wsData.Range("$colLetter$($dataStart):$colLetter$($lastRow)")
    $chartTop = $baseTop + ($idx * 320)

    $chart = $wsCharts.ChartObjects().Add(20, $chartTop, 960, 300)
    $chart.Chart.ChartType = $xlChartTypeBarClustered
    try {
      while ($chart.Chart.SeriesCollection().Count -gt 0) {
        [void]$chart.Chart.SeriesCollection(1).Delete()
      }
    }
    catch {}
    $series = $chart.Chart.SeriesCollection().NewSeries()
    $series.Values = $rangeValues
    $series.XValues = $rangeLabels
    $series.Name = $seriesInfo.Name
    $chart.Chart.HasTitle = $true
    $chart.Chart.ChartTitle.Text = $seriesInfo.Name

    $seriesColor = Resolve-SeriesColorHex -MetaList $seriesMetaList -SeriesName $seriesInfo.Name -SeriesIndex $idx
    Apply-SeriesStyle -Series $series -HexColor $seriesColor -SeriesType "bar"
    Set-ChartBarLayout -ChartObject $chart
    try {
      $valueAxis = $chart.Chart.Axes($xlAxisTypeValue)
      $valueAxis.TickLabels.NumberFormat = "#,##0.00"
    }
    catch {}
  }
}

$wsTable = $null
if ($TableSheetName) {
  try {
    $wsTable = $wb.Worksheets.Item($TableSheetName)
  }
  catch {
    $wsTable = $null
  }
}
if (-not $wsTable) {
  try {
    $wsTable = $wb.Worksheets.Item(1)
  }
  catch {
    $wsTable = $null
  }
}

if (-not $OutputPath) {
  $dir = Split-Path $inputFull
  $base = [System.IO.Path]::GetFileNameWithoutExtension($inputFull)
  $OutputPath = Join-Path $dir ($base + "_graficas.xlsx")
}

if ($wsTable) {
  try {
    $usedRange = Invoke-ComRetry { $wsTable.UsedRange }
    if ($usedRange) {
      [void](Invoke-ComRetry { $usedRange.Columns.AutoFit() })
    }
  }
  catch {
  }
}

if ($wsTable) {
    try { Invoke-ComRetry { $wsTable.Activate() } } catch {}
  }
  else {
    try { Invoke-ComRetry { $wsCharts.Activate() } } catch {}
  }
  try { Invoke-ComRetry { $wb.SaveAs($OutputPath) } } catch {}
  Write-Host "Charts created: $OutputPath"
}
catch {
  $msg = $_.Exception.Message
  if (-not $msg) { $msg = $_.ToString() }
  Write-Error -ErrorAction Continue $msg
  try { if ($wb) { Invoke-ComRetry { $wb.Close($false) } } } catch {}
  try { if ($excel) { Invoke-ComRetry { $excel.Quit() } } } catch {}
  exit 1
}
finally {
  if ($wb) {
    try { Invoke-ComRetry { $wb.Close($false) } } catch {}
  }
  if ($excel) {
    try { Invoke-ComRetry { $excel.Quit() } } catch {}
  }
  try { [ExcelMessageFilter]::Revoke() } catch {}
  [System.GC]::Collect()
  [System.GC]::WaitForPendingFinalizers()
}
