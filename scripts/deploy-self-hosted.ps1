param(
    [Parameter(Mandatory = $true)]
    [string]$Tag,

    [Parameter(Mandatory = $false)]
    [string]$ArtifactDir = ""
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Write-Step {
    param([string]$Message)
    Write-Host "[deploy] $Message" -ForegroundColor Cyan
}

function Fail {
    param([string]$Message)
    throw "[deploy] $Message"
}

function Get-EnvValue {
    param(
        [string]$Name,
        [bool]$Required = $false,
        [string]$Default = ""
    )

    $value = [Environment]::GetEnvironmentVariable($Name)
    if ([string]::IsNullOrWhiteSpace($value)) {
        if ($Required) {
            Fail "Missing required environment variable: $Name"
        }
        return $Default
    }
    return $value
}

function Invoke-OptionalCommand {
    param(
        [string]$CommandText,
        [string]$Label
    )

    if ([string]::IsNullOrWhiteSpace($CommandText)) {
        return
    }

    Write-Step "Running $Label command"
    Invoke-Expression $CommandText
}

function Sync-RepositoryToTarget {
    param(
        [string]$SourcePath,
        [string]$TargetPath
    )

    if (-not (Test-Path $SourcePath)) {
        Fail "Source path does not exist: $SourcePath"
    }

    if (-not (Test-Path $TargetPath)) {
        New-Item -ItemType Directory -Path $TargetPath -Force | Out-Null
    }

    $excludeDirs = @(
        ".git",
        ".github",
        "node_modules",
        "dist",
        "tmp",
        "tests",
        ".playwright-cli",
        ".claude"
    )

    $excludeFiles = @(
        ".env",
        ".env.local",
        ".env.development",
        ".env.production",
        "*.sqlite",
        "*.sqlite-shm",
        "*.sqlite-wal"
    )

    $args = @(
        $SourcePath,
        $TargetPath,
        "/E",
        "/XJ",
        "/R:2",
        "/W:2",
        "/NFL",
        "/NDL",
        "/NP",
        "/NJH",
        "/NJS"
    )

    if ($excludeDirs.Count -gt 0) {
        $args += "/XD"
        $args += $excludeDirs
    }

    if ($excludeFiles.Count -gt 0) {
        $args += "/XF"
        $args += $excludeFiles
    }

    Write-Step "Syncing repository to: $TargetPath"
    $process = Start-Process -FilePath "robocopy.exe" -ArgumentList $args -Wait -PassThru -NoNewWindow
    if ($process.ExitCode -gt 7) {
        Fail "robocopy failed with exit code $($process.ExitCode)"
    }
}

function Install-NodeDependencies {
    param([string]$AppDir)

    Push-Location $AppDir
    try {
        Write-Step "Installing production dependencies"
        npm ci --omit=dev

        Write-Step "Selecting native modules for Node runtime"
        npm run native:use-node
    }
    finally {
        Pop-Location
    }
}

function Install-ReleaseArtifact {
    param([string]$DistDir)

    if ([string]::IsNullOrWhiteSpace($DistDir)) {
        Fail "Artifact directory is required for DEPLOY_MODE=installer"
    }

    if (-not (Test-Path $DistDir)) {
        Fail "Artifact directory does not exist: $DistDir"
    }

    $installer = Get-ChildItem -Path $DistDir -Filter "*.exe" |
        Where-Object { $_.Name -match "Setup" } |
        Sort-Object LastWriteTime -Descending |
        Select-Object -First 1

    if (-not $installer) {
        $installer = Get-ChildItem -Path $DistDir -Filter "*.exe" |
            Sort-Object LastWriteTime -Descending |
            Select-Object -First 1
    }

    if (-not $installer) {
        Fail "No .exe installer found in artifact directory: $DistDir"
    }

    $installerArgs = Get-EnvValue -Name "DEPLOY_INSTALLER_ARGS" -Default "/S"
    Write-Step "Running installer: $($installer.Name)"
    $installerProcess = Start-Process -FilePath $installer.FullName -ArgumentList $installerArgs -Wait -PassThru
    if ($installerProcess.ExitCode -ne 0) {
        Fail "Installer failed with exit code $($installerProcess.ExitCode)"
    }
}

function Restart-Application {
    $serviceName = Get-EnvValue -Name "DEPLOY_WINDOWS_SERVICE_NAME"
    $restartCommand = Get-EnvValue -Name "DEPLOY_RESTART_COMMAND"
    $processName = Get-EnvValue -Name "DEPLOY_PROCESS_NAME"
    $exePath = Get-EnvValue -Name "DEPLOY_APP_EXE_PATH"

    if (-not [string]::IsNullOrWhiteSpace($serviceName)) {
        Write-Step "Restarting service: $serviceName"
        Restart-Service -Name $serviceName -Force
        return
    }

    if (-not [string]::IsNullOrWhiteSpace($restartCommand)) {
        Write-Step "Running restart command"
        Invoke-Expression $restartCommand
        return
    }

    if (-not [string]::IsNullOrWhiteSpace($processName)) {
        Write-Step "Stopping process by name: $processName"
        Get-Process -Name $processName -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
    }

    if (-not [string]::IsNullOrWhiteSpace($exePath)) {
        if (-not (Test-Path $exePath)) {
            Fail "DEPLOY_APP_EXE_PATH does not exist: $exePath"
        }
        Write-Step "Starting executable: $exePath"
        Start-Process -FilePath $exePath
        return
    }

    Write-Step "No restart target configured. Set DEPLOY_WINDOWS_SERVICE_NAME, DEPLOY_RESTART_COMMAND or DEPLOY_APP_EXE_PATH."
}

function Run-Healthcheck {
    $healthUrl = Get-EnvValue -Name "DEPLOY_HEALTHCHECK_URL"
    if ([string]::IsNullOrWhiteSpace($healthUrl)) {
        Write-Step "Healthcheck skipped"
        return
    }

    $retries = [int](Get-EnvValue -Name "DEPLOY_HEALTHCHECK_RETRIES" -Default "20")
    $delaySeconds = [int](Get-EnvValue -Name "DEPLOY_HEALTHCHECK_DELAY_SECONDS" -Default "3")

    Write-Step "Running healthcheck: $healthUrl"
    for ($attempt = 1; $attempt -le $retries; $attempt++) {
        try {
            $response = Invoke-WebRequest -Uri $healthUrl -Method Get -TimeoutSec 10 -UseBasicParsing
            if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 400) {
                Write-Step "Healthcheck succeeded on attempt $attempt"
                return
            }
        }
        catch {
            # Retry until attempts are exhausted.
        }

        Start-Sleep -Seconds $delaySeconds
    }

    Fail "Healthcheck failed after $retries attempts: $healthUrl"
}

