param(
  [Parameter(Mandatory = $true)]
  [string]$InputPath,
  [string]$OutputPath,
  [string]$Title = "",
  [switch]$NoTitleSlide,
  [switch]$Visible,
  [string[]]$SheetNames = @(),
  [switch]$IncludeHiddenSheets
)

$msoFalse = 0
$msoTrue = -1
$msoTextOrientationHorizontal = 1

$ppLayoutTitle = 1
$ppLayoutBlank = 12

function Sanitize-FileName {
  param([string]$Name)
  if (-not $Name) { return "item" }
  $invalidChars = [System.IO.Path]::GetInvalidFileNameChars()
  $safe = $Name
  foreach ($ch in $invalidChars) {
    $safe = $safe.Replace($ch, "_")
  }
  $safe = $safe -replace "\s+", " "
  $safe = $safe.Trim()
  if (-not $safe) { return "item" }
  return $safe
}

if (-not (Test-Path $InputPath)) {
  Write-Error "Input file not found: $InputPath"
  exit 1
}

$inputFull = (Resolve-Path $InputPath).Path

if (-not $OutputPath) {
  $dir = Split-Path $inputFull
  $base = [System.IO.Path]::GetFileNameWithoutExtension($inputFull)
  $OutputPath = Join-Path $dir ($base + "_charts.pptx")
}

$outputFull = [System.IO.Path]::GetFullPath($OutputPath)
$outputDir = Split-Path $outputFull -Parent
if (-not (Test-Path $outputDir)) {
  New-Item -ItemType Directory -Path $outputDir | Out-Null
}

$tempDir = Join-Path ([System.IO.Path]::GetTempPath()) ("summa_ppt_" + [Guid]::NewGuid().ToString("N"))
New-Item -ItemType Directory -Path $tempDir | Out-Null

$excel = $null
$wb = $null
$ppt = $null
$pres = $null

$exported = @()

