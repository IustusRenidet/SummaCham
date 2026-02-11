param(
  [string]$OutputPath = "",
  [string]$Title = "SummaCham / PanelAMCHAM",
  [string]$Subtitle = "Backend técnico y algoritmos (resumen paso a paso)",
  [switch]$Visible
)

$ErrorActionPreference = "Stop"

$msoFalse = 0
$msoTrue = -1
$msoTextOrientationHorizontal = 1

$ppLayoutTitle = 1
$ppLayoutBlank = 12

function Convert-HexToOle {
  param([string]$HexColor)
  if (-not $HexColor) { return $null }
  $hex = $HexColor.Trim().TrimStart("#")
  if ($hex.Length -ne 6) { return $null }
  $r = [Convert]::ToInt32($hex.Substring(0, 2), 16)
  $g = [Convert]::ToInt32($hex.Substring(2, 2), 16)
  $b = [Convert]::ToInt32($hex.Substring(4, 2), 16)
  Add-Type -AssemblyName System.Drawing | Out-Null
  return [System.Drawing.ColorTranslator]::ToOle([System.Drawing.Color]::FromArgb($r, $g, $b))
}

function Safe-JoinLines {
  param([string[]]$Lines)
  $safe = @()
  foreach ($line in ($Lines | Where-Object { $_ -ne $null })) {
    $txt = $line.ToString().TrimEnd()
    if ($txt) { $safe += $txt }
  }
  return ($safe -join "`r`n")
}

function Ensure-Dir {
  param([string]$Path)
  if (-not $Path) { return }
  if (-not (Test-Path $Path)) {
    New-Item -ItemType Directory -Path $Path -Force | Out-Null
  }
}

function Add-TitleSlide {
  param(
    $Pres,
    [string]$TitleText,
    [string]$SubtitleText,
    [string]$ImagePath
  )

  $slide = $Pres.Slides.Add($Pres.Slides.Count + 1, $ppLayoutTitle)
  try {
    $slide.Shapes.Title.TextFrame.TextRange.Text = $TitleText
    $slide.Shapes.Title.TextFrame.TextRange.Font.Size = 44
    $slide.Shapes.Title.TextFrame.TextRange.Font.Bold = $msoTrue
  } catch {}

  try {
    $ph2 = $slide.Shapes.Placeholders.Item(2)
    $ph2.TextFrame.TextRange.Text = $SubtitleText
    $ph2.TextFrame.TextRange.Font.Size = 18
  } catch {
    $w = [double]$Pres.PageSetup.SlideWidth
    $tb = $slide.Shapes.AddTextbox($msoTextOrientationHorizontal, 60, 220, $w - 120, 80)
    $tb.TextFrame.TextRange.Text = $SubtitleText
    $tb.TextFrame.TextRange.Font.Size = 18
  }

  if ($ImagePath -and (Test-Path $ImagePath)) {
    try {
      $w = [double]$Pres.PageSetup.SlideWidth
      $slide.Shapes.AddPicture($ImagePath, $msoFalse, $msoTrue, $w - 170, 22, 120, 120) | Out-Null
    } catch {}
  }

  return $slide
}

function Add-TextSlide {
  param(
    $Pres,
    [string]$TitleText,
    [string[]]$Lines,
    [string[]]$Refs = @(),
    [switch]$Bullets
  )

  $slide = $Pres.Slides.Add($Pres.Slides.Count + 1, $ppLayoutBlank)

  $w = [double]$Pres.PageSetup.SlideWidth
  $h = [double]$Pres.PageSetup.SlideHeight
  $margin = 40
  $titleTop = 18
  $titleH = 46
  $footerH = 18

  $colorTitle = Convert-HexToOle "#0D47A1"
  $colorText = Convert-HexToOle "#111827"
  $colorFooter = Convert-HexToOle "#6B7280"

  $titleBox = $slide.Shapes.AddTextbox($msoTextOrientationHorizontal, $margin, $titleTop, $w - (2 * $margin), $titleH)
  $titleBox.TextFrame.TextRange.Text = $TitleText
  $titleBox.TextFrame.TextRange.Font.Size = 32
  $titleBox.TextFrame.TextRange.Font.Bold = $msoTrue
  if ($colorTitle -ne $null) { $titleBox.TextFrame.TextRange.Font.Color.RGB = $colorTitle }

  $bodyTop = $titleTop + $titleH + 10
  $bodyH = $h - $bodyTop - $footerH - 18
  $bodyBox = $slide.Shapes.AddTextbox($msoTextOrientationHorizontal, $margin, $bodyTop, $w - (2 * $margin), $bodyH)
  $bodyBox.TextFrame.WordWrap = $msoTrue
  $bodyBox.TextFrame.TextRange.Text = (Safe-JoinLines $Lines)
  $bodyBox.TextFrame.TextRange.Font.Size = 18
  if ($colorText -ne $null) { $bodyBox.TextFrame.TextRange.Font.Color.RGB = $colorText }

  if ($Bullets) {
    try {
      $bodyBox.TextFrame.TextRange.ParagraphFormat.Bullet.Visible = $msoTrue
    } catch {}
  }

  if ($Refs -and $Refs.Count -gt 0) {
    $footerText = "Refs: " + (($Refs | Where-Object { $_ }) -join " | ")
    $footer = $slide.Shapes.AddTextbox($msoTextOrientationHorizontal, $margin, $h - $footerH - 8, $w - (2 * $margin), $footerH)
    $footer.TextFrame.TextRange.Text = $footerText
    $footer.TextFrame.TextRange.Font.Size = 10
    if ($colorFooter -ne $null) { $footer.TextFrame.TextRange.Font.Color.RGB = $colorFooter }
  }

  return $slide
}

function Add-TwoColumnSlide {
  param(
    $Pres,
    [string]$TitleText,
    [string[]]$LeftLines,
    [string[]]$RightLines,
    [string[]]$Refs = @(),
    [switch]$Bullets
  )

  $slide = $Pres.Slides.Add($Pres.Slides.Count + 1, $ppLayoutBlank)

  $w = [double]$Pres.PageSetup.SlideWidth
  $h = [double]$Pres.PageSetup.SlideHeight
  $margin = 40
  $titleTop = 18
  $titleH = 46
  $footerH = 18
  $gap = 22

  $colorTitle = Convert-HexToOle "#0D47A1"
  $colorText = Convert-HexToOle "#111827"
  $colorFooter = Convert-HexToOle "#6B7280"

  $titleBox = $slide.Shapes.AddTextbox($msoTextOrientationHorizontal, $margin, $titleTop, $w - (2 * $margin), $titleH)
  $titleBox.TextFrame.TextRange.Text = $TitleText
  $titleBox.TextFrame.TextRange.Font.Size = 32
  $titleBox.TextFrame.TextRange.Font.Bold = $msoTrue
  if ($colorTitle -ne $null) { $titleBox.TextFrame.TextRange.Font.Color.RGB = $colorTitle }

  $bodyTop = $titleTop + $titleH + 10
  $bodyH = $h - $bodyTop - $footerH - 18
  $colW = (($w - (2 * $margin) - $gap) / 2)

  $leftBox = $slide.Shapes.AddTextbox($msoTextOrientationHorizontal, $margin, $bodyTop, $colW, $bodyH)
  $leftBox.TextFrame.WordWrap = $msoTrue
  $leftBox.TextFrame.TextRange.Text = (Safe-JoinLines $LeftLines)
  $leftBox.TextFrame.TextRange.Font.Size = 17
  if ($colorText -ne $null) { $leftBox.TextFrame.TextRange.Font.Color.RGB = $colorText }

  $rightBox = $slide.Shapes.AddTextbox($msoTextOrientationHorizontal, $margin + $colW + $gap, $bodyTop, $colW, $bodyH)
  $rightBox.TextFrame.WordWrap = $msoTrue
  $rightBox.TextFrame.TextRange.Text = (Safe-JoinLines $RightLines)
  $rightBox.TextFrame.TextRange.Font.Size = 17
  if ($colorText -ne $null) { $rightBox.TextFrame.TextRange.Font.Color.RGB = $colorText }

  if ($Bullets) {
    try { $leftBox.TextFrame.TextRange.ParagraphFormat.Bullet.Visible = $msoTrue } catch {}
    try { $rightBox.TextFrame.TextRange.ParagraphFormat.Bullet.Visible = $msoTrue } catch {}
  }

  if ($Refs -and $Refs.Count -gt 0) {
    $footerText = "Refs: " + (($Refs | Where-Object { $_ }) -join " | ")
    $footer = $slide.Shapes.AddTextbox($msoTextOrientationHorizontal, $margin, $h - $footerH - 8, $w - (2 * $margin), $footerH)
    $footer.TextFrame.TextRange.Text = $footerText
    $footer.TextFrame.TextRange.Font.Size = 10
    if ($colorFooter -ne $null) { $footer.TextFrame.TextRange.Font.Color.RGB = $colorFooter }
  }

  return $slide
}

function Add-ArchitectureDiagramSlide {
  param($Pres)

  $slide = Add-TextSlide -Pres $Pres -TitleText "Arquitectura (alto nivel)" -Lines @() -Refs @("main.js", "src/server.js", "src/db/sqlite.js", "src/services/firebirdService.js")

  $w = [double]$Pres.PageSetup.SlideWidth
  $h = [double]$Pres.PageSetup.SlideHeight
  $margin = 40

  $blue = Convert-HexToOle "#0D47A1"
  $light = Convert-HexToOle "#E6F0FF"
  $gray = Convert-HexToOle "#374151"

  $shapeRoundedRect = 5
  $shapeRightArrow = 33

  $top = 140
  $boxW = 260
  $boxH = 86
  $arrowW = 68
  $arrowH = 26

  $ui = $slide.Shapes.AddShape($shapeRoundedRect, $margin, $top, $boxW, $boxH)
  $ui.TextFrame.TextRange.Text = "Electron UI`r`n(vistas/*)"
  $ui.TextFrame.TextRange.Font.Size = 18
  $ui.TextFrame.TextRange.Font.Bold = $msoTrue
  if ($light) { $ui.Fill.ForeColor.RGB = $light }
  if ($blue) { $ui.Line.ForeColor.RGB = $blue }

  $arrow1 = $slide.Shapes.AddShape($shapeRightArrow, $margin + $boxW + 12, $top + 30, $arrowW, $arrowH)
  if ($blue) { $arrow1.Fill.ForeColor.RGB = $blue; $arrow1.Line.ForeColor.RGB = $blue }

  $api = $slide.Shapes.AddShape($shapeRoundedRect, $margin + $boxW + $arrowW + 28, $top, $boxW, $boxH)
  $api.TextFrame.TextRange.Text = "Express API`r`n(src/server.js)"
  $api.TextFrame.TextRange.Font.Size = 18
  $api.TextFrame.TextRange.Font.Bold = $msoTrue
  if ($light) { $api.Fill.ForeColor.RGB = $light }
  if ($blue) { $api.Line.ForeColor.RGB = $blue }

  $arrow2 = $slide.Shapes.AddShape($shapeRightArrow, $margin + (2 * $boxW) + $arrowW + 40, $top + 30, $arrowW, $arrowH)
  if ($blue) { $arrow2.Fill.ForeColor.RGB = $blue; $arrow2.Line.ForeColor.RGB = $blue }

  $dataX = $w - $margin - $boxW
  $sqlite = $slide.Shapes.AddShape($shapeRoundedRect, $dataX, $top - 22, $boxW, 70)
  $sqlite.TextFrame.TextRange.Text = "SQLite`r`n(panel.sqlite)"
  $sqlite.TextFrame.TextRange.Font.Size = 16
  $sqlite.TextFrame.TextRange.Font.Bold = $msoTrue
  if ($light) { $sqlite.Fill.ForeColor.RGB = $light }
  if ($gray) { $sqlite.Line.ForeColor.RGB = $gray }

  $fb = $slide.Shapes.AddShape($shapeRoundedRect, $dataX, $top + 62, $boxW, 70)
  $fb.TextFrame.TextRange.Text = "Firebird (Aspel COI)`r`n(COI*.FDB)"
  $fb.TextFrame.TextRange.Font.Size = 16
  $fb.TextFrame.TextRange.Font.Bold = $msoTrue
  if ($light) { $fb.Fill.ForeColor.RGB = $light }
  if ($gray) { $fb.Line.ForeColor.RGB = $gray }

  $notes = @(
    "1) UI (Electron) sirve HTML/JS desde /vistas y consume /api/*.",
    "2) Express gestiona sesiones/JWT, permisos, workflows y reportes.",
    "3) SQLite: usuarios, permisos, layouts, borradores, comentarios, backups.",
    "4) Firebird: saldos, catálogo de cuentas y presupuestos por ejercicio."
  )
  $textBox = $slide.Shapes.AddTextbox($msoTextOrientationHorizontal, $margin, 260, $w - (2 * $margin), 220)
  $textBox.TextFrame.TextRange.Text = (Safe-JoinLines $notes)
  $textBox.TextFrame.TextRange.Font.Size = 18
  try { $textBox.TextFrame.TextRange.ParagraphFormat.Bullet.Visible = $msoTrue } catch {}

  return $slide
}

function Resolve-AssetPath {
  param(
    [string]$RepoRoot,
    [string]$RelativePath
  )
  if (-not $RepoRoot -or -not $RelativePath) { return "" }
  $candidate = Join-Path $RepoRoot $RelativePath
  if (Test-Path $candidate) { return $candidate }
  return ""
}

