#Requires -Version 5.1
param(
    [string]$Workspace = "$PSScriptRoot\three-distance",
    [switch]$Build,
    [switch]$Down
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$COMPOSE_FILE = "$PSScriptRoot\docker-compose.epoch-stack.yml"
$OLLAMA_MODEL = 'llava'

# Load .env file if present
$envFile = "$PSScriptRoot\.env"
if (Test-Path $envFile) {
    Write-Host "[epoch] Loading $envFile" -ForegroundColor Cyan
    foreach ($line in Get-Content $envFile) {
        if ($line -match '^\s*#' -or $line.Trim() -eq '') { continue }
        if ($line -match '^([^=]+)=(.*)$') {
            $k = $Matches[1].Trim()
            $v = $Matches[2].Trim()
            if (-not [System.Environment]::GetEnvironmentVariable($k, 'Process')) {
                [System.Environment]::SetEnvironmentVariable($k, $v, 'Process')
            }
        }
    }
} else {
    Write-Host "[epoch] No .env file found. Copy .env.example to .env and fill in your API keys." -ForegroundColor Yellow
}

# Stop mode
if ($Down) {
    Write-Host "[epoch] Stopping Epoch stack..." -ForegroundColor Yellow
    docker compose -f $COMPOSE_FILE down
    # Also stop any locally-running bridge process
    Get-Process -Name "node" -ErrorAction SilentlyContinue |
        Where-Object { $_.MainWindowTitle -eq '' } |
        ForEach-Object {
            $cmdline = (Get-CimInstance Win32_Process -Filter "ProcessId=$($_.Id)").CommandLine
            if ($cmdline -match 'dist.bridge.server') {
                Write-Host "[epoch] Stopping local bridge (PID $($_.Id))..." -ForegroundColor Yellow
                Stop-Process -Id $_.Id -Force
            }
        }
    Write-Host "[epoch] Done." -ForegroundColor Green
    exit 0
}

# Validate workspace
if (-not (Test-Path $Workspace)) {
    Write-Error "[epoch] Workspace not found: $Workspace"
    exit 1
}
if (-not (Test-Path "$Workspace\manifest.json")) {
    Write-Warning "[epoch] No manifest.json in $Workspace - is this an Epoch workspace?"
}

$env:WORKSPACE_DIR = $Workspace
Write-Host "[epoch] Workspace: $env:WORKSPACE_DIR" -ForegroundColor Cyan

# Warn if a cloud provider's API key is missing
$provider = if ($env:VISION_PROVIDER) { $env:VISION_PROVIDER } else { 'ollama' }
Write-Host "[epoch] Vision provider: $provider" -ForegroundColor Cyan
$keyNeeded = switch ($provider) {
    'anthropic' { 'ANTHROPIC_API_KEY' }
    'openai'    { 'OPENAI_API_KEY' }
    'gemini'    { 'GEMINI_API_KEY' }
    default     { $null }
}
if ($keyNeeded -and -not [System.Environment]::GetEnvironmentVariable($keyNeeded, 'Process')) {
    Write-Warning "[epoch] $keyNeeded is not set. Vision conversion will fail."
    Write-Warning "        Add it to .env or set it in your shell."
}

# Ensure Docker is running
$dockerReady = docker info 2>&1 | Select-String 'Server Version'
if (-not $dockerReady) {
    Write-Host "[epoch] Starting Docker Desktop..." -ForegroundColor Yellow
    Start-Process "C:\Program Files\Docker\Docker\Docker Desktop.exe"
    $timeout = 90; $elapsed = 0
    do {
        Start-Sleep -Seconds 5
        $elapsed += 5
        $dockerReady = docker info 2>&1 | Select-String 'Server Version'
    } while (-not $dockerReady -and $elapsed -lt $timeout)
    if (-not $dockerReady) {
        Write-Error "[epoch] Docker did not start within ${timeout}s. Please start Docker Desktop manually."
        exit 1
    }
    Write-Host "[epoch] Docker ready." -ForegroundColor Green
}

# Start the bridge locally on the host (Docker containers have no outbound internet
# access due to Windows Firewall; the bridge needs to reach cloud vision APIs).
Write-Host "[epoch] Starting bridge on host (port 3002)..." -ForegroundColor Cyan
$bridgeScript = "$PSScriptRoot\dist\bridge\server.js"
if (-not (Test-Path $bridgeScript)) {
    Write-Warning "[epoch] Bridge not compiled. Run 'npm run build:lib' in the Epoch directory first."
} else {
    # Kill any existing bridge process on port 3002
    Get-NetTCPConnection -LocalPort 3002 -State Listen -ErrorAction SilentlyContinue |
        ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }
    $bridgeEnv = @{
        WORKSPACE_DIR      = $Workspace
        HOST_WORKSPACE_DIR = $Workspace
        VISION_PROVIDER    = $env:VISION_PROVIDER
        VISION_MODEL       = $env:VISION_MODEL
        ANTHROPIC_API_KEY  = $env:ANTHROPIC_API_KEY
        OPENAI_API_KEY     = $env:OPENAI_API_KEY
        GEMINI_API_KEY     = $env:GEMINI_API_KEY
        OLLAMA_BASE_URL    = 'http://localhost:11434'
    }
    $bridgeEnvStr = ($bridgeEnv.GetEnumerator() | ForEach-Object { "$($_.Key)=$($_.Value)" }) -join '; '
    Start-Process -NoNewWindow -FilePath "node" -ArgumentList $bridgeScript `
        -WorkingDirectory $PSScriptRoot `
        -PassThru | Out-Null
    # Set env vars the simple way for the child process
    foreach ($kv in $bridgeEnv.GetEnumerator()) {
        [System.Environment]::SetEnvironmentVariable($kv.Key, $kv.Value, 'Process')
    }
    # Wait briefly for bridge to bind
    Start-Sleep -Seconds 2
    $bridgeOk = $null
    try { $bridgeOk = Invoke-WebRequest -Uri "http://localhost:3002/health" -UseBasicParsing -TimeoutSec 3 -ErrorAction Stop } catch {}
    if ($bridgeOk) {
        Write-Host "[epoch] Bridge ready." -ForegroundColor Green
    } else {
        Write-Warning "[epoch] Bridge may not have started correctly. Check manually."
    }
}

