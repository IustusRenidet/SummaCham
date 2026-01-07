# Script para limpiar caché de iconos de Windows
# Ejecutar como administrador si es posible

Write-Host "🧹 Limpiando caché de iconos de Windows..." -ForegroundColor Cyan

# Método 1: Eliminar IconCache.db
$iconCachePath = "$env:LOCALAPPDATA\IconCache.db"
if (Test-Path $iconCachePath) {
    try {
        Remove-Item -Path $iconCachePath -Force -ErrorAction Stop
        Write-Host "✅ IconCache.db eliminado" -ForegroundColor Green
    } catch {
        Write-Host "⚠️ No se pudo eliminar IconCache.db (puede estar en uso)" -ForegroundColor Yellow
    }
}

# Método 2: Eliminar caché de thumbnails
$thumbCachePath = "$env:LOCALAPPDATA\Microsoft\Windows\Explorer"
if (Test-Path $thumbCachePath) {
    try {
        Get-ChildItem -Path $thumbCachePath -Filter "thumbcache_*.db" -ErrorAction SilentlyContinue | 
            ForEach-Object {
                try {
                    Remove-Item $_.FullName -Force -ErrorAction Stop
                    Write-Host "✅ $($_.Name) eliminado" -ForegroundColor Green
                } catch {
                    Write-Host "⚠️ No se pudo eliminar $($_.Name)" -ForegroundColor Yellow
                }
            }
    } catch {
        Write-Host "⚠️ Error al limpiar thumbnails" -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "📝 Pasos adicionales:" -ForegroundColor Cyan
Write-Host "  1. Reiniciar el Explorador de Windows" -ForegroundColor White
Write-Host "  2. Ejecutar: taskkill /f /im explorer.exe && start explorer.exe" -ForegroundColor Gray
Write-Host "  3. O reiniciar el PC" -ForegroundColor Gray
Write-Host ""

$respuesta = Read-Host "¿Deseas reiniciar el Explorador de Windows ahora? (S/N)"
if ($respuesta -eq 'S' -or $respuesta -eq 's') {
    Write-Host "🔄 Reiniciando Explorador de Windows..." -ForegroundColor Yellow
    taskkill /f /im explorer.exe
    Start-Sleep -Seconds 2
    Start-Process explorer.exe
    Write-Host "✅ Explorador reiniciado" -ForegroundColor Green
} else {
    Write-Host "ℹ️ Recuerda reiniciar el Explorador o el PC para ver los cambios" -ForegroundColor Yellow
}