try {
  $excel = New-Object -ComObject Excel.Application
  $excel.Visible = $false
  $excel.DisplayAlerts = $false
  $wb = $excel.Workbooks.Open($inputFull)

  for ($i = 1; $i -le $wb.Worksheets.Count; $i++) {
    $ws = $wb.Worksheets.Item($i)
    $wsName = [string]$ws.Name

    if ($SheetNames.Count -gt 0 -and ($SheetNames -notcontains $wsName)) {
      continue
    }

    if (-not $IncludeHiddenSheets) {
      try {
        $wsVisible = [int]$ws.Visible
        if ($wsVisible -ne -1) { continue }
      } catch {}
    }

    $chartObjects = $null
    try { $chartObjects = $ws.ChartObjects() } catch { $chartObjects = $null }
    if (-not $chartObjects) { continue }

    $count = 0
    try { $count = [int]$chartObjects.Count } catch { $count = 0 }
    if ($count -lt 1) { continue }

    for ($j = 1; $j -le $count; $j++) {
      $chartObj = $chartObjects.Item($j)
      $chart = $chartObj.Chart

      $chartTitle = ""
      try {
        if ($chart.HasTitle) {
          $chartTitle = [string]$chart.ChartTitle.Text
        }
      } catch {}

      if (-not $chartTitle) { $chartTitle = "$wsName - Grafica $j" }

      $safeWs = Sanitize-FileName $wsName
      $safeTitle = Sanitize-FileName $chartTitle
      $idx = $exported.Count + 1
      $imgName = ("{0:000}_{1}_{2}.png" -f $idx, $safeWs, $safeTitle)
      if ($imgName.Length -gt 200) {
        $imgName = $imgName.Substring(0, 196) + ".png"
      }
      $imgPath = Join-Path $tempDir $imgName

      try {
        $null = $chart.Export($imgPath, "PNG")
      } catch {
        Write-Host "No se pudo exportar la grafica '$chartTitle' (hoja: $wsName). Se omitira."
        continue
      }

      $exported += [PSCustomObject]@{
        Title = $chartTitle
        Sheet = $wsName
        ImagePath = $imgPath
      }
    }
  }

  if ($exported.Count -eq 0) {
    Write-Error "No se encontraron graficas (ChartObjects) en el archivo: $inputFull"
    exit 1
  }

  try {
    $ppt = New-Object -ComObject PowerPoint.Application
  } catch {
    Write-Error "No se pudo iniciar PowerPoint (COM). Verifica que Microsoft PowerPoint este instalado."
    exit 1
  }

  try {
    $ppt.Visible = if ($Visible) { $msoTrue } else { $msoFalse }
  } catch {}

  $pres = $ppt.Presentations.Add()

  $slideIndex = 1
  if (-not $NoTitleSlide) {
    $titleText = if ($Title) { $Title } else { [System.IO.Path]::GetFileNameWithoutExtension($inputFull) }
    $titleSlide = $pres.Slides.Add($slideIndex, $ppLayoutTitle)
    $slideIndex++

    $titleSet = $false
    try {
      $titleSlide.Shapes.Title.TextFrame.TextRange.Text = $titleText
      $titleSet = $true
    } catch {}
    if (-not $titleSet) {
      $tb = $titleSlide.Shapes.AddTextbox($msoTextOrientationHorizontal, 40, 120, 880, 80)
      $tb.TextFrame.TextRange.Text = $titleText
      try { $tb.TextFrame.TextRange.Font.Size = 40 } catch {}
    }

    $subtitleText = "Generado: " + (Get-Date -Format "yyyy-MM-dd HH:mm")
    try {
      $ph2 = $titleSlide.Shapes.Placeholders.Item(2)
      $ph2.TextFrame.TextRange.Text = $subtitleText
    } catch {
      try {
        $st = $titleSlide.Shapes.AddTextbox($msoTextOrientationHorizontal, 40, 210, 880, 30)
        $st.TextFrame.TextRange.Text = $subtitleText
        try { $st.TextFrame.TextRange.Font.Size = 16 } catch {}
      } catch {}
    }
  }

  $slideW = [double]$pres.PageSetup.SlideWidth
  $slideH = [double]$pres.PageSetup.SlideHeight
  $margin = 24
  $titleTop = 12
  $titleH = 44
  $gap = 8

  foreach ($item in $exported) {
    $slide = $pres.Slides.Add($slideIndex, $ppLayoutBlank)
    $slideIndex++

    $titleBox = $slide.Shapes.AddTextbox($msoTextOrientationHorizontal, $margin, $titleTop, $slideW - (2 * $margin), $titleH)
    $titleBox.TextFrame.TextRange.Text = $item.Title
    try { $titleBox.TextFrame.TextRange.Font.Size = 26 } catch {}

    $contentTop = $titleTop + $titleH + $gap
    $availW = $slideW - (2 * $margin)
    $availH = $slideH - $contentTop - $margin

    $pic = $slide.Shapes.AddPicture($item.ImagePath, $msoFalse, $msoTrue, $margin, $contentTop, -1, -1)
    try { $pic.LockAspectRatio = $msoTrue } catch {}

    try {
      $ratioPic = [double]$pic.Width / [double]$pic.Height
      $ratioAvail = [double]$availW / [double]$availH
      if ($ratioPic -gt $ratioAvail) {
        $pic.Width = $availW
      } else {
        $pic.Height = $availH
      }
    } catch {
      $pic.Width = $availW
    }

    try { $pic.Left = ($slideW - $pic.Width) / 2 } catch {}
    try { $pic.Top = $contentTop + (($availH - $pic.Height) / 2) } catch {}

    try {
      $footer = $slide.Shapes.AddTextbox($msoTextOrientationHorizontal, $margin, $slideH - 18, $availW, 14)
      $footer.TextFrame.TextRange.Text = $item.Sheet
      try { $footer.TextFrame.TextRange.Font.Size = 10 } catch {}
    } catch {}
  }

  $pres.SaveAs($outputFull)
  Write-Host "PPT creado: $outputFull"
} finally {
  if ($wb) {
    try { $wb.Close($false) } catch {}
  }
  if ($excel) {
    try { $excel.Quit() } catch {}
  }
  if ($pres) {
    try { $pres.Close() } catch {}
  }
  if ($ppt) {
    try { $ppt.Quit() } catch {}
  }

  foreach ($obj in @($pres, $ppt, $wb, $excel)) {
    if ($obj) {
      try { [System.Runtime.InteropServices.Marshal]::ReleaseComObject($obj) | Out-Null } catch {}
    }
  }

  try {
    [GC]::Collect()
    [GC]::WaitForPendingFinalizers()
  } catch {}

  if (Test-Path $tempDir) {
    try { Remove-Item -Recurse -Force $tempDir } catch {}
  }
}