function Add-PictureFit {
  param(
    $Slide,
    [string]$ImagePath,
    [double]$Left,
    [double]$Top,
    [double]$MaxWidth,
    [double]$MaxHeight
  )
  if (-not $Slide -or -not $ImagePath -or -not (Test-Path $ImagePath)) {
    return $null
  }

  $pic = $null
  try {
    $pic = $Slide.Shapes.AddPicture($ImagePath, $msoFalse, $msoTrue, $Left, $Top, -1, -1)
  } catch {
    return $null
  }

  try { $pic.LockAspectRatio = $msoTrue } catch {}

  try {
    $ratioPic = [double]$pic.Width / [double]$pic.Height
    $ratioAvail = [double]$MaxWidth / [double]$MaxHeight
    if ($ratioPic -gt $ratioAvail) {
      $pic.Width = $MaxWidth
    } else {
      $pic.Height = $MaxHeight
    }
  } catch {
    try { $pic.Width = $MaxWidth } catch {}
  }

  try { $pic.Left = $Left + (($MaxWidth - $pic.Width) / 2) } catch {}
  try { $pic.Top = $Top + (($MaxHeight - $pic.Height) / 2) } catch {}

  return $pic
}

function Add-SectionSlide {
  param(
    $Pres,
    [string]$TitleText,
    [string]$SubtitleText = ""
  )

  $slide = $Pres.Slides.Add($Pres.Slides.Count + 1, $ppLayoutBlank)
  $w = [double]$Pres.PageSetup.SlideWidth
  $h = [double]$Pres.PageSetup.SlideHeight

  $blue = Convert-HexToOle "#0D47A1"
  $gray = Convert-HexToOle "#374151"

  $box = $slide.Shapes.AddTextbox($msoTextOrientationHorizontal, 60, ($h / 2) - 80, $w - 120, 70)
  $box.TextFrame.TextRange.Text = $TitleText
  $box.TextFrame.TextRange.Font.Size = 48
  $box.TextFrame.TextRange.Font.Bold = $msoTrue
  if ($blue -ne $null) { $box.TextFrame.TextRange.Font.Color.RGB = $blue }
  try { $box.TextFrame.TextRange.ParagraphFormat.Alignment = 2 } catch {} # ppAlignCenter

  if ($SubtitleText) {
    $sub = $slide.Shapes.AddTextbox($msoTextOrientationHorizontal, 90, ($h / 2) - 10, $w - 180, 60)
    $sub.TextFrame.TextRange.Text = $SubtitleText
    $sub.TextFrame.TextRange.Font.Size = 20
    if ($gray -ne $null) { $sub.TextFrame.TextRange.Font.Color.RGB = $gray }
    try { $sub.TextFrame.TextRange.ParagraphFormat.Alignment = 2 } catch {} # center
  }

  return $slide
}

function Add-FullImageSlide {
  param(
    $Pres,
    [string]$TitleText,
    [string]$ImagePath,
    [string[]]$Lines = @(),
    [string[]]$Refs = @()
  )

  $slide = $Pres.Slides.Add($Pres.Slides.Count + 1, $ppLayoutBlank)
  $w = [double]$Pres.PageSetup.SlideWidth
  $h = [double]$Pres.PageSetup.SlideHeight
  $margin = 40
  $titleTop = 18
  $titleH = 46
  $footerH = 18

  $colorTitle = Convert-HexToOle "#0D47A1"
  $colorText = Convert-HexToOle "#111827"
  $colorFooter = Convert-HexToOle "#6B7280"

  $titleBox = $slide.Shapes.AddTextbox($msoTextOrientationHorizontal, $margin, $titleTop, $w - (2 * $margin), $titleH)
  $titleBox.TextFrame.TextRange.Text = $TitleText
  $titleBox.TextFrame.TextRange.Font.Size = 32
  $titleBox.TextFrame.TextRange.Font.Bold = $msoTrue
  if ($colorTitle -ne $null) { $titleBox.TextFrame.TextRange.Font.Color.RGB = $colorTitle }

  $bodyTop = $titleTop + $titleH + 10
  $bodyH = $h - $bodyTop - $footerH - 18

  $hasNotes = $Lines -and $Lines.Count -gt 0
  $notesH = if ($hasNotes) { 120 } else { 0 }
  $imgH = $bodyH - $notesH

  $pic = Add-PictureFit -Slide $slide -ImagePath $ImagePath -Left $margin -Top $bodyTop -MaxWidth ($w - (2 * $margin)) -MaxHeight $imgH
  if (-not $pic) {
    $placeholder = $slide.Shapes.AddTextbox($msoTextOrientationHorizontal, $margin, $bodyTop + 20, $w - (2 * $margin), 80)
    $placeholder.TextFrame.TextRange.Text = "Imagen no disponible: $ImagePath"
    $placeholder.TextFrame.TextRange.Font.Size = 18
    if ($colorText -ne $null) { $placeholder.TextFrame.TextRange.Font.Color.RGB = $colorText }
  }

  if ($hasNotes) {
    $notesTop = $bodyTop + $imgH + 8
    $notesBox = $slide.Shapes.AddTextbox($msoTextOrientationHorizontal, $margin, $notesTop, $w - (2 * $margin), $notesH)
    $notesBox.TextFrame.WordWrap = $msoTrue
    $notesBox.TextFrame.TextRange.Text = (Safe-JoinLines $Lines)
    $notesBox.TextFrame.TextRange.Font.Size = 16
    if ($colorText -ne $null) { $notesBox.TextFrame.TextRange.Font.Color.RGB = $colorText }
    try { $notesBox.TextFrame.TextRange.ParagraphFormat.Bullet.Visible = $msoTrue } catch {}
  }

  if ($Refs -and $Refs.Count -gt 0) {
    $footerText = "Refs: " + (($Refs | Where-Object { $_ }) -join " | ")
    $footer = $slide.Shapes.AddTextbox($msoTextOrientationHorizontal, $margin, $h - $footerH - 8, $w - (2 * $margin), $footerH)
    $footer.TextFrame.TextRange.Text = $footerText
    $footer.TextFrame.TextRange.Font.Size = 10
    if ($colorFooter -ne $null) { $footer.TextFrame.TextRange.Font.Color.RGB = $colorFooter }
  }

  return $slide
}

function Add-ImageWithBulletsSlide {
  param(
    $Pres,
    [string]$TitleText,
    [string[]]$Lines,
    [string]$ImagePath,
    [string[]]$Refs = @()
  )

  $slide = $Pres.Slides.Add($Pres.Slides.Count + 1, $ppLayoutBlank)
  $w = [double]$Pres.PageSetup.SlideWidth
  $h = [double]$Pres.PageSetup.SlideHeight
  $margin = 40
  $titleTop = 18
  $titleH = 46
  $footerH = 18
  $gap = 22

  $colorTitle = Convert-HexToOle "#0D47A1"
  $colorText = Convert-HexToOle "#111827"
  $colorFooter = Convert-HexToOle "#6B7280"

  $titleBox = $slide.Shapes.AddTextbox($msoTextOrientationHorizontal, $margin, $titleTop, $w - (2 * $margin), $titleH)
  $titleBox.TextFrame.TextRange.Text = $TitleText
  $titleBox.TextFrame.TextRange.Font.Size = 32
  $titleBox.TextFrame.TextRange.Font.Bold = $msoTrue
  if ($colorTitle -ne $null) { $titleBox.TextFrame.TextRange.Font.Color.RGB = $colorTitle }

  $bodyTop = $titleTop + $titleH + 10
  $bodyH = $h - $bodyTop - $footerH - 18

  $leftW = [Math]::Floor(($w - (2 * $margin) - $gap) * 0.45)
  $rightW = ($w - (2 * $margin) - $gap) - $leftW

  $leftBox = $slide.Shapes.AddTextbox($msoTextOrientationHorizontal, $margin, $bodyTop, $leftW, $bodyH)
  $leftBox.TextFrame.WordWrap = $msoTrue
  $leftBox.TextFrame.TextRange.Text = (Safe-JoinLines $Lines)
  $leftBox.TextFrame.TextRange.Font.Size = 17
  if ($colorText -ne $null) { $leftBox.TextFrame.TextRange.Font.Color.RGB = $colorText }
  try { $leftBox.TextFrame.TextRange.ParagraphFormat.Bullet.Visible = $msoTrue } catch {}

  $imgLeft = $margin + $leftW + $gap
  $pic = Add-PictureFit -Slide $slide -ImagePath $ImagePath -Left $imgLeft -Top $bodyTop -MaxWidth $rightW -MaxHeight $bodyH
  if (-not $pic) {
    $placeholder = $slide.Shapes.AddTextbox($msoTextOrientationHorizontal, $imgLeft, $bodyTop + 20, $rightW, 80)
    $placeholder.TextFrame.TextRange.Text = "Imagen no disponible:`r`n$ImagePath"
    $placeholder.TextFrame.TextRange.Font.Size = 14
    if ($colorText -ne $null) { $placeholder.TextFrame.TextRange.Font.Color.RGB = $colorText }
  }

  if ($Refs -and $Refs.Count -gt 0) {
    $footerText = "Refs: " + (($Refs | Where-Object { $_ }) -join " | ")
    $footer = $slide.Shapes.AddTextbox($msoTextOrientationHorizontal, $margin, $h - $footerH - 8, $w - (2 * $margin), $footerH)
    $footer.TextFrame.TextRange.Text = $footerText
    $footer.TextFrame.TextRange.Font.Size = 10
    if ($colorFooter -ne $null) { $footer.TextFrame.TextRange.Font.Color.RGB = $colorFooter }
  }

  return $slide
}

function Add-CodeSlide {
  param(
    $Pres,
    [string]$TitleText,
    [string]$Code,
    [string[]]$Notes = @(),
    [string[]]$Refs = @()
  )

  $slide = $Pres.Slides.Add($Pres.Slides.Count + 1, $ppLayoutBlank)
  $w = [double]$Pres.PageSetup.SlideWidth
  $h = [double]$Pres.PageSetup.SlideHeight
  $margin = 40
  $titleTop = 18
  $titleH = 46
  $footerH = 18

  $colorTitle = Convert-HexToOle "#0D47A1"
  $colorText = Convert-HexToOle "#111827"
  $colorFooter = Convert-HexToOle "#6B7280"
  $bg = Convert-HexToOle "#F3F4F6"
  $border = Convert-HexToOle "#E5E7EB"

  $titleBox = $slide.Shapes.AddTextbox($msoTextOrientationHorizontal, $margin, $titleTop, $w - (2 * $margin), $titleH)
  $titleBox.TextFrame.TextRange.Text = $TitleText
  $titleBox.TextFrame.TextRange.Font.Size = 32
  $titleBox.TextFrame.TextRange.Font.Bold = $msoTrue
  if ($colorTitle -ne $null) { $titleBox.TextFrame.TextRange.Font.Color.RGB = $colorTitle }

  $bodyTop = $titleTop + $titleH + 10
  $bodyH = $h - $bodyTop - $footerH - 18

  $hasNotes = $Notes -and $Notes.Count -gt 0
  $notesH = if ($hasNotes) { 130 } else { 0 }
  $codeH = $bodyH - $notesH

  $shapeRect = 1
  $codeBox = $slide.Shapes.AddShape($shapeRect, $margin, $bodyTop, $w - (2 * $margin), $codeH)
  if ($bg -ne $null) { $codeBox.Fill.ForeColor.RGB = $bg }
  if ($border -ne $null) { $codeBox.Line.ForeColor.RGB = $border }
  $codeBox.TextFrame.WordWrap = $msoTrue
  $codeBox.TextFrame.MarginLeft = 12
  $codeBox.TextFrame.MarginRight = 12
  $codeBox.TextFrame.MarginTop = 10
  $codeBox.TextFrame.MarginBottom = 10
  $codeBox.TextFrame.TextRange.Text = ($Code -replace "`n", "`r`n")
  $codeBox.TextFrame.TextRange.Font.Name = "Consolas"
  $codeBox.TextFrame.TextRange.Font.Size = 13
  if ($colorText -ne $null) { $codeBox.TextFrame.TextRange.Font.Color.RGB = $colorText }

  if ($hasNotes) {
    $notesTop = $bodyTop + $codeH + 8
    $notesBox = $slide.Shapes.AddTextbox($msoTextOrientationHorizontal, $margin, $notesTop, $w - (2 * $margin), $notesH)
    $notesBox.TextFrame.WordWrap = $msoTrue
    $notesBox.TextFrame.TextRange.Text = (Safe-JoinLines $Notes)
    $notesBox.TextFrame.TextRange.Font.Size = 16
    if ($colorText -ne $null) { $notesBox.TextFrame.TextRange.Font.Color.RGB = $colorText }
    try { $notesBox.TextFrame.TextRange.ParagraphFormat.Bullet.Visible = $msoTrue } catch {}
  }

  if ($Refs -and $Refs.Count -gt 0) {
    $footerText = "Refs: " + (($Refs | Where-Object { $_ }) -join " | ")
    $footer = $slide.Shapes.AddTextbox($msoTextOrientationHorizontal, $margin, $h - $footerH - 8, $w - (2 * $margin), $footerH)
    $footer.TextFrame.TextRange.Text = $footerText
    $footer.TextFrame.TextRange.Font.Size = 10
    if ($colorFooter -ne $null) { $footer.TextFrame.TextRange.Font.Color.RGB = $colorFooter }
  }

  return $slide
}

function Find-Chrome {
  $candidates = @(
    (Join-Path $env:ProgramFiles "Google\\Chrome\\Application\\chrome.exe"),
    (Join-Path $env:ProgramFiles "Google\\Chrome\\Application\\chrome.exe"),
    (Join-Path ${env:ProgramFiles(x86)} "Google\\Chrome\\Application\\chrome.exe"),
    (Join-Path $env:LocalAppData "Google\\Chrome\\Application\\chrome.exe")
  ) | Where-Object { $_ -and $_.ToString().Trim() -ne "" } | Select-Object -Unique

  foreach ($candidate in $candidates) {
    try {
      if (Test-Path $candidate) {
        return $candidate
      }
    } catch {}
  }
  return $null
}

