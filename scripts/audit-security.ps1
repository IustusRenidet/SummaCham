# Script de Auditoría de Seguridad
# Ejecutar antes de hacer push al repositorio público

Write-Host "🔍 Auditando información sensible en el repositorio..." -ForegroundColor Cyan
Write-Host ""

$issues = @()

# 1. Verificar que .env no existe en el repo
Write-Host "1. Verificando archivos .env..." -ForegroundColor Yellow
if (Test-Path ".env") {
    $gitIgnored = git check-ignore .env 2>$null
    if (!$gitIgnored) {
        $issues += "❌ CRÍTICO: .env existe y NO está en .gitignore"
    } else {
        Write-Host "   ✓ .env está ignorado correctamente" -ForegroundColor Green
    }
}

# 2. Verificar que datos/ no existe o está ignorado
Write-Host "2. Verificando carpeta datos/..." -ForegroundColor Yellow
if (Test-Path "datos") {
    $gitIgnored = git check-ignore datos 2>$null
    if (!$gitIgnored) {
        $issues += "❌ CRÍTICO: datos/ NO está en .gitignore"
    } else {
        Write-Host "   ✓ datos/ está ignorado correctamente" -ForegroundColor Green
    }
}

# 3. Verificar seed_users.json
Write-Host "3. Verificando seed_users.json..." -ForegroundColor Yellow
if (Test-Path "src/config/seed_users.json") {
    $gitIgnored = git check-ignore src/config/seed_users.json 2>$null
    if (!$gitIgnored) {
        $issues += "❌ CRÍTICO: seed_users.json NO está en .gitignore"
    } else {
        Write-Host "   ✓ seed_users.json está ignorado correctamente" -ForegroundColor Green
    }
}

# 4. Buscar contraseñas hardcodeadas
Write-Host "4. Buscando contraseñas hardcodeadas..." -ForegroundColor Yellow
$passwordMatches = git grep -i "password.*=.*['\`"].*['\`"]" -- "*.js" "*.json" 2>$null | 
    Where-Object { $_ -notmatch "example" -and $_ -notmatch "CAMBIAR" -and $_ -notmatch "placeholder" -and $_ -notmatch "vendor" }

if ($passwordMatches) {
    $issues += "⚠️  ADVERTENCIA: Posibles contraseñas hardcodeadas encontradas:"
    $passwordMatches | ForEach-Object { $issues += "   $_" }
} else {
    Write-Host "   ✓ No se encontraron contraseñas hardcodeadas" -ForegroundColor Green
}

# 5. Buscar tokens/secrets
Write-Host "5. Buscando tokens y secretos..." -ForegroundColor Yellow
$tokenMatches = git grep -iE "(token|secret|api[_-]?key).*=.*['\`"][^'\`"]{20,}" -- "*.js" "*.json" 2>$null |
    Where-Object { $_ -notmatch "example" -and $_ -notmatch "vendor" -and $_ -notmatch "CAMBIAR" }

if ($tokenMatches) {
    $issues += "⚠️  ADVERTENCIA: Posibles tokens/secrets encontrados:"
    $tokenMatches | ForEach-Object { $issues += "   $_" }
} else {
    Write-Host "   ✓ No se encontraron tokens hardcodeados" -ForegroundColor Green
}

# 6. Verificar archivos sensibles en staging
Write-Host "6. Verificando archivos en staging..." -ForegroundColor Yellow
$stagedFiles = git diff --cached --name-only
$sensibleFiles = $stagedFiles | Where-Object {
    $_ -match "\.(env|sqlite|db|log)$" -or
    $_ -match "seed_users\.json$" -or
    $_ -match "datos/" -or
    $_ -match "\.exe$"
}

if ($sensibleFiles) {
    $issues += "❌ CRÍTICO: Archivos sensibles en staging:"
    $sensibleFiles | ForEach-Object { $issues += "   $_" }
} else {
    Write-Host "   ✓ No hay archivos sensibles en staging" -ForegroundColor Green
}

# 7. Verificar rutas absolutas
Write-Host "7. Buscando rutas absolutas..." -ForegroundColor Yellow
$rutasAbsolutas = git grep -E "C:\\\\|D:\\\\|/Users/|/home/" -- "*.js" "*.json" 2>$null |
    Where-Object { $_ -notmatch "vendor" -and $_ -notmatch "\.min\." }

if ($rutasAbsolutas) {
    $issues += "⚠️  ADVERTENCIA: Rutas absolutas encontradas:"
    $rutasAbsolutas | ForEach-Object { $issues += "   $_" }
} else {
    Write-Host "   ✓ No se encontraron rutas absolutas" -ForegroundColor Green
}

# 8. Verificar que existan los archivos .example
Write-Host "8. Verificando archivos .example..." -ForegroundColor Yellow
$exampleFiles = @(".env.example", "src/config/seed_users.example.json")
$missingExamples = @()
foreach ($file in $exampleFiles) {
    if (!(Test-Path $file)) {
        $missingExamples += $file
    }
}

if ($missingExamples) {
    $issues += "⚠️  ADVERTENCIA: Archivos .example faltantes:"
    $missingExamples | ForEach-Object { $issues += "   $_" }
} else {
    Write-Host "   ✓ Todos los archivos .example existen" -ForegroundColor Green
}

# Resumen
Write-Host ""
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host "RESUMEN DE AUDITORÍA" -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host ""

if ($issues.Count -eq 0) {
    Write-Host "✅ ¡TODO CORRECTO! El repositorio está listo para ser público." -ForegroundColor Green
    Write-Host ""
    Write-Host "Recuerda:" -ForegroundColor Yellow
    Write-Host "  1. Nunca hacer commit de .env con valores reales"
    Write-Host "  2. Mantener datos/ en .gitignore"
    Write-Host "  3. No commitear seed_users.json con usuarios reales"
    Write-Host "  4. Usar variables de entorno para secretos"
    Write-Host ""
    exit 0
} else {
    Write-Host "⚠️  SE ENCONTRARON $($issues.Count) PROBLEMA(S):" -ForegroundColor Red
    Write-Host ""
    foreach ($issue in $issues) {
        Write-Host $issue -ForegroundColor Red
    }
    Write-Host ""
    Write-Host "❌ NO subas el repositorio hasta corregir estos problemas." -ForegroundColor Red
    Write-Host ""
    exit 1
}
