Add-Type -AssemblyName System.Windows.Forms

$openDialog = New-Object System.Windows.Forms.OpenFileDialog
$openDialog.Filter = "Excel (*.xlsx)|*.xlsx"
$openDialog.Title = "Selecciona el archivo de Excel (con graficas)"
$openDialog.InitialDirectory = [Environment]::GetFolderPath("MyDocuments")

if ($openDialog.ShowDialog() -ne [System.Windows.Forms.DialogResult]::OK) {
  exit 0
}

$inputPath = $openDialog.FileName
$baseName = [System.IO.Path]::GetFileNameWithoutExtension($inputPath)
$initialDir = [System.IO.Path]::GetDirectoryName($inputPath)

$saveDialog = New-Object System.Windows.Forms.SaveFileDialog
$saveDialog.Filter = "PowerPoint (*.pptx)|*.pptx"
$saveDialog.Title = "Guardar presentacion"
$saveDialog.InitialDirectory = $initialDir
$saveDialog.FileName = $baseName + "_charts.pptx"

if ($saveDialog.ShowDialog() -ne [System.Windows.Forms.DialogResult]::OK) {
  exit 0
}

$scriptPath = Join-Path $PSScriptRoot "export-excel-charts-to-ppt.ps1"
& $scriptPath -InputPath $inputPath -OutputPath $saveDialog.FileName

