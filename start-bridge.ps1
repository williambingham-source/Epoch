#Requires -Version 5.1
# Terminal 1: run this to start the Epoch bridge on the host.
# The bridge must run on the host (not in Docker) because Docker containers
# have no outbound internet access on this machine (Windows Firewall / WSL2).
param(
    [string]$Workspace = "$PSScriptRoot\three-distance"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

# Load .env
$envFile = "$PSScriptRoot\.env"
if (Test-Path $envFile) {
    foreach ($line in Get-Content $envFile) {
        if ($line -match '^\s*#' -or $line.Trim() -eq '') { continue }
        if ($line -match '^([^=]+)=(.*)$') {
            $k = $Matches[1].Trim(); $v = $Matches[2].Trim()
            [System.Environment]::SetEnvironmentVariable($k, $v, 'Process')
        }
    }
}

$bridgeScript = "$PSScriptRoot\dist\bridge\server.js"
if (-not (Test-Path $bridgeScript)) {
    Write-Error "Bridge not compiled. Run 'npm run build:lib' first."
    exit 1
}

if (-not (Test-Path $Workspace)) {
    Write-Error "Workspace not found: $Workspace"
    exit 1
}

$env:WORKSPACE_DIR      = $Workspace
$env:HOST_WORKSPACE_DIR = $Workspace
$env:OLLAMA_BASE_URL    = 'http://localhost:11434'

$provider = if ($env:VISION_PROVIDER) { $env:VISION_PROVIDER } else { 'ollama' }
Write-Host "[bridge] Workspace:  $Workspace" -ForegroundColor Cyan
Write-Host "[bridge] Provider:   $provider" -ForegroundColor Cyan
Write-Host "[bridge] Listening on http://localhost:3002" -ForegroundColor Cyan
Write-Host "[bridge] Press Ctrl+C to stop." -ForegroundColor DarkGray
Write-Host ""

node $bridgeScript
