param(
  [Parameter(Mandatory = $true)]
  [string]$InputPath,
  [string]$OutputPath,
  [string]$DataSheetName = "GraficasData",
  [string]$ChartsSheetName = "Graficas",
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

function Pick-SeriesColor {
  param(
    [string]$Name,
    [int]$Index
  )
  $label = ($Name | ForEach-Object { $_.ToString().ToLower() })
  if ($label -match "net" -or $label -match "neto") { return "#94A3B8" }
  if ($label -match "anterior" -or $label -match "aa" -or $label -match "prev") { return "#94A3B8" }
  if ($label -match "ppto" -or $label -match "presupuesto" -or $label -match "budget") { return "#60A5FA" }
  if ($label -match "real") { return "#0D47A1" }
  $palette = @("#0D47A1", "#60A5FA", "#94A3B8", "#F59E0B", "#10B981")
  return $palette[$Index % $palette.Count]
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

$wsCharts = $null
if ($ChartsSheetName) {
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

$lastRow = $wsData.Cells.Item($wsData.Rows.Count, 1).End(-4162).Row # xlUp
if ($lastRow -lt 1) {
  Write-Error "No chart blocks found in $DataSheetName."
  $wb.Close($false)
  $excel.Quit()
  exit 1
}

$row = 1
$chartTop = 20
while ($row -le $lastRow) {
  $marker = $wsData.Cells.Item($row, 1).Text
  if ($marker -eq "CHART") {
    $title = $wsData.Cells.Item($row, 2).Text
    $headerRow = $row + 1
    $col = 2
    while ($wsData.Cells.Item($headerRow, $col).Text) {
      $col += 1
    }
    $lastCol = $col - 1
    $dataRow = $headerRow + 1
    while ($wsData.Cells.Item($dataRow, 1).Text) {
      $dataRow += 1
    }
    $dataLast = $dataRow - 1

    if ($lastCol -ge 2 -and $dataLast -ge $headerRow + 1) {
      $seriesNames = @()
      for ($c = 2; $c -le $lastCol; $c++) {
        $seriesNames += $wsData.Cells.Item($headerRow, $c).Text
      }
      $range = $wsData.Range(
        $wsData.Cells.Item($headerRow, 1),
        $wsData.Cells.Item($dataLast, $lastCol)
      )
      $chartObj = $wsCharts.ChartObjects().Add(20, $chartTop, 720, 360)
      $chartObj.Chart.ChartType = 51 # xlColumnClustered
      $chartObj.Chart.SetSourceData($range)
      $chartObj.Chart.HasTitle = $true
      $chartObj.Chart.ChartTitle.Text = $title
      $seriesCount = $chartObj.Chart.SeriesCollection().Count
      for ($i = 1; $i -le $seriesCount; $i++) {
        $series = $chartObj.Chart.SeriesCollection($i)
        $name = if ($seriesNames.Count -ge $i) { $seriesNames[$i - 1] } else { $series.Name }
        $hex = Pick-SeriesColor $name ($i - 1)
        $color = Convert-HexToOle $hex
        if ($color -ne $null) {
          $series.Format.Fill.Visible = $true
          $series.Format.Fill.Solid()
          $series.Format.Fill.ForeColor.RGB = $color
          $series.Format.Line.Visible = $true
          $series.Format.Line.ForeColor.RGB = $color
          $series.Interior.Color = $color
        }
      }
      $chartTop += 380
    }

    $row = $dataLast + 2
  } else {
    $row += 1
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
