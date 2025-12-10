# Script para cambiar modo de entorno rápidamente
# Uso: .\cambiar-modo.ps1 dev  (o prod)

param(
    [Parameter(Mandatory=$true)]
    [ValidateSet('dev', 'prod', 'development', 'production')]
    [string]$Modo
)

# Normalizar modo
$ModoFinal = switch ($Modo) {
    'dev' { 'development' }
    'prod' { 'production' }
    default { $Modo }
}

$ArchivoOrigen = ".env.$ModoFinal"
$ArchivoDestino = ".env"

if (-not (Test-Path $ArchivoOrigen)) {
    Write-Host "❌ Error: No se encontró el archivo $ArchivoOrigen" -ForegroundColor Red
    exit 1
}

Copy-Item $ArchivoOrigen $ArchivoDestino -Force

Write-Host "✅ Modo cambiado a: $ModoFinal" -ForegroundColor Green
Write-Host ""

# Mostrar configuración actual
Write-Host "📋 Configuración activa (.env):" -ForegroundColor Cyan
Get-Content $ArchivoDestino | Where-Object { $_ -notmatch '^#' -and $_ -ne '' } | ForEach-Object {
    Write-Host "   $_" -ForegroundColor Gray
}

Write-Host ""
Write-Host "🚀 Ahora puedes ejecutar:" -ForegroundColor Yellow
Write-Host "   npm start" -ForegroundColor White
