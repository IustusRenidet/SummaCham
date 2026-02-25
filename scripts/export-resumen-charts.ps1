param(
  [Parameter(Mandatory = $true)]
  [string]$InputPath,
  [string]$OutputPath,
  [string]$DataSheetName = "GraficasData",
  [string]$ChartsSheetName = "Graficas",
  [string]$TableSheetName = ""
)

$ErrorActionPreference = "Stop"

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

function Get-SeriesColor {
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

$excel = $null
$wb = $null
$wsData = $null
$wsCharts = $null
$wsTable = $null

try {
  try { [ExcelMessageFilter]::Register() } catch {}

  if (-not (Test-Path $InputPath)) {
    throw "Input file not found: $InputPath"
  }

  $inputFull = (Resolve-Path $InputPath).Path

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
    $available = if ($sheets.Count) { " Disponibles: " + ($sheets -join ", ") } else { "" }
    Write-Error ("Data sheet not found: {0}.{1}" -f $DataSheetName, $available)
    try { if ($wb) { Invoke-ComRetry { $wb.Close($false) } } } catch {}
    try { if ($excel) { Invoke-ComRetry { $excel.Quit() } } } catch {}
    exit 1
  }

  if ($ChartsSheetName) {
    try {
      $wsCharts = Invoke-ComRetry { $wb.Worksheets.Item($ChartsSheetName) }
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
    Write-Error "No chart blocks found in $DataSheetName."
    try { if ($wb) { Invoke-ComRetry { $wb.Close($false) } } } catch {}
    try { if ($excel) { Invoke-ComRetry { $excel.Quit() } } } catch {}
    exit 1
  }

  $lastRow = $values.GetUpperBound(0)
  $maxCol = $values.GetUpperBound(1)

  if ($lastRow -lt 1) {
    Write-Error "No chart blocks found in $DataSheetName."
    try { if ($wb) { Invoke-ComRetry { $wb.Close($false) } } } catch {}
    try { if ($excel) { Invoke-ComRetry { $excel.Quit() } } } catch {}
    exit 1
  }

  $row = 1
  $chartTop = 20
  while ($row -le $lastRow) {
    $marker = [string]$values[$row, 1]
    $marker = $marker.Trim()
    if ($marker -eq "CHART") {
      $title = [string]$values[$row, 2]
      $title = $title.Trim()
      $headerRow = $row + 1
      $col = 2
      while ($col -le $maxCol -and ([string]$values[$headerRow, $col]).Trim()) {
        $col += 1
      }
      $lastCol = $col - 1
      $dataRow = $headerRow + 1
      while ($dataRow -le $lastRow -and ([string]$values[$dataRow, 1]).Trim()) {
        $dataRow += 1
      }
      $dataLast = $dataRow - 1

      if ($lastCol -ge 2 -and $dataLast -ge $headerRow + 1) {
        $seriesNames = @()
        for ($c = 2; $c -le $lastCol; $c++) {
          $seriesNames += ([string]$values[$headerRow, $c]).Trim()
        }

        $rangeLabels = Invoke-ComRetry { $wsData.Range("A$($headerRow + 1):A$($dataLast)") }

        $chartObj = Invoke-ComRetry { $wsCharts.ChartObjects().Add(20, $chartTop, 720, 360) }
        Invoke-ComRetry { $chartObj.Chart.ChartType = 51 } # xlColumnClustered
        try {
          while ((Invoke-ComRetry { $chartObj.Chart.SeriesCollection().Count }) -gt 0) {
            [void](Invoke-ComRetry { $chartObj.Chart.SeriesCollection(1).Delete() })
          }
        }
        catch {}

        Invoke-ComRetry { $chartObj.Chart.HasTitle = $true }
        Invoke-ComRetry { $chartObj.Chart.ChartTitle.Text = $title }

        for ($c = 2; $c -le $lastCol; $c++) {
          $colLetter = Get-ColumnLetter $c
          $rangeValues = Invoke-ComRetry { $wsData.Range("$colLetter$($headerRow + 1):$colLetter$($dataLast)") }

          $series = Invoke-ComRetry { $chartObj.Chart.SeriesCollection().NewSeries() }
          Invoke-ComRetry { $series.Values = $rangeValues }
          Invoke-ComRetry { $series.XValues = $rangeLabels }

          $name = if ($seriesNames.Count -ge ($c - 1)) { $seriesNames[$c - 2] } else { "" }
          if (-not $name) {
            $name = ([string]$values[$headerRow, $c]).Trim()
          }
          if ($name) {
            Invoke-ComRetry { $series.Name = $name }
          }

          $hex = Get-SeriesColor $name ($c - 2)
          $color = Convert-HexToOle $hex
          if ($null -ne $color) {
            try { Invoke-ComRetry { $series.Format.Fill.Visible = $true } } catch {}
            try { Invoke-ComRetry { $series.Format.Fill.Solid() } } catch {}
            try { Invoke-ComRetry { $series.Format.Fill.ForeColor.RGB = $color } } catch {}
            try { Invoke-ComRetry { $series.Format.Line.Visible = $true } } catch {}
            try { Invoke-ComRetry { $series.Format.Line.ForeColor.RGB = $color } } catch {}
            try { Invoke-ComRetry { $series.Interior.Color = $color } } catch {}
          }
        }
        $chartTop += 380
      }

      $row = $dataLast + 2
    }
    else {
      $row += 1
    }
  }

  if ($TableSheetName) {
    try {
      $wsTable = Invoke-ComRetry { $wb.Worksheets.Item($TableSheetName) }
    }
    catch {
      $wsTable = $null
    }
  }
  if (-not $wsTable) {
    try {
      $wsTable = Invoke-ComRetry { $wb.Worksheets.Item(1) }
    }
    catch {
      $wsTable = $null
    }
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

  if (-not $OutputPath) {
    $dir = Split-Path $inputFull
    $base = [System.IO.Path]::GetFileNameWithoutExtension($inputFull)
    $OutputPath = Join-Path $dir ($base + "_graficas.xlsx")
  }

  try {
    if (Test-Path $OutputPath) {
      Remove-Item -LiteralPath $OutputPath -Force -ErrorAction SilentlyContinue
    }
  }
  catch {}

  if ($wsTable) {
    try { Invoke-ComRetry { $wsTable.Activate() } } catch {}
  }
  else {
    try { Invoke-ComRetry { $wsCharts.Activate() } } catch {}
  }

  Invoke-ComRetry { $wb.SaveAs($OutputPath) }
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

  foreach ($obj in @($wsTable, $wsCharts, $wsData, $wb, $excel)) {
    if ($null -ne $obj) {
      try { [System.Runtime.InteropServices.Marshal]::FinalReleaseComObject($obj) | Out-Null } catch {}
    }
  }
  try { [GC]::Collect(); [GC]::WaitForPendingFinalizers() } catch {}
  try { [ExcelMessageFilter]::Revoke() } catch {}
}
