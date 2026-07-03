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

# Remove any existing epoch containers not managed by this compose project
$managed = @('epoch-gitea', 'epoch-excalidraw', 'epoch-bridge', 'epoch-ollama')
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
Write-Host "  Bridge     -> http://localhost:3002/health" -ForegroundColor Cyan
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
