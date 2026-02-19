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
    } catch [System.Runtime.InteropServices.COMException] {
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
    } catch {
    }
  }
  return $names
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
  try { $excel.EnableEvents = $false } catch {}
  try { $excel.ScreenUpdating = $false } catch {}

  $wb = Invoke-ComRetry { $excel.Workbooks.Open($inputFull) }

  try {
    $wsData = Invoke-ComRetry { $wb.Worksheets.Item($DataSheetName) }
  } catch {
    $sheets = @()
    try { $sheets = Get-WorkbookSheetNames -Workbook $wb } catch {}
    $available = if ($sheets.Count) { " Disponibles: " + ($sheets -join ", ") } else { "" }
    throw ("Data sheet not found: {0}.{1}" -f $DataSheetName, $available)
  }

  if ($ChartsSheetName) {
    try {
      $wsCharts = Invoke-ComRetry { $wb.Worksheets.Item($ChartsSheetName) }
    } catch {
      $wsCharts = $null
    }

    if ($wsCharts) {
      try { Invoke-ComRetry { $wsCharts.Cells.Clear() } } catch {}
      try { Invoke-ComRetry { $wsCharts.ChartObjects().Delete() } } catch {}
    } else {
      $wsCharts = Invoke-ComRetry { $wb.Worksheets.Add($null, $wb.Worksheets.Item($wb.Worksheets.Count)) }
      Invoke-ComRetry { $wsCharts.Name = $ChartsSheetName }
    }
  } else {
    $wsCharts = $wsData
  }

  $lastRow = Invoke-ComRetry { $wsData.Cells.Item($wsData.Rows.Count, 1).End(-4162).Row } # xlUp
  if ($lastRow -lt 1) {
    throw "No chart blocks found in $DataSheetName."
  }

  $row = 1
  $chartTop = 20
  while ($row -le $lastRow) {
    $marker = (Invoke-ComRetry { [string]$wsData.Cells.Item($row, 1).Text }).Trim()
    if ($marker -eq "CHART") {
      $title = (Invoke-ComRetry { [string]$wsData.Cells.Item($row, 2).Text }).Trim()
      $headerRow = $row + 1
      $col = 2
      while ((Invoke-ComRetry { [string]$wsData.Cells.Item($headerRow, $col).Text }).Trim()) {
        $col += 1
      }
      $lastCol = $col - 1
      $dataRow = $headerRow + 1
      while ((Invoke-ComRetry { [string]$wsData.Cells.Item($dataRow, 1).Text }).Trim()) {
        $dataRow += 1
      }
      $dataLast = $dataRow - 1

      if ($lastCol -ge 2 -and $dataLast -ge $headerRow + 1) {
        $seriesNames = @()
        for ($c = 2; $c -le $lastCol; $c++) {
          $seriesNames += (Invoke-ComRetry { [string]$wsData.Cells.Item($headerRow, $c).Text }).Trim()
        }
        $range = Invoke-ComRetry {
          $wsData.Range(
            $wsData.Cells.Item($headerRow, 1),
            $wsData.Cells.Item($dataLast, $lastCol)
          )
        }
        $chartObj = Invoke-ComRetry { $wsCharts.ChartObjects().Add(20, $chartTop, 720, 360) }
        Invoke-ComRetry { $chartObj.Chart.ChartType = 51 } # xlColumnClustered
        Invoke-ComRetry { $chartObj.Chart.SetSourceData($range) }
        Invoke-ComRetry { $chartObj.Chart.HasTitle = $true }
        Invoke-ComRetry { $chartObj.Chart.ChartTitle.Text = $title }
        $seriesCount = Invoke-ComRetry { $chartObj.Chart.SeriesCollection().Count }
        for ($i = 1; $i -le $seriesCount; $i++) {
          $series = Invoke-ComRetry { $chartObj.Chart.SeriesCollection($i) }
          $name = if ($seriesNames.Count -ge $i) { $seriesNames[$i - 1] } else { Invoke-ComRetry { [string]$series.Name } }
          $hex = Pick-SeriesColor $name ($i - 1)
          $color = Convert-HexToOle $hex
          if ($color -ne $null) {
            Invoke-ComRetry { $series.Format.Fill.Visible = $true }
            Invoke-ComRetry { $series.Format.Fill.Solid() }
            Invoke-ComRetry { $series.Format.Fill.ForeColor.RGB = $color }
            Invoke-ComRetry { $series.Format.Line.Visible = $true }
            Invoke-ComRetry { $series.Format.Line.ForeColor.RGB = $color }
            try { Invoke-ComRetry { $series.Interior.Color = $color } } catch {}
          }
        }
        $chartTop += 380
      }

      $row = $dataLast + 2
    } else {
      $row += 1
    }
  }

  if ($TableSheetName) {
    try {
      $wsTable = Invoke-ComRetry { $wb.Worksheets.Item($TableSheetName) }
    } catch {
      $wsTable = $null
    }
  }
  if (-not $wsTable) {
    try {
      $wsTable = Invoke-ComRetry { $wb.Worksheets.Item(1) }
    } catch {
      $wsTable = $null
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
  } catch {}

  if ($wsTable) {
    try { Invoke-ComRetry { $wsTable.Activate() } } catch {}
  } else {
    try { Invoke-ComRetry { $wsCharts.Activate() } } catch {}
  }

  Invoke-ComRetry { $wb.SaveAs($OutputPath) }
  Write-Host "Charts created: $OutputPath"
} catch {
  $msg = $_.Exception.Message
  if (-not $msg) { $msg = $_.ToString() }
  Write-Error -ErrorAction Continue $msg
  exit 1
} finally {
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