function Try-CaptureScreenshot {
  param(
    [string]$ChromePath,
    [string]$InputFile,
    [string]$OutputPng,
    [int]$Width = 1440,
    [int]$Height = 900,
    [int]$WaitMs = 5000
  )
  if (-not $ChromePath -or -not (Test-Path $ChromePath)) { return $false }
  if (-not $InputFile -or -not (Test-Path $InputFile)) { return $false }
  if (-not $OutputPng) { return $false }

  Ensure-Dir (Split-Path $OutputPng -Parent)
  if (Test-Path $OutputPng) {
    try { Remove-Item -Force $OutputPng } catch {}
  }
  $file = (Resolve-Path $InputFile).Path
  $uri = (New-Object System.Uri($file)).AbsoluteUri

  $argsCommon = @(
    "--no-first-run",
    "--disable-extensions",
    "--disable-gpu",
    "--hide-scrollbars",
    "--window-size=$Width,$Height",
    "--screenshot=$OutputPng",
    "--allow-file-access-from-files",
    "--virtual-time-budget=$WaitMs",
    $uri
  )

  $tmpErr = Join-Path $env:TEMP ("ppt-chrome-" + [Guid]::NewGuid().ToString("n") + ".log")
  $exit1 = $null
  $prevEap = $ErrorActionPreference
  $ErrorActionPreference = "Continue"
  try {
    & $ChromePath "--headless=new" @argsCommon 2> $tmpErr | Out-Null
    $exit1 = $LASTEXITCODE
  } catch {
    $exit1 = -1
  } finally {
    $ErrorActionPreference = $prevEap
  }
  Start-Sleep -Milliseconds 250
  if (Test-Path $OutputPng) {
    try { Remove-Item -Force $tmpErr } catch {}
    return $true
  }

  $exit2 = $null
  $prevEap = $ErrorActionPreference
  $ErrorActionPreference = "Continue"
  try {
    & $ChromePath "--headless" @argsCommon 2> $tmpErr | Out-Null
    $exit2 = $LASTEXITCODE
  } catch {
    $exit2 = -1
  } finally {
    $ErrorActionPreference = $prevEap
  }
  Start-Sleep -Milliseconds 250
  if (Test-Path $OutputPng) {
    try { Remove-Item -Force $tmpErr } catch {}
    return $true
  }

  $errText = ""
  try { $errText = (Get-Content -Path $tmpErr -Raw -ErrorAction SilentlyContinue) } catch {}
  try { Remove-Item -Force $tmpErr } catch {}
  if ($errText) {
    $short = $errText.Substring(0, [Math]::Min(400, $errText.Length)).Trim()
    Write-Warning ("Chrome screenshot failed (exit new=$exit1 old=$exit2) for $uri :: " + $short)
  } else {
    Write-Warning ("Chrome screenshot failed (exit new=$exit1 old=$exit2) for $uri")
  }
  return $false
}

function New-PptDemoSession {
  param(
    [string]$Usuario = "ICONET",
    [string]$Nombres = "Usuario",
    [string]$ApellidoPrimero = "Demo",
    [string]$ApellidoSegundo = "",
    [string]$Correo = "demo@local",
    [bool]$EsAdminGlobal = $true
  )

  $accionesFull = @{
    "Ver" = $true
    "Cargar y guardar" = $true
    "Revisar" = $true
    "Aprobar" = $true
  }
  $accionesLectura = @{
    "Ver" = $true
    "Cargar y guardar" = $false
    "Revisar" = $false
    "Aprobar" = $false
  }

  $permisosPorEmpresa = @{
    "empresa1" = @{
      "Finanzas" = $accionesFull
      "Gastos Generales" = $accionesFull
      "Gtos Corporativos" = $accionesFull
      "Nomina" = $accionesFull
      "Presupuestos" = $accionesFull
      "RESUMEN" = $accionesLectura
      "Comites" = $accionesLectura
      "Eventos" = $accionesLectura
      "Membresia" = $accionesLectura
      "Comunicacion" = $accionesLectura
    }
    "empresa2" = @{
      "Presupuestos" = $accionesLectura
      "RESUMEN" = $accionesLectura
      "Gastos Generales" = $accionesLectura
    }
  }

  return @{
    usuario = @{
      id = 1
      usuario = $Usuario
      nombres = $Nombres
      apellidoPrimero = $ApellidoPrimero
      apellidoSegundo = $ApellidoSegundo
      correo = $Correo
      esAdminGlobal = $EsAdminGlobal
      permisosGenerales = @{
        puedeAgregar = $true
        puedeModificar = $true
        puedeEliminar = $true
      }
      permisosPorEmpresa = $permisosPorEmpresa
    }
    empresasDisponibles = @(
      @{ id = "empresa1"; nombre = "Ciudad de Mexico"; etiqueta = "E1" },
      @{ id = "empresa2"; nombre = "Guadalajara"; etiqueta = "E2" }
    )
    empresaActiva = @{ id = "empresa1"; nombre = "Ciudad de Mexico"; etiqueta = "E1" }
    tokenAcceso = "ppt-demo-access"
    tokenRefresco = "ppt-demo-refresh"
  }
}

