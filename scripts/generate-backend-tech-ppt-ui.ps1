Add-Type -AssemblyName System.Windows.Forms

$repoRoot = Split-Path $PSScriptRoot -Parent
$docsDir = Join-Path $repoRoot "docs"
if (-not (Test-Path $docsDir)) { New-Item -ItemType Directory -Path $docsDir -Force | Out-Null }

$saveDialog = New-Object System.Windows.Forms.SaveFileDialog
$saveDialog.Filter = "PowerPoint (*.pptx)|*.pptx"
$saveDialog.Title = "Guardar presentación técnica (backend)"
$saveDialog.InitialDirectory = $docsDir
$saveDialog.FileName = "Presentacion_Tecnica_Backend_SummaCham.pptx"

if ($saveDialog.ShowDialog() -ne [System.Windows.Forms.DialogResult]::OK) {
  exit 0
}

$scriptPath = Join-Path $PSScriptRoot "generate-backend-tech-ppt.ps1"
& $scriptPath -OutputPath $saveDialog.FileName

