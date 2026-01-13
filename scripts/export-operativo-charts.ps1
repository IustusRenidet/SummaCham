param(
  [Parameter(Mandatory = $true)]
  [string]$InputPath,
  [string]$OutputPath,
  [string]$DataSheetName = "OperativoData",
  [string]$ChartsSheetName = "OperativoData",
  [string]$TableSheetName = ""
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

if (-not (Test-Path $InputPath)) {
  Write-Error "Input file not found: $InputPath"
  exit 1
}

$inputFull = (Resolve-Path $InputPath).Path

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

$headerRow = 1
for ($i = 1; $i -le 30; $i++) {
  $value = $wsData.Cells.Item($i, 2).Text
  if ($value -eq "Ppto Acumulado") {
    $headerRow = $i
    break
  }
}

$dataStart = $headerRow + 1
$lastRow = $wsData.Cells.Item($wsData.Rows.Count, 1).End(-4162).Row # xlUp

if ($lastRow -lt $dataStart) {
  Write-Error "No data rows found in $DataSheetName."
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
$rangeBudget = $wsData.Range("B$($dataStart):B$($lastRow)")
$rangeReal = $wsData.Range("C$($dataStart):C$($lastRow)")

# Chart 1: Budget
$baseTop = 20
if ($wsCharts -eq $wsData) {
  $baseTop = $wsData.Rows.Item($lastRow + 2).Top
}
$chart1 = $wsCharts.ChartObjects().Add(20, $baseTop, 620, 300)
$chart1.Chart.ChartType = 58 # xlBarClustered
$chart1.Chart.SetSourceData($rangeBudget)
$series1 = $chart1.Chart.SeriesCollection(1)
$series1.XValues = $rangeLabels
$series1.Name = "Ppto Acumulado"
$budgetColor = Convert-HexToOle "#4472C4"
if ($budgetColor -ne $null) {
  $series1.Format.Fill.Visible = $true
  $series1.Format.Fill.Solid()
  $series1.Format.Fill.ForeColor.RGB = $budgetColor
  $series1.Format.Line.Visible = $true
  $series1.Format.Line.ForeColor.RGB = $budgetColor
  $series1.Interior.Color = $budgetColor
}
$chart1.Chart.HasTitle = $true
$chart1.Chart.ChartTitle.Text = "Ppto Acumulado"

# Chart 2: Real
$chart2 = $wsCharts.ChartObjects().Add(20, ($baseTop + 320), 620, 300)
$chart2.Chart.ChartType = 58 # xlBarClustered
$chart2.Chart.SetSourceData($rangeReal)
$series2 = $chart2.Chart.SeriesCollection(1)
$series2.XValues = $rangeLabels
$series2.Name = "Real Acumulado"
$realColor = Convert-HexToOle "#FFC000"
if ($realColor -ne $null) {
  $series2.Format.Fill.Visible = $true
  $series2.Format.Fill.Solid()
  $series2.Format.Fill.ForeColor.RGB = $realColor
  $series2.Format.Line.Visible = $true
  $series2.Format.Line.ForeColor.RGB = $realColor
  $series2.Interior.Color = $realColor
}
$chart2.Chart.HasTitle = $true
$chart2.Chart.ChartTitle.Text = "Real Acumulado"

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