function Write-UiCaptureWrapper {
  param(
    [string]$WrapperPath,
    [string]$TargetPath,
    [hashtable]$SessionObject
  )
  if (-not $WrapperPath) { return $null }
  if (-not $TargetPath) { return $null }

  $sesion = if ($SessionObject) { $SessionObject } else { New-PptDemoSession }
  $json = $sesion | ConvertTo-Json -Depth 20 -Compress

  $html = @"
<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>PPT Capture</title>
    <style>
      html, body { margin: 0; padding: 0; width: 100%; height: 100%; overflow: hidden; background: #ffffff; }
      iframe { position: fixed; inset: 0; width: 100%; height: 100%; border: 0; }
    </style>
  </head>
  <body>
    <iframe id="pptFrame" src="about:blank" loading="eager"></iframe>
    <script>
      (function () {
        try {
          window.PANELAMCHAM_ROUTE_CONFIG = window.PANELAMCHAM_ROUTE_CONFIG || {};
          window.PANELAMCHAM_ROUTE_CONFIG.tours = {
            ...(window.PANELAMCHAM_ROUTE_CONFIG.tours || {}),
            enabled: false,
          };
        } catch (e) {}
        try {
          localStorage.setItem('panelamcham:ppt_capture', '1');
        } catch (e) {}
        try {
          var sesion = $json;
          localStorage.setItem('sesionUsuario', JSON.stringify(sesion));
        } catch (e) {}

        var target = "$TargetPath";
        try {
          var url = new URL(target, window.location.href);
          url.searchParams.set('ppt_capture', '1');
          target = url.toString();
        } catch (e) {}

        try {
          document.getElementById('pptFrame').src = target;
        } catch (e) {}
      })();
    </script>
  </body>
</html>
"@

  Set-Content -Path $WrapperPath -Value $html -Encoding UTF8
  return $WrapperPath
}

function Try-CaptureUiScreenshot {
  param(
    [string]$ChromePath,
    [string]$RepoRoot,
    [string]$TargetHtml,
    [string]$OutputPng,
    [hashtable]$SessionObject,
    [int]$Width = 1440,
    [int]$Height = 900,
    [int]$WaitMs = 7000
  )

  if (-not $RepoRoot) { return $false }
  if (-not $TargetHtml) { return $false }
  if (-not $OutputPng) { return $false }

  $vistasDir = Join-Path $RepoRoot "vistas"
  if (-not (Test-Path $vistasDir)) { return $false }

  $safe = ($TargetHtml -replace "[^a-zA-Z0-9_-]", "_")
  if (-not $safe) { $safe = "page" }
  $wrapperPath = Join-Path $vistasDir ("_ppt_capture_" + $safe + ".html")

  try {
    $null = Write-UiCaptureWrapper -WrapperPath $wrapperPath -TargetPath $TargetHtml -SessionObject $SessionObject
    return (Try-CaptureScreenshot -ChromePath $ChromePath -InputFile $wrapperPath -OutputPng $OutputPng -Width $Width -Height $Height -WaitMs $WaitMs)
  } finally {
    try { Remove-Item -Force $wrapperPath } catch {}
  }
}

function Read-PackageMeta {
  param([string]$RepoRoot)
  $pkgPath = Join-Path $RepoRoot "package.json"
  if (-not (Test-Path $pkgPath)) { return $null }
  try {
    $json = Get-Content $pkgPath -Raw -Encoding UTF8 | ConvertFrom-Json
    return $json
  } catch {
    return $null
  }
}

function Get-NpmDependencyLines {
  param(
    $Pkg,
    [ValidateSet("dependencies", "devDependencies")]
    [string]$Section = "dependencies"
  )

  if (-not $Pkg) { return @() }
  $deps = $Pkg.$Section
  if (-not $deps) { return @() }

  $desc = @{
    "auto-launch" = "Auto-inicio del servicio en SO"
    "bcryptjs" = "Hash de contraseñas (bcrypt)"
    "better-sqlite3" = "SQLite embebido (alta performance)"
    "better-sqlite3-session-store" = "Store de sesiones en SQLite"
    "cookie-parser" = "Lectura/parseo de cookies en Express"
    "csv-parse" = "Parseo CSV (importaciones/exportaciones)"
    "electron-updater" = "Auto-actualizaciones (desktop)"
    "express" = "Servidor HTTP + enrutamiento /api/*"
    "express-session" = "Sesiones server-side (cookie sid)"
    "helmet" = "Hardening de headers HTTP"
    "joi" = "Validación de payloads/params"
    "jsonwebtoken" = "JWT (firmar/verificar access/refresh)"
    "node-firebird" = "Cliente Firebird (Aspel COI)"
    "nodemailer" = "SMTP para notificaciones por correo"
    "xlsx" = "Lectura/escritura Excel (exports)"
    "cross-env" = "Variables de entorno cross-platform"
    "electron" = "Runtime desktop (Chromium + Node)"
    "electron-builder" = "Empaquetado/instaladores (asar, nsis, portable)"
    "electron-rebuild" = "Rebuild módulos nativos para Electron"
    "esbuild" = "Bundling/transpilación (herramienta)"
  }

  $names = @()
  try {
    $names = $deps.PSObject.Properties.Name | Sort-Object
  } catch {
    return @()
  }

  $lines = @()
  foreach ($name in $names) {
    $ver = ""
    try { $ver = [string]$deps.$name } catch { $ver = "" }
    $hint = $desc[$name]
    if ($hint) {
      $lines += ("{0} {1} - {2}" -f $name, $ver, $hint)
    } else {
      $lines += ("{0} {1}" -f $name, $ver)
    }
  }
  return $lines
}

function Get-FrontendCdnDependencyLines {
  param([string]$RepoRoot)
  if (-not $RepoRoot) { return @() }
  $vistasDir = Join-Path $RepoRoot "vistas"
  if (-not (Test-Path $vistasDir)) { return @() }

  $knownDesc = @{
    "bootstrap" = "UI framework (CSS/JS)"
    "bootstrap-icons" = "Iconos para UI"
    "chart.js" = "Gráficas (Canvas)"
    "exceljs" = "Excel (frontend) para exportaciones"
    "xlsx-js-style" = "XLSX con estilos/colores (frontend)"
    "jspdf" = "Exportación a PDF (frontend)"
    "jspdf-autotable" = "Tablas PDF (frontend)"
    "html2canvas" = "Captura DOM -> imagen (frontend)"
  }

  $rxJsDelivr = [regex]"cdn\.jsdelivr\.net\/npm\/(@?[^@\/]+(?:\/[^@\/]+)?)@([^\/]+)\/"
  $rxCdnJs = [regex]"cdnjs\.cloudflare\.com\/ajax\/libs\/([^\/]+)\/([^\/]+)\/"

  $pairs = New-Object "System.Collections.Generic.HashSet[string]"
  $files = Get-ChildItem -Path $vistasDir -Recurse -File -Filter "*.html" -ErrorAction SilentlyContinue
  foreach ($f in $files) {
    $raw = ""
    try { $raw = Get-Content -Path $f.FullName -Raw -Encoding UTF8 -ErrorAction SilentlyContinue } catch { $raw = "" }
    if (-not $raw) { continue }

    foreach ($m in $rxJsDelivr.Matches($raw)) {
      $pkg = $m.Groups[1].Value
      $ver = $m.Groups[2].Value
      if ($pkg -and $ver) { $null = $pairs.Add("$pkg@$ver") }
    }
    foreach ($m in $rxCdnJs.Matches($raw)) {
      $pkg = $m.Groups[1].Value
      $ver = $m.Groups[2].Value
      if ($pkg -and $ver) { $null = $pairs.Add("$pkg@$ver") }
    }
  }

  $list = @($pairs)
  $list = $list | Sort-Object

  $lines = @()
  foreach ($item in $list) {
    $pkg = $item
    $ver = ""
    if ($item -match "^(.*)@([^@]+)$") {
      $pkg = $Matches[1]
      $ver = $Matches[2]
    }

    $key = $pkg
    if ($key.StartsWith("@")) {
      # scopes: usar solo el nombre del paquete para el hint si aplica
      $parts = $key.Split("/")
      if ($parts.Length -ge 2) { $key = $parts[1] }
    }

    $hint = $knownDesc[$key]
    if ($hint) {
      $lines += ("{0} {1} - {2}" -f $pkg, $ver, $hint)
    } else {
      $lines += ("{0} {1}" -f $pkg, $ver)
    }
  }

  return $lines
}

function Get-EnvVarsUsed {
  param([string]$RepoRoot)
  if (-not $RepoRoot) { return @() }
  $paths = @()
  $mainPath = Join-Path $RepoRoot "main.js"
  if (Test-Path $mainPath) { $paths += $mainPath }
  $srcDir = Join-Path $RepoRoot "src"
  if (Test-Path $srcDir) {
    $paths += (Get-ChildItem -Path $srcDir -Recurse -File -Filter "*.js" -ErrorAction SilentlyContinue | Select-Object -ExpandProperty FullName)
  }

  $rx = [regex]"process\.env\.([A-Za-z0-9_]+)"
  $set = New-Object "System.Collections.Generic.HashSet[string]"
  foreach ($p in $paths) {
    $raw = ""
    try { $raw = Get-Content -Path $p -Raw -Encoding UTF8 -ErrorAction SilentlyContinue } catch { $raw = "" }
    if (-not $raw) { continue }
    foreach ($m in $rx.Matches($raw)) {
      $name = $m.Groups[1].Value
      if ($name) { $null = $set.Add($name) }
    }
  }
  return (@($set) | Sort-Object)
}

function Chunk-Array {
  param(
    [object[]]$Items,
    [int]$Size = 18
  )
  if (-not $Items -or $Items.Count -le 0) { return @() }
  $chunks = @()
  for ($i = 0; $i -lt $Items.Count; $i += $Size) {
    $end = [Math]::Min($i + $Size - 1, $Items.Count - 1)
    $slice = @()
    if ($end -ge $i) {
      $slice = @($Items[$i..$end])
    }
    $chunks += ,$slice
  }
  return $chunks
}

function Get-ApiInventory {
  param([string]$RepoRoot)
  if (-not $RepoRoot) { return $null }
  $serverPath = Join-Path $RepoRoot "src\\server.js"
  if (-not (Test-Path $serverPath)) { return $null }

  $content = ""
  try { $content = Get-Content -Path $serverPath -Raw -Encoding UTF8 } catch { $content = "" }
  if (-not $content) { return $null }

  $rxRequire = [regex]'const\s+([A-Za-z0-9_]+)\s*=\s*require\(\s*[''"]\.\/routes\/([^''"]+)[''"]\s*\)'
  $rxUse = [regex]'app\.use\(\s*[''"]([^''"]+)[''"]\s*,\s*([A-Za-z0-9_]+)\s*\)'
  $rxAppEndpoint = [regex]'app\.(get|post|put|patch|delete)\(\s*[''"]([^''"]+)[''"]'

  $varToModule = @{}
  foreach ($m in $rxRequire.Matches($content)) {
    $varToModule[$m.Groups[1].Value] = $m.Groups[2].Value
  }

  $moduleToBases = @{}
  foreach ($m in $rxUse.Matches($content)) {
    $base = $m.Groups[1].Value
    $varName = $m.Groups[2].Value
    if (-not $varToModule.ContainsKey($varName)) { continue }
    $mod = $varToModule[$varName]
    if (-not $moduleToBases.ContainsKey($mod)) { $moduleToBases[$mod] = @() }
    $moduleToBases[$mod] += $base
  }

  $serverEndpoints = @()
  foreach ($m in $rxAppEndpoint.Matches($content)) {
    $method = $m.Groups[1].Value.ToUpperInvariant()
    $path = $m.Groups[2].Value
    if ($path -and $path.StartsWith("/api")) {
      $serverEndpoints += ("{0} {1}" -f $method, $path)
    }
  }
  $serverEndpoints = $serverEndpoints | Sort-Object -Unique

  $routers = @()
  foreach ($mod in ($moduleToBases.Keys | Sort-Object)) {
    $bases = @($moduleToBases[$mod] | Sort-Object -Unique)
    $file = Join-Path $RepoRoot ("src\\routes\\{0}.js" -f $mod)
    if (-not (Test-Path $file)) { continue }

    $raw = ""
    try { $raw = Get-Content -Path $file -Raw -Encoding UTF8 } catch { $raw = "" }
    if (-not $raw) { continue }

    $authRouterLevel = $false
    try { $authRouterLevel = ($raw -match "router\.use\(\s*requireAuth") } catch { $authRouterLevel = $false }
    $authPerRoute = $false
    try { $authPerRoute = ($raw -match "requireAuth") } catch { $authPerRoute = $false }
    $adminGlobal = $false
    try { $adminGlobal = ($raw -match "requireAdminGlobal") } catch { $adminGlobal = $false }

    $authMode = if ($authRouterLevel) { "requireAuth (router)" } elseif ($authPerRoute) { "requireAuth (por ruta)" } else { "público" }
    if ($adminGlobal) { $authMode = $authMode + " + requireAdminGlobal" }

    $rxRouter = [regex]'router\.(get|post|put|patch|delete)\(\s*[''"]([^''"]+)[''"]'
    $endpoints = @()
    foreach ($m in $rxRouter.Matches($raw)) {
      $method = $m.Groups[1].Value.ToUpperInvariant()
      $path = $m.Groups[2].Value
      if (-not $path) { continue }
      $endpoints += ("{0} {1}" -f $method, $path)
    }
    $endpoints = $endpoints | Sort-Object -Unique

    $rel = $file.Replace($RepoRoot, "").TrimStart("\\/")
    $routers += [pscustomobject]@{
      module = $mod
      fileRel = $rel
      bases = $bases
      auth = $authMode
      endpoints = $endpoints
    }
  }

  return [pscustomobject]@{
    serverEndpoints = $serverEndpoints
    routers = $routers
  }
}

$repoRoot = Split-Path $PSScriptRoot -Parent
$pkg = Read-PackageMeta -RepoRoot $repoRoot
$version = if ($pkg -and $pkg.version) { [string]$pkg.version } else { "" }
$product = if ($pkg -and $pkg.name) { [string]$pkg.name } else { "SummaCham" }

$docsDir = Join-Path $repoRoot "docs"
Ensure-Dir $docsDir

if (-not $OutputPath) {
  $OutputPath = Join-Path $docsDir "Presentacion_Tecnica_Backend_SummaCham.pptx"
}

$outputFull = [System.IO.Path]::GetFullPath($OutputPath)
Ensure-Dir (Split-Path $outputFull -Parent)
if (Test-Path $outputFull) {
  Remove-Item -Force $outputFull
}

$iconPath = Join-Path $repoRoot "icono\\amcham.png"
$fecha = Get-Date -Format "yyyy-MM-dd HH:mm"
$subtitleFull = "$Subtitle`r`n$fecha" + ($(if ($version) { "`r`nVersion: $version" } else { "" }))

$ppt = $null
$pres = $null

try {
  $ppt = New-Object -ComObject PowerPoint.Application
  try { $ppt.Visible = if ($Visible) { $msoTrue } else { $msoFalse } } catch {}
  $pres = $ppt.Presentations.Add()

  # ---- Slides (DETAILED) ----
  Add-TitleSlide -Pres $pres -TitleText $Title -SubtitleText $subtitleFull -ImagePath $iconPath | Out-Null

  $null = Add-TextSlide -Pres $pres -TitleText "Agenda" -Bullets -Lines @(
    "Arquitectura (UI <-> API <-> datos)",
    "Servidor Express (CORS, sesiones, middleware)",
    "Seguridad: autenticación (JWT/sesión) + autorización (permisos)",
    "Persistencia: SQLite (modelo + backups)",
    "Integración Firebird (Aspel COI)",
    "Algoritmos: contabilización y acumulados (Real vs Plan)",
    "Layouts + fórmulas + reportes Summary/Resumen",
    "Colaboración (borradores, comentarios, notificaciones)",
    "Operación (diagnóstico y checklist)"
  ) -Refs @("README.md")

  Add-ArchitectureDiagramSlide -Pres $pres | Out-Null

  $null = Add-FullImageSlide -Pres $pres -TitleText "Arquitectura general (diagrama)" `
    -ImagePath (Resolve-AssetPath -RepoRoot $repoRoot -RelativePath "docs/image/diagrams/arquitectura-general.png") `
    -Lines @(
      "Electron arranca backend + UI.",
      "Express expone /api/* y sirve /vistas/*.",
      "SQLite: usuarios/permisos/layouts/borradores/backups.",
      "Firebird: saldos/cuentas/presupuestos (Aspel COI)."
    ) `
    -Refs @("docs/image/diagrams/arquitectura-general.png")

  $null = Add-FullImageSlide -Pres $pres -TitleText "Flujo general de uso (diagrama)" `
    -ImagePath (Resolve-AssetPath -RepoRoot $repoRoot -RelativePath "docs/image/diagrams/flujo-general-uso.png") `
    -Lines @(
      "Login -> sesión -> empresa activa -> módulos.",
      "Edición -> revisión/aprobación -> guardado.",
      "Reportes: layouts + datos COI."
    ) `
    -Refs @("docs/image/diagrams/flujo-general-uso.png")

  $null = Add-TextSlide -Pres $pres -TitleText "Tecnologías clave" -Bullets -Lines @(
    "Electron (app escritorio) + Express (API HTTP)",
    "SQLite (better-sqlite3) para persistencia local multi-usuario",
    "Firebird (node-firebird) para datos Aspel COI: SALDOS/CUENTAS/CATCTA/PRESUP",
    "Seguridad: helmet, express-session, bcrypt, JWT (access/refresh)",
    "Reportes/exportación: xlsx + generación de gráficas en Excel (COM)"
  ) -Refs @("package.json", "main.js", "src/server.js")

  Add-SectionSlide -Pres $pres -TitleText "Stack y dependencias" -SubtitleText "Tecnologías, librerías y configuración" | Out-Null

  $npmRuntime = Get-NpmDependencyLines -Pkg $pkg -Section "dependencies"
  if ($npmRuntime -and $npmRuntime.Count -gt 0) {
    $null = Add-TextSlide -Pres $pres -TitleText "Librerías backend (NPM runtime)" -Bullets -Lines $npmRuntime -Refs @("package.json")
  }

  $npmDev = Get-NpmDependencyLines -Pkg $pkg -Section "devDependencies"
  if ($npmDev -and $npmDev.Count -gt 0) {
    $null = Add-TextSlide -Pres $pres -TitleText "Librerías build/dev (NPM)" -Bullets -Lines $npmDev -Refs @("package.json")
  }

  $cdnDeps = Get-FrontendCdnDependencyLines -RepoRoot $repoRoot
  if ($cdnDeps -and $cdnDeps.Count -gt 0) {
    $null = Add-TextSlide -Pres $pres -TitleText "Librerías frontend (CDN en vistas/*.html)" -Bullets -Lines ($cdnDeps + @("Nota: al cargar desde CDN se requiere acceso a internet; en app empaquetada puede sustituirse por recursos locales.")) -Refs @("vistas/*.html")
  }

  $envVars = Get-EnvVarsUsed -RepoRoot $repoRoot
  if ($envVars -and $envVars.Count -gt 0) {
    $envDesc = @{
      "NODE_ENV" = "development|production (controla cookies, logs, CSP, etc.)"
      "SERVER_PORT" = "Puerto del backend (Electron lo usa para cargar http://localhost:<PORT>)"
      "PORT" = "Puerto alterno (fallback en server.js)"
      "PANELAMCHAM_DATA_DIR" = "Directorio de datos (panel.sqlite, backups, config)"
      "PANELAMCHAM_SEED_DB" = "Ruta opcional a DB semilla panel.sqlite"
      "PANELAMCHAM_ALLOW_ORIGINS" = "Allowlist CORS (incluye origin null/file://)"
      "COOKIE_DOMAIN" = "Dominio de cookie (túnel HTTPS)"
      "PANELAMCHAM_JWT_SECRET" = "Secreto JWT (access)"
      "PANELAMCHAM_REFRESH_SECRET" = "Secreto JWT (refresh)"
      "SESSION_SECRET" = "Secreto de sesión (express-session)"
      "PANELAMCHAM_ACCESS_TTL" = "TTL access token (ej. 1h)"
      "PANELAMCHAM_REFRESH_TTL" = "TTL refresh token (ej. 7d)"
      "FIREBIRD_HOST" = "Host Firebird"
      "FIREBIRD_PORT" = "Puerto Firebird (default 3050)"
      "FIREBIRD_USER" = "Usuario Firebird (sysdba)"
      "FIREBIRD_PASSWORD" = "Password Firebird"
      "BACKUP_ENABLED" = "Habilitar backups automáticos (true/false)"
      "BACKUP_INTERVAL_MINUTES" = "Intervalo backups"
      "BACKUP_MAX_BACKUPS" = "Retención backups"
      "BACKUP_PATH" = "Directorio destino backups (opcional)"
      "SMTP_HOST" = "Servidor SMTP (notificaciones)"
      "SMTP_PORT" = "Puerto SMTP"
      "SMTP_SECURE" = "SMTP TLS (true/false)"
      "SMTP_USER" = "Usuario SMTP"
      "SMTP_PASS" = "Password SMTP"
      "SMTP_FROM" = "Remitente SMTP"
      "ASPEL_COI_BASE" = "Base path COI / referencias"
      "SEED_OPERACIONES" = "Seeding de operaciones predefinidas"
      "ICONET_PASSWORD" = "Password inicial seed (solo despliegues controlados)"
      "PANELAMCHAM_ADMIN_PASSWORD" = "Password inicial admin seed (solo despliegues controlados)"
      "SystemRoot" = "Windows: ruta base del sistema (resuelve powershell.exe)"
    }

    $envLines = @()
    foreach ($name in $envVars) {
      $hint = $envDesc[$name]
      if ($hint) { $envLines += ("{0} - {1}" -f $name, $hint) } else { $envLines += $name }
    }

    $chunks = Chunk-Array -Items $envLines -Size 18
    $idx = 1
    foreach ($chunk in $chunks) {
      $titleEnv = if ($chunks.Count -gt 1) { "Variables de entorno (inventario) - parte $idx/$($chunks.Count)" } else { "Variables de entorno (inventario)" }
      $null = Add-TextSlide -Pres $pres -TitleText $titleEnv -Bullets -Lines $chunk -Refs @("main.js", "src/config/env-config.js", "src/server.js", "src/utils/secretsManager.js")
      $idx += 1
    }
  }

  $null = Add-TextSlide -Pres $pres -TitleText "Estructura del proyecto (carpetas)" -Bullets -Lines @(
    "main.js: proceso principal Electron (secretos, entorno, arranque del backend)",
    "src/server.js: servidor Express (middlewares, estáticos, routers)",
    "src/routes/*: endpoints /api/* por dominio (auth, usuarios, layouts, reportes...)",
    "src/services/*: lógica de negocio (Firebird, reportes, layouts, backups...)",
    "src/db/sqlite.js: esquema + migraciones + seeding (panel.sqlite)",
    "vistas/*: UI (HTML/CSS/JS) servida como estático por Express"
  ) -Refs @("main.js", "src/server.js", "src/db/sqlite.js")

  $null = Add-TextSlide -Pres $pres -TitleText "Arranque (paso a paso)" -Lines @(
    "1) Electron calcula PANELAMCHAM_DATA_DIR (userData/appData/datos).",
    "2) SecretsManager genera/carga .env.secrets (JWT/SESSION/REFRESH).",
    "3) env-config carga .env.development/.env.production y defaults.",
    "4) Inicia Express (src/server.js) y el servicio de backups.",
    "5) Crea ventana + tray y carga http://localhost:PORT."
  ) -Refs @("main.js", "src/utils/secretsManager.js", "src/config/env-config.js", "src/server.js")

  $null = Add-TextSlide -Pres $pres -TitleText "Configuración y secretos" -Lines @(
    "1) .env.* define host/puerto Firebird y puerto del servidor (SERVER_PORT/PORT).",
    "2) En Electron, secretos se guardan en userData/.env.secrets (permiso 600).",
    "3) server.js valida que PANELAMCHAM_JWT_SECRET y SESSION_SECRET no sean defaults.",
    "4) En producción (no Electron), falta de secretos lanza error para evitar arranque inseguro."
  ) -Refs @("src/config/env-config.js", "src/utils/secretsManager.js", "src/server.js")

  $null = Add-TextSlide -Pres $pres -TitleText "Servidor Express: middleware y estáticos" -Lines @(
    "1) trust proxy=1 para túneles HTTPS (ngrok/cloudflare).",
    "2) CORS por allowlist (incluye origin null/file:// para Electron).",
    "3) Sesiones: express-session + store SQLite (better-sqlite3-session-store).",
    "4) Cookies: httpOnly, rolling, maxAge 30 min; sameSite/secure según NODE_ENV.",
    "5) helmet activo (CSP deshabilitado por compatibilidad con UI).",
    "6) / sirve app.html solo con sesión; si no, redirige a login.html."
  ) -Refs @("src/server.js")

  $null = Add-TwoColumnSlide -Pres $pres -TitleText "API: routers principales (/api/*)" -Bullets `
    -LeftLines @(
      "auth: login/refresh/logout",
      "usuarios: CRUD + permisos",
      "empresas/modulos: catálogos",
      "presupuestos: workflow + lectura",
      "planeacion: datos por cuenta",
      "layouts/layoutRoutes: plantillas por año/capítulo"
    ) `
    -RightLines @(
      "reportes: summary/resumen + excel",
      "borradores: autosave + historial",
      "comentarios/notificaciones: colaboración",
      "saldos/cuentas: consultas Firebird",
      "backups: listar/restaurar SQLite",
      "firebird-config/graficas-config: configuración"
    ) `
    -Refs @("src/server.js", "src/routes/*")

  $null = Add-TextSlide -Pres $pres -TitleText "Interfaces (UI) y comunicación" -Lines @(
    "1) Express sirve /vistas como archivos estáticos (sin caché en dev).",
    "2) UI consume JSON con fetch a /api/* (credenciales habilitadas).",
    "3) Root / redirige a login si no existe req.session.usuario.",
    "4) Headers usados: X-Usuario-Actual, X-Empresa-Activa, Authorization."
  ) -Refs @("src/server.js", "vistas/*")

  $null = Add-CodeSlide -Pres $pres -TitleText "UI -> API: ejemplo de request autenticado (fetch)" -Code @"
// Base (Electron): http://localhost:3005
const API_BASE = 'http://localhost:3005/api';

// sesion.js arma headers estándar
const headers = {
  'Content-Type': 'application/json',
  ...Sesion.headersAutenticacion(), // Authorization + X-Empresa-Activa
};

const res = await fetch(`${API_BASE}/usuarios`, {
  method: 'GET',
  headers,
  credentials: 'include', // envía cookie panelamcham.sid / tokenAcceso si existe
});

if (res.status === 401) {
  // Patrón típico: cerrar sesión y redirigir
  Sesion.cerrar();
}

const data = await res.json();
"@ -Notes @(
    "Backend (requireAuth) valida en orden: sesión -> cookie tokenAcceso -> Authorization: Bearer.",
    "CORS permite credenciales y orígenes en allowlist (incluye origin null/file:// para Electron)."
  ) -Refs @("vistas/js/sesion.js", "src/middleware/auth.js", "src/server.js")

  $chrome = Find-Chrome
  $screensDir = Join-Path $docsDir "screenshots"
  Ensure-Dir $screensDir
  $loginShot = Join-Path $screensDir "ui-login.png"
  $loginHtml = Join-Path $repoRoot "vistas\\login.html"
  $null = Try-CaptureScreenshot -ChromePath $chrome -InputFile $loginHtml -OutputPng $loginShot
  $demoSesion = New-PptDemoSession

  $null = Add-ImageWithBulletsSlide -Pres $pres -TitleText "UI: Login (captura)" `
    -Lines @(
      "POST /api/auth/login -> recibe tokens + sesión (usuario, empresaActiva, permisosPorEmpresa).",
      "La UI guarda sesión en localStorage (sesionUsuario) y redirige a app.html.",
      "En file://, API_BASE apunta a http://localhost:3005/api."
    ) `
    -ImagePath $loginShot `
    -Refs @("vistas/login.html", "vistas/js/sesion.js", "src/routes/auth.js")

  $appShot = Join-Path $screensDir "ui-app.png"
  $null = Try-CaptureUiScreenshot -ChromePath $chrome -RepoRoot $repoRoot -TargetHtml "app.html" -OutputPng $appShot -SessionObject $demoSesion -WaitMs 9000
  $null = Add-FullImageSlide -Pres $pres -TitleText "UI: Panel principal (captura)" `
    -ImagePath $appShot `
    -Lines @(
      "Valida sesión de forma sincrónica (localStorage) antes de mostrar contenido.",
      "Sidebar agrupa módulos y habilita accesos según permisos del usuario.",
      "La empresa activa se envía en X-Empresa-Activa en cada request."
    ) `
    -Refs @("vistas/app.html", "vistas/js/sesion.js")

  $null = Add-FullImageSlide -Pres $pres -TitleText "UI: RESUMEN (captura)" `
    -ImagePath (Resolve-AssetPath -RepoRoot $repoRoot -RelativePath "vistas/image/RESUMEN/1766515017701.png") `
    -Lines @(
      "Renderiza árbol de secciones + totales (mes/YTD).",
      "Fuente: layouts (SQLite) + COI (Firebird) vía /api/reportes/*."
    ) `
    -Refs @("vistas/RESUMEN.html", "src/routes/reportes.js")

  $null = Add-FullImageSlide -Pres $pres -TitleText "UI: Gestor de plantillas (captura)" `
    -ImagePath (Resolve-AssetPath -RepoRoot $repoRoot -RelativePath "image/GUIA_MEJORAS_GESTOR_PLANTILLAS/1767350803401.png") `
    -Lines @(
      "Administra layout_cuentas/layout_secciones/layout_operaciones por empresa+módulo+año+capítulo.",
      "Base para reportes, overlays y fórmulas."
    ) `
    -Refs @("vistas/plantillas.html", "src/routes/layoutRoutes.js", "src/services/layoutService.js")

  $null = Add-TextSlide -Pres $pres -TitleText "Autenticación: login (paso a paso)" -Lines @(
    "1) POST /api/auth/login valida payload (Joi) y aplica rate-limit por IP.",
    "2) Busca usuario en SQLite (tabla usuarios) y verifica bcrypt hash.",
    "3) Construye sesión: permisos_modulo -> mapa por empresa/módulo.",
    "4) Selecciona empresa activa y prueba conexión Firebird (probarConexion).",
    "5) Emite JWT (access/refresh) y guarda sesión (req.session.userId)."
  ) -Refs @("src/routes/auth.js", "src/middleware/auth.js", "src/db/sqlite.js")

  $null = Add-ImageWithBulletsSlide -Pres $pres -TitleText "API Auth: POST /api/auth/login (flujo)" `
    -Lines @(
      "Entrada: { usuario, contrasena }",
      "Salida: { usuario, empresaActiva, empresasDisponibles, tokenAcceso, tokenRefresco }",
      "Side-effects: cookie tokenAcceso + req.session.userId + registro de intentos fallidos."
    ) `
    -ImagePath (Resolve-AssetPath -RepoRoot $repoRoot -RelativePath "docs/image/flows-api/flow-api-auth_js-post-_login.png") `
    -Refs @("src/routes/auth.js", "docs/image/flows-api/flow-api-auth_js-post-_login.png")

  $null = Add-CodeSlide -Pres $pres -TitleText "Ejemplo: login (request/response)" -Code @"
POST /api/auth/login
Content-Type: application/json

{ \"usuario\": \"ICONET\", \"contrasena\": \"********\" }

200 OK
{
  \"usuario\": {
    \"id\": 1,
    \"usuario\": \"ICONET\",
    \"esAdminGlobal\": true,
    \"permisosGenerales\": { \"puedeAgregar\": true, \"puedeModificar\": true, \"puedeEliminar\": true },
    \"permisosPorEmpresa\": { /* empresa1 -> modulos -> acciones */ }
  },
  \"empresaActiva\": { \"id\": \"empresa1\", \"nombre\": \"Ciudad de México\" },
  \"tokenAcceso\": \"eyJ...\",\n  \"tokenRefresco\": \"eyJ...\"
}
"@ -Notes @(
    "El backend usa bcrypt para validar contraseña y JWT para firmar tokens.",
    "La UI guarda sesión completa en localStorage (sesionUsuario)."
  ) -Refs @("src/routes/auth.js", "vistas/js/sesion.js")

  $null = Add-FullImageSlide -Pres $pres -TitleText "API Auth: POST /api/auth/refresh (flujo)" `
    -ImagePath (Resolve-AssetPath -RepoRoot $repoRoot -RelativePath "docs/image/flows-api/flow-api-auth_js-post-_refresh.png") `
    -Lines @(
      "Entrada: tokenRefresco (body/header).",
      "Salida: nuevos tokens + sesión refrescada."
    ) `
    -Refs @("src/routes/auth.js", "docs/image/flows-api/flow-api-auth_js-post-_refresh.png")

  $null = Add-FullImageSlide -Pres $pres -TitleText "API Auth: POST /api/auth/logout (flujo)" `
    -ImagePath (Resolve-AssetPath -RepoRoot $repoRoot -RelativePath "docs/image/flows-api/flow-api-auth_js-post-_logout.png") `
    -Lines @(
      "Destruye sesión server-side y limpia cookies (panelamcham.sid, tokenAcceso)."
    ) `
    -Refs @("src/routes/auth.js", "docs/image/flows-api/flow-api-auth_js-post-_logout.png")

  $null = Add-TextSlide -Pres $pres -TitleText "Sesiones + JWT (requireAuth)" -Lines @(
    "1) Extrae token en este orden: sesión -> cookie tokenAcceso -> Authorization: Bearer.",
    "2) Si sesión: carga usuario por id (SQLite) y construye contexto.",
    "3) Si JWT: verifica firma/exp y carga usuario por sub.",
    "4) Adjunta req.usuarioActual, req.esAdmin, req.mapaPermisos.",
    "5) Refresh: POST /api/auth/refresh valida refresh token y renueva sesión."
  ) -Refs @("src/middleware/auth.js", "src/routes/auth.js")

  $null = Add-FullImageSlide -Pres $pres -TitleText "UI: Sesión (requerirSesion + headersAutenticacion)" `
    -ImagePath (Resolve-AssetPath -RepoRoot $repoRoot -RelativePath "docs/image/flows-js/flow-ui-sesion_js.png") `
    -Lines @(
      "requerirSesion(): si no hay tokenAcceso en localStorage -> redirige a login.html.",
      "headersAutenticacion(): agrega Authorization: Bearer <token> y X-Empresa-Activa."
    ) `
    -Refs @("vistas/js/sesion.js", "docs/image/flows-js/flow-ui-sesion_js.png")

  $null = Add-TextSlide -Pres $pres -TitleText "Permisos y autorización" -Lines @(
    "1) Roles: admin global (incluye usuario ICONET) vs usuarios con permisos parciales.",
    "2) Permisos por empresa/módulo en SQLite: permisos_modulo (Ver/Cargar/Revisar/Aprobar).",
    "3) Normalización: empresaId tipo EMPRESA01 -> empresa1; módulos se normalizan (acentos/espacios).",
    "4) TienePermisoModulo resuelve acción; algunos módulos pueden tratarse como universales en lectura.",
    "5) Gestor de plantillas usa permisos_edicion_capitulo para edición granular por capítulo."
  ) -Refs @("src/middleware/auth.js", "src/routes/usuarios.js", "src/db/sqlite.js", "src/config/modulos.js")

  $null = Add-CodeSlide -Pres $pres -TitleText "Ejemplo: permisosPorEmpresa (estructura en sesión UI)" -Code @"
permisosPorEmpresa: {
  \"empresa1\": {
    \"Finanzas\": { \"Ver\": true, \"Cargar y guardar\": true, \"Revisar\": false, \"Aprobar\": false },
    \"RESUMEN\":  { \"Ver\": true, \"Cargar y guardar\": false, \"Revisar\": false, \"Aprobar\": false }
  },
  \"empresa2\": { /* ... */ }
}
"@ -Notes @(
    "El backend persiste estos permisos como filas (permisos_modulo) y los agrupa al construir sesión."
  ) -Refs @("src/services/permisosService.js", "src/routes/auth.js")

  $null = Add-FullImageSlide -Pres $pres -TitleText "permisosService (flujo)" `
    -ImagePath (Resolve-AssetPath -RepoRoot $repoRoot -RelativePath "docs/image/flows-services/flow-service-permisosservice_js.png") `
    -Lines @(
      "Convierte filas de permisos_modulo -> mapa { empresaId -> modulo -> acciones }."
    ) `
    -Refs @("src/services/permisosService.js", "docs/image/flows-services/flow-service-permisosservice_js.png")

  $null = Add-TextSlide -Pres $pres -TitleText "API Perfil: lectura + cambio de contraseña" -Lines @(
    "1) Router /api/perfil aplica requireAuth (sesión server-side o JWT).",
    "2) GET /api/perfil consulta tabla usuarios y agrega permisosPorEmpresa desde permisos_modulo.",
    "3) PATCH /api/perfil/password valida con Joi y verifica contrasenaActual con bcrypt.",
    "4) El backend nunca devuelve hashes; solo confirma éxito o error."
  ) -Refs @("src/routes/perfil.js", "src/middleware/auth.js")

  $perfilShot = Join-Path $screensDir "ui-perfil.png"
  $null = Try-CaptureUiScreenshot -ChromePath $chrome -RepoRoot $repoRoot -TargetHtml "perfil.html" -OutputPng $perfilShot -SessionObject $demoSesion -WaitMs 8000
  $null = Add-FullImageSlide -Pres $pres -TitleText "UI: Perfil (permisos y password) (captura)" `
    -ImagePath $perfilShot `
    -Lines @(
      "Muestra permisos generales y permisos por empresa del usuario activo.",
      "Permite actualizar contraseña (PATCH /api/perfil/password).",
      "Si falla la API, usa datos almacenados en la sesión (fallback)."
    ) `
    -Refs @("vistas/perfil.html", "src/routes/perfil.js", "vistas/js/sesion.js")

  $null = Add-TextSlide -Pres $pres -TitleText "Rate-limit de login (auth.js)" -Bullets -Lines @(
    "Ventana: 10 min; máximo: 10 intentos; bloqueo: 5 min.",
    "Clave: IP (x-forwarded-for o req.ip).",
    "Implementación in-memory (Map) -> reinicia con el proceso.",
    "Respuesta típica: 429 cuando está bloqueada."
  ) -Refs @("src/routes/auth.js")

  $null = Add-FullImageSlide -Pres $pres -TitleText "API Usuarios: GET /api/usuarios (flujo)" `
    -ImagePath (Resolve-AssetPath -RepoRoot $repoRoot -RelativePath "docs/image/flows-api/flow-api-usuarios_js-get-.png") `
    -Lines @(
      "Protegido: requireAuth + permisos de administración de usuarios.",
      "Devuelve lista + permisosPorEmpresa agregados."
    ) `
    -Refs @("src/routes/usuarios.js", "docs/image/flows-api/flow-api-usuarios_js-get-.png")

  $null = Add-FullImageSlide -Pres $pres -TitleText "API Usuarios: POST /api/usuarios (flujo)" `
    -ImagePath (Resolve-AssetPath -RepoRoot $repoRoot -RelativePath "docs/image/flows-api/flow-api-usuarios_js-post-.png") `
    -Lines @(
      "Valida payload (Joi).",
      "Hash de contraseña (bcrypt).",
      "Inserta usuario + persiste permisos en permisos_modulo."
    ) `
    -Refs @("src/routes/usuarios.js", "docs/image/flows-api/flow-api-usuarios_js-post-.png")

  $null = Add-FullImageSlide -Pres $pres -TitleText "API Usuarios: PUT /api/usuarios/:id (flujo)" `
    -ImagePath (Resolve-AssetPath -RepoRoot $repoRoot -RelativePath "docs/image/flows-api/flow-api-usuarios_js-put-_id.png") `
    -Lines @(
      "Protege ICONET (no permitir modificar por terceros).",
      "Permite actualizar permisos y rotar contraseña (opcional)."
    ) `
    -Refs @("src/routes/usuarios.js", "docs/image/flows-api/flow-api-usuarios_js-put-_id.png")

  $null = Add-CodeSlide -Pres $pres -TitleText "Ejemplo: crear usuario (payload mínimo)" -Code @"
POST /api/usuarios
{
  \"usuario\": \"ANALISTA01\",
  \"nombres\": \"Ana\",\n  \"apellidoPrimero\": \"Pérez\",\n  \"apellidoSegundo\": \"\",\n  \"correo\": \"ana@example.com\",
  \"contrasena\": \"********\",
  \"esAdminGlobal\": false,
  \"permisosGenerales\": { \"puedeAgregar\": false, \"puedeModificar\": false, \"puedeEliminar\": false },
  \"permisos\": {
    \"empresa1\": { \"Finanzas\": { \"Ver\": true, \"Cargar y guardar\": false, \"Revisar\": false, \"Aprobar\": false } }
  }
}
"@ -Notes @(
    "Regla: si hay permisos de acción (Cargar/Revisar/Aprobar), el backend fuerza Ver/Lectura."
  ) -Refs @("src/routes/usuarios.js")

  $usuariosShot = Join-Path $screensDir "ui-usuarios.png"
  $null = Try-CaptureUiScreenshot -ChromePath $chrome -RepoRoot $repoRoot -TargetHtml "usuarios.html" -OutputPng $usuariosShot -SessionObject $demoSesion -WaitMs 8000
  $null = Add-FullImageSlide -Pres $pres -TitleText "UI: Administración de usuarios (captura)" `
    -ImagePath $usuariosShot `
    -Lines @(
      "Acceso restringido: requiere admin global o permisosGenerales completos.",
      "Lista usuarios y muestra empresas activas (badges) según permisos por empresa.",
      "Acciones: editar (crear_usuario.html?editar=id) y eliminar (DELETE /api/usuarios/:id)."
    ) `
    -Refs @("vistas/usuarios.html", "vistas/crear_usuario.html", "src/routes/usuarios.js")

  $crearUsuarioShot = Join-Path $screensDir "ui-crear-usuario.png"
  $null = Try-CaptureUiScreenshot -ChromePath $chrome -RepoRoot $repoRoot -TargetHtml "crear_usuario.html" -OutputPng $crearUsuarioShot -SessionObject $demoSesion -WaitMs 8000
  $null = Add-FullImageSlide -Pres $pres -TitleText "UI: Crear/editar usuario (captura)" `
    -ImagePath $crearUsuarioShot `
    -Lines @(
      "Formulario valida usuario/correo/contraseña y construye permisos por empresa+módulo.",
      "Modo editar: carga usuario por id y permite rotar contraseña (opcional).",
      "Persistencia: usuarios + permisos_modulo (y permisosGenerales)."
    ) `
    -Refs @("vistas/crear_usuario.html", "src/routes/usuarios.js")

  $null = Add-TextSlide -Pres $pres -TitleText "SQLite: modelo de datos (tablas clave)" -Bullets -Lines @(
    "usuarios (bcrypt hash, flags admin + permisos generales)",
    "permisos_modulo + permisos_edicion_capitulo",
    "presupuestos_estado + presupuestos_estado_historial",
    "presupuestos_guardados + PLAN_BORRADORES(+ historial)",
    "layout_cuentas / layout_operaciones / layout_secciones + layout_bitacora",
    "comentarios_celdas + notificaciones + graficas_config",
    "Sesiones: store better-sqlite3-session-store (cookie panelamcham.sid)"
  ) -Refs @("src/db/sqlite.js", "src/server.js")

  $null = Add-TextSlide -Pres $pres -TitleText "SQLite: concurrencia + backups" -Lines @(
    "1) DB en modo WAL + busy_timeout para soportar multi-usuario.",
    "2) BackupService copia panel.sqlite a <dataDir>/backups con timestamp y checksum SHA256.",
    "3) Retención: conserva los últimos N backups (por default 24).",
    "4) Restore: crea .bak de seguridad y reemplaza la DB activa."
  ) -Refs @("src/db/sqlite.js", "src/services/backupService.js")

  $null = Add-FullImageSlide -Pres $pres -TitleText "BackupService (flujo)" `
    -ImagePath (Resolve-AssetPath -RepoRoot $repoRoot -RelativePath "docs/image/flows-services/flow-service-backupservice_js.png") `
    -Lines @(
      "Se inicializa al arrancar el servidor (intervalo/retención configurables).",
      "Backup inicial + backups periódicos.",
      "Verifica integridad por tamaño + checksum."
    ) `
    -Refs @("src/services/backupService.js", "docs/image/flows-services/flow-service-backupservice_js.png")

  $null = Add-TextSlide -Pres $pres -TitleText "Firebird (Aspel COI): conexión y configuración" -Lines @(
    "1) firebirdService crea opciones base (host/port/user/pass) desde firebirdConfigService.",
    "2) Detecta remoto vs local y ajusta timeouts/reintentos.",
    "3) Por empresa: resuelve ruta .FDB (config/empresas + overrides) y hace attach por consulta.",
    "4) Ejecuta SQL con parámetros y registra queries lentas (>2s).",
    "5) /api/firebird-config permite a admin global ajustar host y rutas por empresa."
  ) -Refs @("src/services/firebirdService.js", "src/services/firebirdConfigService.js", "src/config/empresas.js", "src/routes/firebird-config.js")

  $null = Add-FullImageSlide -Pres $pres -TitleText "COI: modelo simplificado (referencia)" `
    -ImagePath (Resolve-AssetPath -RepoRoot $repoRoot -RelativePath "docs/image/diagrams/modelo-coi-simplificado.png") `
    -Lines @(
      "Tablas por ejercicio: SALDOSyy, CUENTASyy, CATCTAyy, PRESUPyy.",
      "Estructura de cuenta: segmentos + nivel (1..4) para agregación."
    ) `
    -Refs @("docs/image/diagrams/modelo-coi-simplificado.png")

  $null = Add-FullImageSlide -Pres $pres -TitleText "firebirdService (flujo)" `
    -ImagePath (Resolve-AssetPath -RepoRoot $repoRoot -RelativePath "docs/image/flows-services/flow-service-firebirdservice_js.png") `
    -Lines @(
      "attach -> query -> detach por operación.",
      "Timeouts y retry para conexión remota.",
      "Log de queries lentas (>2s)."
    ) `
    -Refs @("src/services/firebirdService.js", "docs/image/flows-services/flow-service-firebirdservice_js.png")

  $null = Add-FullImageSlide -Pres $pres -TitleText "API Firebird-config: GET /api/firebird-config (flujo)" `
    -ImagePath (Resolve-AssetPath -RepoRoot $repoRoot -RelativePath "docs/image/flows-api/flow-api-firebird-config_js-get-.png") `
    -Lines @(
      "Solo admin global.",
      "Devuelve config base + overrides por empresa + ruta del archivo de config."
    ) `
    -Refs @("src/routes/firebird-config.js", "docs/image/flows-api/flow-api-firebird-config_js-get-.png")

  $firebirdConfigShot = Join-Path $screensDir "ui-firebird-config.png"
  $null = Try-CaptureUiScreenshot -ChromePath $chrome -RepoRoot $repoRoot -TargetHtml "firebird-config.html" -OutputPng $firebirdConfigShot -SessionObject $demoSesion -WaitMs 8000
  $null = Add-FullImageSlide -Pres $pres -TitleText "UI: Firebird-config (captura)" `
    -ImagePath $firebirdConfigShot `
    -Lines @(
      "Permite ver host/puerto/usuario y rutas .FDB por empresa.",
      "Edición restringida a admin global (seguridad operacional).",
      "Guarda overrides sin tocar código (POST/PUT /api/firebird-config)."
    ) `
    -Refs @("vistas/firebird-config.html", "src/routes/firebird-config.js")

  $null = Add-TextSlide -Pres $pres -TitleText "Empresas y rutas COI*.FDB (paso a paso)" -Lines @(
    "1) Se lista COIxx.xx en la instalación de Aspel y se ordena por versión.",
    "2) Para cada empresa (1..4), se busca el .FDB existente de la versión más alta.",
    "3) Empresas comparativas (9..12) usan rutas conocidas + fallback por versión.",
    "4) Firebird-config puede sobreescribir rutas por empresa sin tocar el código."
  ) -Refs @("src/config/empresas.js", "src/routes/firebird-config.js")

  $null = Add-TextSlide -Pres $pres -TitleText "Contabilización: normalización y cálculo (algoritmo)" -Lines @(
    "1) Normaliza cuenta al formato canónico Aspel (21 chars) + nivel deducido.",
    "2) Determina naturaleza (D/A) por prefijo o campo NATURALEZA.",
    "3) Lee SALDOSyy: CARGOm/ABONOm y acumulados (sumatoria hasta periodo).",
    "4) Calcula REAL: si D -> cargos - abonos; si A -> abonos - cargos.",
    "5) Lee PRESUPyy y calcula presupuesto mensual + YTD (suma PRESUP01..PRESUPmm)."
  ) -Refs @("src/services/planeacionCuentasService.js", "src/services/saldosService.js")

  $null = Add-FullImageSlide -Pres $pres -TitleText "Flujo: datos reales vs presupuesto (diagrama)" `
    -ImagePath (Resolve-AssetPath -RepoRoot $repoRoot -RelativePath "docs/image/diagrams/flujo-datos-reales-presupuestos.png") `
    -Lines @(
      "Real: SALDOS (cargos/abonos) + naturaleza -> signo final.",
      "Plan: PRESUP (mensual) + sumatoria -> YTD."
    ) `
    -Refs @("docs/image/diagrams/flujo-datos-reales-presupuestos.png")

  $null = Add-FullImageSlide -Pres $pres -TitleText "planeacionCuentasService (flujo)" `
    -ImagePath (Resolve-AssetPath -RepoRoot $repoRoot -RelativePath "docs/image/flows-services/flow-service-planeacioncuentasservice_js.png") `
    -Lines @(
      "Normaliza lista de cuentas.",
      "Consulta Firebird: CUENTASyy + SALDOSyy + PRESUPyy.",
      "Devuelve Real/Plan/Anterior por mes y acumulado."
    ) `
    -Refs @("src/services/planeacionCuentasService.js", "docs/image/flows-services/flow-service-planeacioncuentasservice_js.png")

  $null = Add-CodeSlide -Pres $pres -TitleText "Ejemplo: cálculo de Real (naturaleza D/A)" -Code @"
Si NATZ = 'D' (deudora):
  REAL_MES = CARGO_MES - ABONO_MES
  REAL_YTD = CARGOS_ACUM - ABONOS_ACUM

Si NATZ = 'A' (acreedora):
  REAL_MES = ABONO_MES - CARGO_MES
  REAL_YTD = ABONOS_ACUM - CARGOS_ACUM
"@ -Notes @(
    "Esto evita signos invertidos al sumar ingresos y restar gastos."
  ) -Refs @("src/services/planeacionCuentasService.js")

  $null = Add-TextSlide -Pres $pres -TitleText "Presupuestos: workflow de autorización" -Lines @(
    "1) Estado se guarda por empresa/módulo/año/capítulo en SQLite (presupuestos_estado).",
    "2) Transiciones: cargar -> editar, revisar -> revisado, autorizar -> aprobado, guardar -> guardado.",
    "3) Cada acción requiere permiso (Cargar y guardar / Revisar / Aprobar).",
    "4) Historial se registra en presupuestos_estado_historial (últimos eventos).",
    "5) Se disparan notificaciones del workflow (notificacionesService)."
  ) -Refs @("src/routes/presupuestos.js", "src/db/sqlite.js", "src/services/notificacionesService.js")

  $presupuestosShot = Join-Path $screensDir "ui-presupuestos.png"
  $null = Try-CaptureUiScreenshot -ChromePath $chrome -RepoRoot $repoRoot -TargetHtml "Presupuestos.html" -OutputPng $presupuestosShot -SessionObject $demoSesion -WaitMs 11000
  $null = Add-FullImageSlide -Pres $pres -TitleText "UI: Presupuestos (captura)" `
    -ImagePath $presupuestosShot `
    -Lines @(
      "Vista comparativa Plan vs Real por mes + acumulados; tabla con encabezados sticky.",
      "Acciones de workflow se habilitan por estado + permisos (Revisar/Aprobar).",
      "Exporta a Excel/PDF y soporta comentarios por celda."
    ) `
    -Refs @("vistas/Presupuestos.html", "src/routes/presupuestos.js", "vistas/js/flujo-autorizacion.js")

  $null = Add-FullImageSlide -Pres $pres -TitleText "UI: flujo de autorización (referencia)" `
    -ImagePath (Resolve-AssetPath -RepoRoot $repoRoot -RelativePath "docs/image/flows-js/flow-ui-flujo-autorizacion_js.png") `
    -Lines @(
      "El front controla botones/acciones según estado y permisos.",
      "El backend valida transiciones y registra historial."
    ) `
    -Refs @("vistas/js/presupuesto-vista.js", "docs/image/flows-js/flow-ui-flujo-autorizacion_js.png")

  $null = Add-FullImageSlide -Pres $pres -TitleText "API Presupuestos: GET /estado (flujo)" `
    -ImagePath (Resolve-AssetPath -RepoRoot $repoRoot -RelativePath "docs/image/flows-api/flow-api-presupuestos_js-get-_estado.png") `
    -Lines @(
      "Devuelve estado actual + historial reciente (últimos 10)."
    ) `
    -Refs @("src/routes/presupuestos.js", "docs/image/flows-api/flow-api-presupuestos_js-get-_estado.png")

  $null = Add-FullImageSlide -Pres $pres -TitleText "API Presupuestos: POST /estado (transición) (flujo)" `
    -ImagePath (Resolve-AssetPath -RepoRoot $repoRoot -RelativePath "docs/image/flows-api/flow-api-presupuestos_js-post-_estado.png") `
    -Lines @(
      "Valida transición + verifica permiso requerido por acción.",
      "Actualiza presupuestos_estado y agrega fila a presupuestos_estado_historial."
    ) `
    -Refs @("src/routes/presupuestos.js", "docs/image/flows-api/flow-api-presupuestos_js-post-_estado.png")

  $null = Add-TextSlide -Pres $pres -TitleText "SummaryService: resumen por cuentas (algoritmo)" -Lines @(
    "1) Recibe empresa/año/periodo + lista de códigos de cuenta.",
    "2) Consulta SALDOS con SELECT construido (saldosResumenHelper) para mes y YTD.",
    "3) En paralelo, trae presupuesto por cuentas (PRESUPyy) para año actual y comparativo.",
    "4) Calcula: mesActual, mesPlan, mesAnterior, acumulados (Actual/Plan/Anterior).",
    "5) Devuelve payload listo para UI: detalle + totales por ejercicio."
  ) -Refs @("src/services/summaryService.js", "src/services/saldosResumenHelper.js", "src/services/planeacionCuentasService.js")

  $null = Add-FullImageSlide -Pres $pres -TitleText "SummaryService (flujo)" `
    -ImagePath (Resolve-AssetPath -RepoRoot $repoRoot -RelativePath "docs/image/flows-services/flow-service-summaryservice_js.png") `
    -Lines @(
      "Construye consultas por ejercicio (actual y comparativo).",
      "Enlaza presupuesto (PRESUPyy) para mes y acumulado.",
      "Devuelve { detalle, ejercicios, ejerciciosDisponibles }."
    ) `
    -Refs @("src/services/summaryService.js", "docs/image/flows-services/flow-service-summaryservice_js.png")

  $null = Add-TextSlide -Pres $pres -TitleText "Reportes Summary/Resumen: motor unificado" -Lines @(
    "1) planeacionReportesEngine carga layouts por módulo/capítulo desde SQLite.",
    "2) Normaliza cuentas y arma secciones (principal/secundaria) para UI.",
    "3) Llama obtenerDatosPlaneacionResumen para traer Real/Plan/Anterior por cuenta.",
    "4) Calcula totales por sección y aplica factores/operaciones (incluye fórmulas).",
    "5) Retorna JSON: detalle (árbol con children) + resumen (totales)."
  ) -Refs @("src/services/reportes/planeacionReportesEngine.js", "src/services/layoutService.js", "src/services/planeacionCuentasService.js", "src/routes/reportes.js")

  $null = Add-FullImageSlide -Pres $pres -TitleText "API Reportes: GET /api/reportes/summary (flujo)" `
    -ImagePath (Resolve-AssetPath -RepoRoot $repoRoot -RelativePath "docs/image/flows-api/flow-api-reportes_js-get-_summary.png") `
    -Lines @(
      "Protegido por requireAuth + permiso de empresa + permiso de módulo.",
      "Devuelve JSON listo para UI (detalle + resumen)."
    ) `
    -Refs @("src/routes/reportes.js", "docs/image/flows-api/flow-api-reportes_js-get-_summary.png")

  $null = Add-FullImageSlide -Pres $pres -TitleText "API Reportes: GET /api/reportes/resumen (flujo)" `
    -ImagePath (Resolve-AssetPath -RepoRoot $repoRoot -RelativePath "docs/image/flows-api/flow-api-reportes_js-get-_resumen.png") `
    -Lines @(
      "Mismo motor unificado; cambia reportKey a RESUMEN."
    ) `
    -Refs @("src/routes/reportes.js", "docs/image/flows-api/flow-api-reportes_js-get-_resumen.png")

  $null = Add-TextSlide -Pres $pres -TitleText "Layouts + fórmulas (Gestor de plantillas)" -Lines @(
    "1) layout_cuentas define catálogo de cuentas por empresa/módulo/año/capítulo.",
    "2) layout_secciones define jerarquía de secciones y orden.",
    "3) layout_operaciones define operaciones (sumas) + orden/visible + formula_json.",
    "4) formula_json se parsea a formula_terms y signos para evaluar operaciones por secciones.",
    "5) layout_bitacora registra cambios (quién/cuándo/qué) para auditoría."
  ) -Refs @("src/db/sqlite.js", "src/services/layoutService.js", "src/routes/layoutRoutes.js")

  $null = Add-FullImageSlide -Pres $pres -TitleText "layoutService (flujo)" `
    -ImagePath (Resolve-AssetPath -RepoRoot $repoRoot -RelativePath "docs/image/flows-services/flow-service-layoutservice_js.png") `
    -Lines @(
      "Lee layout_* desde SQLite y reconstruye operaciones/secciones.",
      "Parsea formula_json a formula_terms y signos (+1/-1).",
      "Ordena por orden_presentacion/orden y respeta visible."
    ) `
    -Refs @("src/services/layoutService.js", "docs/image/flows-services/flow-service-layoutservice_js.png")

  $null = Add-FullImageSlide -Pres $pres -TitleText "UI: Formula Builder (flujo)" `
    -ImagePath (Resolve-AssetPath -RepoRoot $repoRoot -RelativePath "docs/image/flows-js/flow-ui-formula-builder_js.png") `
    -Lines @(
      "Define términos: section / account / operation / constant.",
      "Guarda como formula_terms y/o formula_json para persistencia."
    ) `
    -Refs @("vistas/js/formula-builder.js", "docs/image/flows-js/flow-ui-formula-builder_js.png")

  $null = Add-CodeSlide -Pres $pres -TitleText "Ejemplo: formula_terms (JSON)" -Code @"
