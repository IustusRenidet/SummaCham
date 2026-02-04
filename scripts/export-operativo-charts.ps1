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
    } elseif ($entry.PSObject.Properties.Name -contains "name") {
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
    } elseif ($entry.PSObject.Properties.Name -contains "chartType") {
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
    try { $Series.ChartType = 4 } catch {}
    try { $Series.MarkerStyle = -4142 } catch {}
    try { $Series.Format.Line.Weight = 2 } catch {}
  } else {
    try { $Series.ChartType = 58 } catch {}
  }

  $oleColor = Convert-HexToOle $HexColor
  if ($oleColor -eq $null) { return }

  try {
    $Series.Format.Fill.Visible = $true
    $Series.Format.Fill.Solid()
    $Series.Format.Fill.ForeColor.RGB = $oleColor
  } catch {}
  try {
    $Series.Format.Line.Visible = $true
    $Series.Format.Line.ForeColor.RGB = $oleColor
  } catch {}
  try { $Series.Interior.Color = $oleColor } catch {}
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
    } elseif ($parsedMeta) {
      $seriesMetaList = @($parsedMeta)
    }
  } catch {
    Write-Host "SeriesMeta no valido. Se usaran colores por defecto."
  }
}

$excel = New-Object -ComObject Excel.Application
$excel.Visible = $false
$excel.DisplayAlerts = $false

$wb = $excel.Workbooks.Open($inputFull)

try {
  $wsData = $wb.Worksheets.Item($DataSheetName)
} catch {
  Write-Error "Data sheet not found: $DataSheetName"
  $wb.Close($false)
  $excel.Quit()
  exit 1
}

function Get-SeriesColumnsForHeaderRow {
  param(
    $Sheet,
    [int]$RowNumber
  )
  if (-not $Sheet -or $RowNumber -lt 1) { return @() }
  $lastCol = $Sheet.Cells.Item($RowNumber, $Sheet.Columns.Count).End(-4159).Column # xlToLeft
  if ($lastCol -lt 2) { return @() }
  $result = @()
  for ($col = 2; $col -le $lastCol; $col++) {
    $seriesName = ([string]$Sheet.Cells.Item($RowNumber, $col).Text).Trim()
    if (-not $seriesName) { continue }
    $result += [PSCustomObject]@{
      Column = $col
      Name = $seriesName
    }
  }
  return @($result)
}

$headerRow = 1
$maxHeaderScan = [Math]::Min(120, $wsData.Rows.Count)
for ($i = 1; $i -le $maxHeaderScan; $i++) {
  $parts = @()
  for ($c = 1; $c -le 12; $c++) {
    $txt = [string]$wsData.Cells.Item($i, $c).Text
    if ($txt) { $parts += $txt.ToLowerInvariant() }
  }
  $rowText = ($parts -join " ")
  if ((($rowText -match "ppto") -or ($rowText -match "presupuesto") -or ($rowText -match "real")) -and ($rowText -match "acum")) {
    $headerRow = $i
    break
  }
}

$seriesColumns = Get-SeriesColumnsForHeaderRow -Sheet $wsData -RowNumber $headerRow
if ($seriesColumns.Count -eq 0) {
  $metadataRows = @("RESULTADOS OPERATIVOS", "CATEGORIA", "EMPRESA", "PERIODO", "FECHA EXPORTACION")
  for ($candidate = 1; $candidate -le $maxHeaderScan; $candidate++) {
    $candidateSeries = Get-SeriesColumnsForHeaderRow -Sheet $wsData -RowNumber $candidate
    if ($candidateSeries.Count -eq 0) { continue }
    $firstCellNorm = Normalize-Text ([string]$wsData.Cells.Item($candidate, 1).Text)
    if (-not $firstCellNorm) { continue }
    if ($metadataRows -contains $firstCellNorm) { continue }

    $parts = @()
    for ($c = 1; $c -le 12; $c++) {
      $txt = [string]$wsData.Cells.Item($candidate, $c).Text
      if ($txt) { $parts += $txt }
    }
    $candidateText = Normalize-Text ($parts -join " ")
    $looksLikeHeader = $candidateText -match "PPTO|PRESUPUESTO|REAL|ACUM|BUDGET|ACTUAL|YTD|20[0-9]{2}"
    $nextLabel = ([string]$wsData.Cells.Item($candidate + 1, 1).Text).Trim()
    if (-not $looksLikeHeader -and -not $nextLabel) { continue }

    $headerRow = $candidate
    $seriesColumns = $candidateSeries
    break
  }
}

$dataStart = $headerRow + 1
$lastRow = $wsData.Cells.Item($wsData.Rows.Count, 1).End(-4162).Row # xlUp
while ($dataStart -le $lastRow -and -not ([string]$wsData.Cells.Item($dataStart, 1).Text).Trim()) {
  $dataStart++
}

if ($lastRow -lt $dataStart) {
  Write-Error "No data rows found in $DataSheetName."
  $wb.Close($false)
  $excel.Quit()
  exit 1
}

if ($seriesColumns.Count -eq 0) {
  Write-Error "No series columns found in $DataSheetName."
  $wb.Close($false)
  $excel.Quit()
  exit 1
}

