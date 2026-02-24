$excel = New-Object -ComObject Excel.Application
$excel.Visible = $false
$wb = $excel.Workbooks.Add()
$ws = $wb.Worksheets.Item(1)
$ws.Cells.Item(1, 1).Value2 = "CHART"
$ws.Cells.Item(1, 2).Value2 = "Titulo"
$ws.Cells.Item(2, 1).Value2 = "Categoria"
$ws.Cells.Item(2, 2).Value2 = "Serie 1"
$ws.Cells.Item(3, 1).Value2 = "Label 1"
$ws.Cells.Item(3, 2).Value2 = 10

$values = $ws.UsedRange.Value2
Write-Host "Type: $($values.GetType().Name)"
Write-Host "Rows: $($values.GetUpperBound(0))"
Write-Host "Cols: $($values.GetUpperBound(1))"
Write-Host "Val 1,1: $($values[1,1])"

$wb.Close($false)
$excel.Quit()