[\n  { \"operator\": \"+\", \"type\": \"section\", \"value\": \"INGRESOS\" },\n  { \"operator\": \"-\", \"type\": \"section\", \"value\": \"GASTOS\" },\n  { \"operator\": \"+\", \"type\": \"constant\", \"constant\": 1000 }\n]
"@ -Notes @(
    "El backend usa estos términos para sumar/restar secciones al generar reportes."
  ) -Refs @("vistas/js/formula-builder.js", "src/services/layoutService.js")

  $null = Add-TextSlide -Pres $pres -TitleText "Borradores, comentarios y notificaciones" -Lines @(
    "1) PLAN_BORRADORES guarda capturas parciales por empresa/módulo/año/capítulo.",
    "2) PLAN_BORRADORES_HISTORIAL almacena versiones recientes para recuperar cambios.",
    "3) comentarios_celdas permite notas por celda (colaboración y revisión).",
    "4) notificaciones registra eventos (workflow, avisos) por usuario.",
    "5) Endpoints: /api/borradores, /api/comentarios, /api/notificaciones."
  ) -Refs @("src/db/sqlite.js", "src/routes/borradores.js", "src/routes/comentarios.js", "src/routes/notificaciones.js")

  $null = Add-FullImageSlide -Pres $pres -TitleText "BorradoresService (flujo)" `
    -ImagePath (Resolve-AssetPath -RepoRoot $repoRoot -RelativePath "docs/image/flows-services/flow-service-borradoresservice_js.png") `
    -Lines @(
      "Guarda autosave por empresa+módulo+año+capítulo.",
      "Permite historial para recuperación de cambios."
    ) `
    -Refs @("src/services/borradoresService.js", "docs/image/flows-services/flow-service-borradoresservice_js.png")

  $null = Add-FullImageSlide -Pres $pres -TitleText "ComentariosService (flujo)" `
    -ImagePath (Resolve-AssetPath -RepoRoot $repoRoot -RelativePath "docs/image/flows-services/flow-service-comentariosservice_js.png") `
    -Lines @(
      "CRUD de comentarios por celda (celda_id) + contexto (empresa/módulo/año/capítulo)."
    ) `
    -Refs @("src/services/comentariosService.js", "docs/image/flows-services/flow-service-comentariosservice_js.png")

  $null = Add-FullImageSlide -Pres $pres -TitleText "NotificacionesService (flujo)" `
    -ImagePath (Resolve-AssetPath -RepoRoot $repoRoot -RelativePath "docs/image/flows-services/flow-service-notificacionesservice_js.png") `
    -Lines @(
      "Registra avisos por usuario (workflow, mensajes informativos).",
      "La UI consume /api/notificaciones para mostrar pendientes."
    ) `
    -Refs @("src/services/notificacionesService.js", "docs/image/flows-services/flow-service-notificacionesservice_js.png")

  $null = Add-TextSlide -Pres $pres -TitleText "Graficas-config: configuración persistida" -Lines @(
    "1) Tabla graficas_config guarda JSON por empresa (config_json).",
    "2) GET /api/graficas-config devuelve config para la empresa activa (X-Empresa-Activa).",
    "3) POST /api/graficas-config requiere admin y hace upsert por empresa.",
    "4) UI usa esta config para etiquetas/colores en gráficas, PDF y Excel."
  ) -Refs @("src/routes/graficas-config.js", "src/db/sqlite.js", "vistas/graficas-config.html")

  $graficasCfgShot = Join-Path $screensDir "ui-graficas-config.png"
  $null = Try-CaptureUiScreenshot -ChromePath $chrome -RepoRoot $repoRoot -TargetHtml "graficas-config.html" -OutputPng $graficasCfgShot -SessionObject $demoSesion -WaitMs 9000
  $null = Add-FullImageSlide -Pres $pres -TitleText "UI: Gestor de graficas (captura)" `
    -ImagePath $graficasCfgShot `
    -Lines @(
      "Permite ajustar etiquetas/colores y activar series.",
      "Edición protegida por req.esAdmin (backend) y UI deshabilita campos si no es admin.",
      "Los cambios aplican a la vista de gráficas y exportaciones."
    ) `
    -Refs @("vistas/graficas-config.html", "src/routes/graficas-config.js")

  $null = Add-TextSlide -Pres $pres -TitleText "Exportaciones: Excel y gráficas" -Lines @(
    "1) /api/reportes/* expone reportes JSON y generación de Excel (native/JSON).",
    "2) Generación de gráficas usa Excel COM (scripts/export-*-charts.ps1).",
    "3) Exportaciones operativas/resumen usan servicios en src/services/reportes/*.",
    "4) Scripts disponibles: npm run ppt:from-excel (imágenes de gráficas -> PPT)."
  ) -Refs @("src/routes/reportes.js", "scripts/export-operativo-charts.ps1", "scripts/export-resumen-charts.ps1")

  Add-SectionSlide -Pres $pres -TitleText "Anexo: API (por dominio)" -SubtitleText "Diagramas de flujo y comportamiento" | Out-Null

  $null = Add-FullImageSlide -Pres $pres -TitleText "API Empresas: GET /api/empresas (flujo)" `
    -ImagePath (Resolve-AssetPath -RepoRoot $repoRoot -RelativePath "docs/image/flows-api/flow-api-empresas_js-get-.png") `
    -Lines @(
      "Protegido por requireAuth.",
      "Devuelve catálogo de empresas y metadata (id/nombre/etiqueta).",
      "La UI usa empresaActiva (X-Empresa-Activa) para consultas Firebird."
    ) `
    -Refs @("src/routes/empresas.js", "docs/image/flows-api/flow-api-empresas_js-get-.png")

  $null = Add-FullImageSlide -Pres $pres -TitleText "API Módulos: POST /api/modulos/summary-resumen-e (flujo)" `
    -ImagePath (Resolve-AssetPath -RepoRoot $repoRoot -RelativePath "docs/image/flows-api/flow-api-modulos_js-post-_summary-resumen-e.png") `
    -Lines @(
      "Valida: empresaId/anio/periodo/codigos.",
      "Combina Real (Firebird SALDOSyy) + Plan (Firebird PRESUPyy) + comparativo.",
      "Retorna detalle listo para tablas y gráficas (mes/YTD)."
    ) `
    -Refs @("src/routes/modulos.js", "src/services/summaryService.js", "docs/image/flows-api/flow-api-modulos_js-post-_summary-resumen-e.png")

  $null = Add-FullImageSlide -Pres $pres -TitleText "API Planeación: POST /api/planeacion/cuentas (flujo)" `
    -ImagePath (Resolve-AssetPath -RepoRoot $repoRoot -RelativePath "docs/image/flows-api/flow-api-planeacion_js-post-_cuentas.png") `
    -Lines @(
      "Recibe lista de cuentas y devuelve planeación/presupuesto por cuenta.",
      "Protegido por requireAuth + permiso de empresa.",
      "Se usa como base para RESUMEN/SUMMARY y vistas por módulo."
    ) `
    -Refs @("src/routes/planeacion.js", "src/services/planeacionCuentasService.js", "docs/image/flows-api/flow-api-planeacion_js-post-_cuentas.png")

  $null = Add-FullImageSlide -Pres $pres -TitleText "API Saldos: GET /api/saldos (flujo)" `
    -ImagePath (Resolve-AssetPath -RepoRoot $repoRoot -RelativePath "docs/image/flows-api/flow-api-saldos_js-get-.png") `
    -Lines @(
      "Consulta saldos por cuentas (Firebird SALDOSyy) para una empresa+ejercicio.",
      "Respuesta incluye meses y estructura lista para serie temporal.",
      "Usado en módulos de análisis y validación de datos."
    ) `
    -Refs @("src/routes/saldos.js", "src/services/saldosService.js", "docs/image/flows-api/flow-api-saldos_js-get-.png")

  $null = Add-FullImageSlide -Pres $pres -TitleText "API Comités: GET /api/comites/movimientos (flujo)" `
    -ImagePath (Resolve-AssetPath -RepoRoot $repoRoot -RelativePath "docs/image/flows-api/flow-api-comitesroutes_js-get-_movimientos.png") `
    -Lines @(
      "Devuelve movimientos/meses para cuentas seleccionadas.",
      "Valida empresaId/anio/cuentas y aplica requireAuth.",
      "Se usa para análisis de comités y dashboards."
    ) `
    -Refs @("src/routes/comitesRoutes.js", "src/services/comitesService.js", "docs/image/flows-api/flow-api-comitesroutes_js-get-_movimientos.png")

  $null = Add-FullImageSlide -Pres $pres -TitleText "API Backups: POST /api/backups/restore (flujo)" `
    -ImagePath (Resolve-AssetPath -RepoRoot $repoRoot -RelativePath "docs/image/flows-api/flow-api-backups_js-post-_restore.png") `
    -Lines @(
      "Restaura un backup de panel.sqlite.",
      "Antes de restaurar crea copia de seguridad (.bak).",
      "Requiere auth; usado para recuperación ante corrupción o rollback."
    ) `
    -Refs @("src/routes/backups.js", "src/services/backupService.js", "docs/image/flows-api/flow-api-backups_js-post-_restore.png")

  $null = Add-FullImageSlide -Pres $pres -TitleText "API Firebird-config: GET /api/firebird-config (flujo)" `
    -ImagePath (Resolve-AssetPath -RepoRoot $repoRoot -RelativePath "docs/image/flows-api/flow-api-firebird-config_js-get-.png") `
    -Lines @(
      "Requiere admin global.",
      "Devuelve config base (host/port/user) + overrides por empresa.",
      "UI permite ajustar rutas FDB por empresa y probar conexión."
    ) `
    -Refs @("src/routes/firebird-config.js", "src/services/firebirdConfigService.js", "docs/image/flows-api/flow-api-firebird-config_js-get-.png")

  $null = Add-FullImageSlide -Pres $pres -TitleText "API Gráficas-config: POST /api/graficas-config (flujo)" `
    -ImagePath (Resolve-AssetPath -RepoRoot $repoRoot -RelativePath "docs/image/flows-api/flow-api-graficas-config_js-post-.png") `
    -Lines @(
      "Guarda configuración JSON por empresa (colores/series/gráficas).",
      "Upsert en SQLite (tabla graficas_config).",
      "Impacta UI de gráficas, PDF y exportaciones Excel."
    ) `
    -Refs @("src/routes/graficas-config.js", "src/db/sqlite.js", "docs/image/flows-api/flow-api-graficas-config_js-post-.png")

  $null = Add-FullImageSlide -Pres $pres -TitleText "API Inserción: POST /api/insercion/validar (flujo)" `
    -ImagePath (Resolve-AssetPath -RepoRoot $repoRoot -RelativePath "docs/image/flows-api/flow-api-insercion_js-post-_validar.png") `
    -Lines @(
      "Valida jerarquía (SUMMARY/RESUMEN/MÓDULOS) y evita duplicados.",
      "Valida formato de cuenta (21 dígitos vs XXX-XXX-XXX-XX).",
      "Se usa antes de insertar cuentas/secciones/operaciones."
    ) `
    -Refs @("src/routes/insercion.js", "docs/image/flows-api/flow-api-insercion_js-post-_validar.png")

  $null = Add-FullImageSlide -Pres $pres -TitleText "API Estructura: POST /api/cuentas/agregar (flujo)" `
    -ImagePath (Resolve-AssetPath -RepoRoot $repoRoot -RelativePath "docs/image/flows-api/flow-api-estructuraroutes_js-post-_cuentas_agregar.png") `
    -Lines @(
      "Permite modificar estructura SUMMARY/RESUMEN almacenada como JSON (layoutConfigStore).",
      "Protegido por requireAuth; valida campos mínimos antes de persistir.",
      "Usado por herramientas administrativas de estructura."
    ) `
    -Refs @("src/routes/estructuraRoutes.js", "src/services/layoutConfigStore.js", "docs/image/flows-api/flow-api-estructuraroutes_js-post-_cuentas_agregar.png")

  $null = Add-FullImageSlide -Pres $pres -TitleText "API Comentarios: POST /api/comentarios (flujo)" `
    -ImagePath (Resolve-AssetPath -RepoRoot $repoRoot -RelativePath "docs/image/flows-api/flow-api-comentarios_js-post-.png") `
    -Lines @(
      "Crea comentario por celda (hilos con parent_id).",
      "Persistencia en SQLite: comentarios_celdas.",
      "Permite colaboración y trazabilidad en presupuestos."
    ) `
    -Refs @("src/routes/comentarios.js", "src/db/sqlite.js", "docs/image/flows-api/flow-api-comentarios_js-post-.png")

  $null = Add-FullImageSlide -Pres $pres -TitleText "API Notificaciones: GET /api/notificaciones (flujo)" `
    -ImagePath (Resolve-AssetPath -RepoRoot $repoRoot -RelativePath "docs/image/flows-api/flow-api-notificaciones_js-get-.png") `
    -Lines @(
      "Lista notificaciones por usuario (no leídas / últimas N).",
      "Persistencia en SQLite: notificaciones.",
      "Opcionalmente envía correo vía SMTP si está configurado."
    ) `
    -Refs @("src/routes/notificaciones.js", "src/services/notificacionesService.js", "docs/image/flows-api/flow-api-notificaciones_js-get-.png")

  $null = Add-FullImageSlide -Pres $pres -TitleText "API Layouts: GET /api/layouts/:modulo/:anio/:capitulo (flujo)" `
    -ImagePath (Resolve-AssetPath -RepoRoot $repoRoot -RelativePath "docs/image/flows-api/flow-api-layoutroutes_js-get-_modulo_anio_capitulo.png") `
    -Lines @(
      "Carga layout por empresa+módulo+año+capítulo desde SQLite (layout_*).",
      "Devuelve cuentas+secciones+operaciones con orden/visible/fórmulas.",
      "Base del Gestor de plantillas y de la generación de reportes."
    ) `
    -Refs @("src/routes/layoutRoutes.js", "src/services/layoutService.js", "docs/image/flows-api/flow-api-layoutroutes_js-get-_modulo_anio_capitulo.png")

  Add-SectionSlide -Pres $pres -TitleText "Anexo: Inventario de endpoints" -SubtitleText "Auto-generado desde src/server.js + src/routes/*" | Out-Null

  $api = Get-ApiInventory -RepoRoot $repoRoot
  if ($api) {
    if ($api.serverEndpoints -and $api.serverEndpoints.Count -gt 0) {
      $null = Add-TextSlide -Pres $pres -TitleText "Endpoints definidos en server.js" -Bullets -Lines $api.serverEndpoints -Refs @("src/server.js")
    }

    foreach ($r in ($api.routers | Sort-Object module)) {
      $authInfo = if ($r.auth) { $r.auth } else { "" }
      $fileInfo = if ($r.fileRel) { $r.fileRel } else { "" }
      $meta = @(
        ("Bases: " + (($r.bases | Where-Object { $_ }) -join " | ")),
        ("Auth: " + $authInfo),
        ("Archivo: " + $fileInfo)
      ) | Where-Object { $_ -and $_.ToString().Trim() -ne "" }

      $chunks = Chunk-Array -Items $r.endpoints -Size 14
      $part = 1
      foreach ($chunk in $chunks) {
        $t = "API " + $r.module
        if ($chunks.Count -gt 1) { $t = $t + " (parte $part/$($chunks.Count))" }
        $lines = @()
        $lines += $meta
        $lines += $chunk
        $null = Add-TextSlide -Pres $pres -TitleText $t -Bullets -Lines $lines -Refs @("src/server.js", $r.fileRel)
        $part += 1
      }
    }
  }

  $null = Add-TextSlide -Pres $pres -TitleText "Checklist de operación / debug" -Lines @(
    "1) Salud: GET /api/salud (servidor ok).",
    "2) Sesión: expira tras 30 min de inactividad (cookie rolling).",
    "3) Firebird: /api/reportes/diagnostico-firebird?empresaId=empresa1.",
    "4) Secrets: asegurar PANELAMCHAM_JWT_SECRET y SESSION_SECRET seguros en producción.",
    "5) Backups: verificar carpeta de backups y retención.",
    "6) Logs: revisar consola (queries lentas Firebird >2s, errores de rutas/404)."
  ) -Refs @("src/server.js", "src/routes/reportes.js", "src/services/firebirdService.js", "src/services/backupService.js")

  # ---- Save ----
  $pres.SaveAs($outputFull)
  Write-Host "PPT creado: $outputFull"
} catch {
  Write-Error ("Error generando PPT: " + $_.Exception.Message)
  throw
} finally {
  if ($pres) {
    try { $pres.Close() } catch {}
  }
  if ($ppt) {
    try { $ppt.Quit() } catch {}
  }
  foreach ($obj in @($pres, $ppt)) {
    if ($obj) {
      try { [System.Runtime.InteropServices.Marshal]::ReleaseComObject($obj) | Out-Null } catch {}
    }
  }
  try {
    [GC]::Collect()
    [GC]::WaitForPendingFinalizers()
  } catch {}
}