$wsCharts = $null
if ($ChartsSheetName -and $ChartsSheetName -ne $DataSheetName) {
  try {
    $wsCharts = $wb.Worksheets.Item($ChartsSheetName)
  } catch {
    $wsCharts = $null
  }

  if ($wsCharts) {
    $wsCharts.Cells.Clear()
  } else {
    $wsCharts = $wb.Worksheets.Add($null, $wb.Worksheets.Item($wb.Worksheets.Count))
    $wsCharts.Name = $ChartsSheetName
  }
} else {
  $wsCharts = $wsData
}

$rangeLabels = $wsData.Range("A$($dataStart):A$($lastRow)")

$baseTop = 20
if ($wsCharts -eq $wsData) {
  $baseTop = $wsData.Rows.Item($lastRow + 2).Top
}

$chartModeNormalized = $ChartMode
if (-not $chartModeNormalized) {
  $chartModeNormalized = "split"
}
$chartModeNormalized = $chartModeNormalized.ToString().Trim().ToLowerInvariant()

if ($chartModeNormalized -eq "combined") {
  $chart = $wsCharts.ChartObjects().Add(20, $baseTop, 1120, 420)
  $chart.Chart.ChartType = 58 # xlBarClustered
  $chart.Chart.HasLegend = $true
  try { $chart.Chart.Legend.Position = -4107 } catch {} # xlLegendPositionBottom
  $chart.Chart.HasTitle = $true
  $chart.Chart.ChartTitle.Text = "Resultados operativos"

  for ($idx = 0; $idx -lt $seriesColumns.Count; $idx++) {
    $seriesInfo = $seriesColumns[$idx]
    $colLetter = Get-ColumnLetter $seriesInfo.Column
    $rangeValues = $wsData.Range("$colLetter$($dataStart):$colLetter$($lastRow)")

    if ($idx -eq 0) {
      $chart.Chart.SetSourceData($rangeValues)
      $series = $chart.Chart.SeriesCollection(1)
    } else {
      $series = $chart.Chart.SeriesCollection().NewSeries()
      $series.Values = $rangeValues
    }

    $series.XValues = $rangeLabels
    $series.Name = $seriesInfo.Name

    $seriesType = Resolve-SeriesType -MetaList $seriesMetaList -SeriesName $seriesInfo.Name -SeriesIndex $idx
    $seriesColor = Resolve-SeriesColorHex -MetaList $seriesMetaList -SeriesName $seriesInfo.Name -SeriesIndex $idx
    Apply-SeriesStyle -Series $series -HexColor $seriesColor -SeriesType $seriesType
  }

  try {
    $valueAxis = $chart.Chart.Axes(1) # xlValue
    $valueAxis.TickLabels.NumberFormat = "#,##0.00"
  } catch {}
} else {
  $splitSeries = @($seriesColumns)
  if ($splitSeries.Count -gt 2) {
    $splitSeries = @($splitSeries[0], $splitSeries[1])
  }

  for ($idx = 0; $idx -lt $splitSeries.Count; $idx++) {
    $seriesInfo = $splitSeries[$idx]
    $colLetter = Get-ColumnLetter $seriesInfo.Column
    $rangeValues = $wsData.Range("$colLetter$($dataStart):$colLetter$($lastRow)")
    $chartTop = $baseTop + ($idx * 320)

    $chart = $wsCharts.ChartObjects().Add(20, $chartTop, 960, 300)
    $chart.Chart.ChartType = 58 # xlBarClustered
    $chart.Chart.SetSourceData($rangeValues)
    $series = $chart.Chart.SeriesCollection(1)
    $series.XValues = $rangeLabels
    $series.Name = $seriesInfo.Name
    $chart.Chart.HasTitle = $true
    $chart.Chart.ChartTitle.Text = $seriesInfo.Name

    $seriesColor = Resolve-SeriesColorHex -MetaList $seriesMetaList -SeriesName $seriesInfo.Name -SeriesIndex $idx
    Apply-SeriesStyle -Series $series -HexColor $seriesColor -SeriesType "bar"
    try {
      $valueAxis = $chart.Chart.Axes(1)
      $valueAxis.TickLabels.NumberFormat = "#,##0.00"
    } catch {}
  }
}

$wsTable = $null
if ($TableSheetName) {
  try {
    $wsTable = $wb.Worksheets.Item($TableSheetName)
  } catch {
    $wsTable = $null
  }
}
if (-not $wsTable) {
  try {
    $wsTable = $wb.Worksheets.Item(1)
  } catch {
    $wsTable = $null
  }
}

if (-not $OutputPath) {
  $dir = Split-Path $inputFull
  $base = [System.IO.Path]::GetFileNameWithoutExtension($inputFull)
  $OutputPath = Join-Path $dir ($base + "_graficas.xlsx")
}

if ($wsTable) {
  $wsTable.Activate()
} else {
  $wsCharts.Activate()
}
$wb.SaveAs($OutputPath)
$wb.Close($false)
$excel.Quit()

Write-Host "Charts created: $OutputPath"
