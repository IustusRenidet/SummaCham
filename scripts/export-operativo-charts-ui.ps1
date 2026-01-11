Add-Type -AssemblyName System.Windows.Forms

$openDialog = New-Object System.Windows.Forms.OpenFileDialog
$openDialog.Filter = "Excel (*.xlsx)|*.xlsx"
$openDialog.Title = "Selecciona el archivo exportado"
$openDialog.InitialDirectory = [Environment]::GetFolderPath("MyDocuments")

if ($openDialog.ShowDialog() -ne [System.Windows.Forms.DialogResult]::OK) {
  exit 0
}

$inputPath = $openDialog.FileName
$baseName = [System.IO.Path]::GetFileNameWithoutExtension($inputPath)
$initialDir = [System.IO.Path]::GetDirectoryName($inputPath)

$saveDialog = New-Object System.Windows.Forms.SaveFileDialog
$saveDialog.Filter = "Excel (*.xlsx)|*.xlsx"
$saveDialog.Title = "Guardar archivo con graficas"
$saveDialog.InitialDirectory = $initialDir
$saveDialog.FileName = $baseName + "_graficas.xlsx"

if ($saveDialog.ShowDialog() -ne [System.Windows.Forms.DialogResult]::OK) {
  exit 0
}

$scriptPath = Join-Path $PSScriptRoot "export-operativo-charts.ps1"
& $scriptPath -InputPath $inputPath -OutputPath $saveDialog.FileName
