param(
  [switch]$SkipPythonInstall
)

$ErrorActionPreference = "Stop"

function Write-Info($msg) {
  Write-Host "[INFO] $msg" -ForegroundColor Cyan
}

function Write-Ok($msg) {
  Write-Host "[OK] $msg" -ForegroundColor Green
}

function Write-WarnMsg($msg) {
  Write-Host "[WARN] $msg" -ForegroundColor Yellow
}

function Test-PythonAvailable {
  try {
    & py -3 --version | Out-Null
    return $true
  }
  catch {
    try {
      & python --version | Out-Null
      return $true
    }
    catch {
      return $false
    }
  }
}

function Resolve-PythonExecutable {
  try {
    $fromPy = (& py -3 -c "import sys; print(sys.executable)" 2>$null | Select-Object -First 1)
    if ($fromPy) {
      $candidate = $fromPy.ToString().Trim()
      if ($candidate -and (Test-Path $candidate)) {
        return $candidate
      }
    }
  }
  catch {}

  try {
    $fromPython = (& python -c "import sys; print(sys.executable)" 2>$null | Select-Object -First 1)
    if ($fromPython) {
      $candidate = $fromPython.ToString().Trim()
      if ($candidate -and (Test-Path $candidate)) {
        return $candidate
      }
    }
  }
  catch {}

  try {
    $cmd = Get-Command python -ErrorAction Stop
    if ($cmd -and $cmd.Source -and (Test-Path $cmd.Source)) {
      return $cmd.Source
    }
  }
  catch {}

  return ""
}

function Ensure-EnvKey {
  param(
    [string]$FilePath,
    [string]$Key,
    [string]$Value
  )

  if (-not (Test-Path $FilePath)) {
    New-Item -Path $FilePath -ItemType File -Force | Out-Null
  }

  $content = Get-Content -Path $FilePath -Raw -ErrorAction SilentlyContinue
  if (-not $content) { $content = "" }

  $pattern = "(?m)^\s*$([Regex]::Escape($Key))\s*="
  if ($content -match $pattern) {
    $updated = [Regex]::Replace($content, $pattern + ".*$", "$Key=$Value")
    Set-Content -Path $FilePath -Value $updated -NoNewline
    return
  }

  if ($content -and -not $content.EndsWith("`n")) {
    $content += "`r`n"
  }
  $content += "$Key=$Value`r`n"
  Set-Content -Path $FilePath -Value $content -NoNewline
}

Write-Info "Preparando exportación nativa Excel (openpyxl)..."

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
Set-Location $repoRoot

if (-not (Test-PythonAvailable)) {
  if ($SkipPythonInstall) {
    throw "Python no está disponible y se indicó -SkipPythonInstall."
  }

  $winget = Get-Command winget -ErrorAction SilentlyContinue
  if (-not $winget) {
    throw "Python no está instalado y winget no está disponible para instalarlo automáticamente."
  }

  Write-Info "Python no detectado. Instalando Python 3.11 con winget..."
  & winget install --id Python.Python.3.11 -e --accept-package-agreements --accept-source-agreements --silent
  Start-Sleep -Seconds 2

  if (-not (Test-PythonAvailable)) {
    throw "No se detectó Python tras la instalación automática."
  }
}

Write-Ok "Python detectado."

$pythonExecutable = Resolve-PythonExecutable
if ($pythonExecutable) {
  Write-Info "Python ejecutable detectado: $pythonExecutable"
} else {
  Write-WarnMsg "No se pudo resolver ruta absoluta de python.exe. Se usará launcher py."
}

$envFile = Join-Path $repoRoot ".env.production"
Ensure-EnvKey -FilePath $envFile -Key "EXCEL_NATIVE_ENGINE" -Value "openpyxl"
Ensure-EnvKey -FilePath $envFile -Key "EXCEL_NATIVE_AUTO_BOOTSTRAP" -Value "1"
if ($pythonExecutable) {
  Ensure-EnvKey -FilePath $envFile -Key "EXCEL_NATIVE_PYTHON_BIN" -Value "`"$pythonExecutable`""
  Ensure-EnvKey -FilePath $envFile -Key "EXCEL_NATIVE_BOOTSTRAP_PYTHON_BIN" -Value "`"$pythonExecutable`""
}
else {
  Ensure-EnvKey -FilePath $envFile -Key "EXCEL_NATIVE_BOOTSTRAP_PYTHON_BIN" -Value "py -3"
}
Ensure-EnvKey -FilePath $envFile -Key "EXCEL_NATIVE_TIMEOUT_MS" -Value "300000"
Ensure-EnvKey -FilePath $envFile -Key "EXCEL_NATIVE_PYTHON_TIMEOUT_MS" -Value "300000"
Write-Ok "Variables de .env.production preparadas."

Write-Info "Ejecutando bootstrap Node del runtime openpyxl..."
node scripts/setup-excel-native-runtime.js
if ($LASTEXITCODE -ne 0) {
  throw "El bootstrap de Excel nativo falló."
}

Write-Ok "Excel nativo listo. Reinicia el servicio Node para aplicar cambios."
