# Script para Limpiar Caché Completo y Verificar Cambios

Write-Host "=== LIMPIEZA DE CACHÉ Y VERIFICACIÓN ===" -ForegroundColor Cyan
Write-Host ""

# 1. Verificar que los archivos tienen los cambios
Write-Host "1. Verificando cambios en plantillas.js..." -ForegroundColor Yellow
$contenido = Get-Content "vistas\js\plantillas.js" -Raw
if ($contenido -match "SIEMPRE usar panel lateral - nunca modal") {
    Write-Host "   ✅ Cambios encontrados en plantillas.js" -ForegroundColor Green
} else {
    Write-Host "   ❌ Cambios NO encontrados en plantillas.js" -ForegroundColor Red
}

# 2. Agregar timestamp al archivo HTML para forzar recarga
Write-Host ""
Write-Host "2. Agregando timestamp a plantillas.html..." -ForegroundColor Yellow
$timestamp = Get-Date -Format "yyyyMMddHHmmss"
$htmlPath = "vistas\plantillas.html"
$htmlContent = Get-Content $htmlPath -Raw

# Buscar la línea del script
if ($htmlContent -match '<script src="js/plantillas\.js(\?v=[0-9]+)?">') {
    $htmlContent = $htmlContent -replace '<script src="js/plantillas\.js(\?v=[0-9]+)?">', "<script src=`"js/plantillas.js?v=$timestamp`">"
    Set-Content -Path $htmlPath -Value $htmlContent -NoNewline
    Write-Host "   ✅ Timestamp agregado: ?v=$timestamp" -ForegroundColor Green
} else {
    Write-Host "   ⚠️  No se pudo agregar timestamp automáticamente" -ForegroundColor Yellow
}

# 3. Mostrar instrucciones
Write-Host ""
Write-Host "3. PASOS SIGUIENTES:" -ForegroundColor Cyan
Write-Host "   a) Cierra COMPLETAMENTE el navegador (todas las ventanas)" -ForegroundColor White
Write-Host "   b) Abre el navegador nuevamente" -ForegroundColor White
Write-Host "   c) Ve a Gestor de Plantillas" -ForegroundColor White
Write-Host "   d) Presiona Ctrl+Shift+I para abrir DevTools" -ForegroundColor White
Write-Host "   e) Ve a la pestaña 'Network'" -ForegroundColor White
Write-Host "   f) Marca 'Disable cache'" -ForegroundColor White
Write-Host "   g) Presiona F5 para recargar" -ForegroundColor White
Write-Host "   h) En la pestaña 'Console', copia y pega:" -ForegroundColor White
Write-Host ""
Write-Host "      console.log('TEST:', typeof window.editOperation, typeof openOperationEditorPanel);" -ForegroundColor Magenta
Write-Host ""
Write-Host "   i) Debe mostrar: TEST: function function" -ForegroundColor White
Write-Host ""
Write-Host "4. VERIFICAR PANEL:" -ForegroundColor Cyan
Write-Host "   a) Click en cualquier operación (ej: EJEMPLO)" -ForegroundColor White
Write-Host "   b) Observa la consola - debe mostrar:" -ForegroundColor White
Write-Host "      ✅ Panel lateral abierto con Bootstrap Offcanvas" -ForegroundColor Green
Write-Host "   c) Debe aparecer un panel desde la DERECHA (no un modal centrado)" -ForegroundColor White
Write-Host ""
Write-Host "=== LIMPIEZA COMPLETA ===" -ForegroundColor Green