Write-Step "Starting deployment for tag $Tag"

$deployMode = (Get-EnvValue -Name "DEPLOY_MODE" -Default "source").ToLowerInvariant()
$workspace = Get-EnvValue -Name "GITHUB_WORKSPACE" -Required $true
$appDir = Get-EnvValue -Name "DEPLOY_APP_DIR"

$preCommand = Get-EnvValue -Name "DEPLOY_PRE_COMMAND"
$migrationCommand = Get-EnvValue -Name "DEPLOY_MIGRATION_COMMAND"
$postCommand = Get-EnvValue -Name "DEPLOY_POST_COMMAND"

Invoke-OptionalCommand -CommandText $preCommand -Label "pre-deploy"

switch ($deployMode) {
    "source" {
        if ([string]::IsNullOrWhiteSpace($appDir)) {
            Fail "DEPLOY_APP_DIR is required when DEPLOY_MODE=source"
        }

        Sync-RepositoryToTarget -SourcePath $workspace -TargetPath $appDir
        Install-NodeDependencies -AppDir $appDir
    }
    "installer" {
        Install-ReleaseArtifact -DistDir $ArtifactDir
    }
    default {
        Fail "Unsupported DEPLOY_MODE: $deployMode. Use 'source' or 'installer'."
    }
}

Invoke-OptionalCommand -CommandText $migrationCommand -Label "migration"
Restart-Application
Run-Healthcheck
Invoke-OptionalCommand -CommandText $postCommand -Label "post-deploy"

Write-Step "Deployment completed successfully for tag $Tag"
