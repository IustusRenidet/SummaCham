param(
  [Parameter(Mandatory = $true)]
  [string]$InputPath,
  [string]$OutputPath,
  [string]$DataSheetName = "OperativoData",
  [string]$ChartsSheetName = "OperativoCharts"
)

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
try {
  $wsCharts = $wb.Worksheets.Item($ChartsSheetName)
} catch {
  $wsCharts = $null
}

if ($wsCharts) {
  $wsCharts.Cells.Clear()
} else {
  $wsCharts = $wb.Worksheets.Add()
  $wsCharts.Name = $ChartsSheetName
}

$rangeLabels = $wsData.Range("A$($dataStart):A$($lastRow)")
$rangeBudget = $wsData.Range("B$($dataStart):B$($lastRow)")
$rangeReal = $wsData.Range("C$($dataStart):C$($lastRow)")

# Chart 1: Budget
$chart1 = $wsCharts.ChartObjects().Add(20, 20, 620, 300)
$chart1.Chart.ChartType = 58 # xlBarClustered
$chart1.Chart.SetSourceData($rangeBudget)
$series1 = $chart1.Chart.SeriesCollection(1)
$series1.XValues = $rangeLabels
$series1.Name = "Ppto Acumulado"
$chart1.Chart.HasTitle = $true
$chart1.Chart.ChartTitle.Text = "Ppto Acumulado"

# Chart 2: Real
$chart2 = $wsCharts.ChartObjects().Add(20, 340, 620, 300)
$chart2.Chart.ChartType = 58 # xlBarClustered
$chart2.Chart.SetSourceData($rangeReal)
$series2 = $chart2.Chart.SeriesCollection(1)
$series2.XValues = $rangeLabels
$series2.Name = "Real Acumulado"
$chart2.Chart.HasTitle = $true
$chart2.Chart.ChartTitle.Text = "Real Acumulado"

if (-not $OutputPath) {
  $dir = Split-Path $inputFull
  $base = [System.IO.Path]::GetFileNameWithoutExtension($inputFull)
  $OutputPath = Join-Path $dir ($base + "_graficas.xlsx")
}

$wb.SaveAs($OutputPath)
$wb.Close($false)
$excel.Quit()

Write-Host "Charts created: $OutputPath"