# Remove any existing epoch containers not managed by this compose project
$managed = @('epoch-gitea', 'epoch-excalidraw', 'epoch-ollama', 'epoch-web')
foreach ($name in $managed) {
    $existing = docker ps -aq --filter "name=^/${name}$" 2>$null
    if ($existing) {
        Write-Host "[epoch] Removing existing container: $name" -ForegroundColor DarkGray
        docker rm -f $existing | Out-Null
    }
}

# Start the stack
$upArgs = @('-f', $COMPOSE_FILE, 'up', '-d')
if ($Build) { $upArgs += '--build' }

Write-Host "[epoch] Starting Epoch stack..." -ForegroundColor Cyan
docker compose @upArgs

if ($LASTEXITCODE -ne 0) {
    Write-Error "[epoch] docker compose failed (exit $LASTEXITCODE)"
    exit 1
}

# Pull llava into Ollama if not already present (one-time ~4.5 GB download)
Write-Host "[epoch] Checking Ollama for $OLLAMA_MODEL model..." -ForegroundColor Cyan
$ollamaReady = $false
$timeout = 60; $elapsed = 0
do {
    Start-Sleep -Seconds 3
    $elapsed += 3
    try {
        $tags = docker exec epoch-ollama ollama list 2>&1
        $ollamaReady = ($LASTEXITCODE -eq 0)
    } catch { }
} while (-not $ollamaReady -and $elapsed -lt $timeout)

if ($ollamaReady) {
    $hasModel = $tags | Select-String $OLLAMA_MODEL
    if (-not $hasModel) {
        Write-Host "[epoch] Pulling $OLLAMA_MODEL (first run only, ~4.5 GB - this will take a while on CPU)..." -ForegroundColor Yellow
        docker exec epoch-ollama ollama pull $OLLAMA_MODEL
        if ($LASTEXITCODE -eq 0) {
            Write-Host "[epoch] $OLLAMA_MODEL ready." -ForegroundColor Green
        } else {
            Write-Warning "[epoch] Failed to pull $OLLAMA_MODEL. Vision conversion will fail until the model is available."
        }
    } else {
        Write-Host "[epoch] $OLLAMA_MODEL already present." -ForegroundColor Green
    }
} else {
    Write-Warning "[epoch] Ollama did not become ready in time. Run manually: docker exec epoch-ollama ollama pull $OLLAMA_MODEL"
}

# Summary
Write-Host ""
Write-Host "[epoch] Stack is up:" -ForegroundColor Green
docker ps --filter "name=epoch-" --format "  {{.Names}}`t{{.Status}}"
Write-Host ""
Write-Host "  Gitea      -> http://localhost:3000  (william / epoch-local)" -ForegroundColor Cyan
Write-Host "  Excalidraw -> http://localhost:3001" -ForegroundColor Cyan
Write-Host "  Bridge     -> http://localhost:3002/health  (host process)" -ForegroundColor Cyan
Write-Host "  epoch-web  -> http://localhost:3003" -ForegroundColor Cyan
Write-Host "  Ollama     -> http://localhost:11434/api/tags" -ForegroundColor Cyan
Write-Host ""
if ($provider -eq 'ollama') {
    Write-Host "  Vision: $OLLAMA_MODEL (CPU, free - expect 30-90s per image)" -ForegroundColor DarkYellow
} else {
    Write-Host "  Vision: $provider (cloud)" -ForegroundColor DarkYellow
}
Write-Host ""
Write-Host "To stop:   .\start-epoch.ps1 -Down" -ForegroundColor DarkGray
Write-Host "To rebuild: .\start-epoch.ps1 -Build" -ForegroundColor DarkGray
