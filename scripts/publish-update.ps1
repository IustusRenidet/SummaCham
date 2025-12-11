# Script de Publicación de Actualizaciones
# Uso: .\publish-update.ps1 -Version "1.0.1" -ReleaseNotes "Descripción de cambios"

param(
    [Parameter(Mandatory=$true)]
    [string]$Version,
    
    [Parameter(Mandatory=$false)]
    [string]$ReleaseNotes = "Nueva versión"
)

Write-Host "🚀 Iniciando proceso de publicación de actualización..." -ForegroundColor Cyan
Write-Host ""

# Verificar que estamos en la raíz del proyecto
if (-not (Test-Path "package.json")) {
    Write-Host "❌ Error: No se encontró package.json. Ejecuta este script desde la raíz del proyecto." -ForegroundColor Red
    exit 1
}

# Paso 1: Actualizar versión en package.json
Write-Host "📝 Paso 1: Actualizando versión en package.json..." -ForegroundColor Yellow
$packageJson = Get-Content "package.json" -Raw | ConvertFrom-Json
$oldVersion = $packageJson.version
$packageJson.version = $Version
$packageJson | ConvertTo-Json -Depth 100 | Set-Content "package.json"
Write-Host "   ✓ Versión actualizada: $oldVersion → $Version" -ForegroundColor Green
Write-Host ""

# Paso 2: Compilar la aplicación
Write-Host "🔨 Paso 2: Compilando la aplicación..." -ForegroundColor Yellow
Write-Host "   Esto puede tomar varios minutos..." -ForegroundColor Gray

$buildOutput = npm run build 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Error al compilar la aplicación" -ForegroundColor Red
    Write-Host $buildOutput
    exit 1
}
Write-Host "   ✓ Aplicación compilada exitosamente" -ForegroundColor Green
Write-Host ""

# Paso 3: Verificar archivos generados
Write-Host "📦 Paso 3: Verificando archivos generados..." -ForegroundColor Yellow

$distPath = "dist"
$requiredFiles = @(
    "SummaCham Setup $Version.exe",
    "SummaCham Setup $Version-ia32.exe",
    "SummaCham $Version.exe",
    "SummaCham $Version-ia32.exe",
    "latest.yml"
)

$allFilesExist = $true
foreach ($file in $requiredFiles) {
    $filePath = Join-Path $distPath $file
    if (Test-Path $filePath) {
        $size = (Get-Item $filePath).Length / 1MB
        Write-Host "   ✓ $file ($([math]::Round($size, 2)) MB)" -ForegroundColor Green
    } else {
        Write-Host "   ✗ $file (no encontrado)" -ForegroundColor Red
        $allFilesExist = $false
    }
}

if (-not $allFilesExist) {
    Write-Host ""
    Write-Host "❌ Algunos archivos no se generaron correctamente" -ForegroundColor Red
    exit 1
}
Write-Host ""

# Paso 4: Crear commit y tag
Write-Host "📌 Paso 4: Creando commit y tag de Git..." -ForegroundColor Yellow
git add package.json
git commit -m "Bump version to $Version"
git tag -a "v$Version" -m "Release v${Version}: $ReleaseNotes"
Write-Host "   ✓ Commit y tag creados" -ForegroundColor Green
Write-Host ""

# Paso 5: Instrucciones para GitHub Release
Write-Host "🌐 Paso 5: Publicar en GitHub" -ForegroundColor Yellow
Write-Host ""
Write-Host "   Ejecuta los siguientes comandos para publicar:" -ForegroundColor White
Write-Host ""
Write-Host "   git push origin main" -ForegroundColor Cyan
Write-Host "   git push origin v$Version" -ForegroundColor Cyan
Write-Host ""
Write-Host "   Luego, ve a GitHub y crea el release:" -ForegroundColor White
Write-Host "   https://github.com/IustusRenidet/SummaCham/releases/new?tag=v$Version" -ForegroundColor Cyan
Write-Host ""
Write-Host "   O usa gh CLI:" -ForegroundColor White
Write-Host "   gh release create v$Version --title ""v$Version"" --notes ""$ReleaseNotes"" \" -ForegroundColor Cyan
Write-Host "     dist/""SummaCham Setup $Version.exe"" \" -ForegroundColor Cyan
Write-Host "     dist/""SummaCham Setup $Version-ia32.exe"" \" -ForegroundColor Cyan
Write-Host "     dist/""SummaCham $Version.exe"" \" -ForegroundColor Cyan
Write-Host "     dist/""SummaCham $Version-ia32.exe"" \" -ForegroundColor Cyan
Write-Host "     dist/latest.yml" -ForegroundColor Cyan
Write-Host ""

Write-Host "✅ Proceso completado. Los archivos están listos en la carpeta 'dist'" -ForegroundColor Green
Write-Host ""

# Mostrar resumen
Write-Host "📊 Resumen:" -ForegroundColor Magenta
Write-Host "   Versión anterior: $oldVersion" -ForegroundColor White
Write-Host "   Nueva versión:    $Version" -ForegroundColor White
Write-Host "   Notas de release: $ReleaseNotes" -ForegroundColor White
Write-Host "   Archivos listos:  $($requiredFiles.Count)" -ForegroundColor White
