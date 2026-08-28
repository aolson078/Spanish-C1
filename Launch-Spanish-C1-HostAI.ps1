[CmdletBinding()]
param(
  [string]$OllamaEndpoint = 'http://100.117.2.102:11434',
  [string]$Model = 'gpt-oss-agent-64k:latest',
  [ValidateSet('low', 'medium', 'high')]
  [string]$ThinkingLevel = 'medium',
  [switch]$CheckOnly
)

$ErrorActionPreference = 'Stop'
$endpoint = $OllamaEndpoint.TrimEnd('/')
$executable = Join-Path $PSScriptRoot 'release\host-ai\Spanish C1 0.3.0.exe'
$dataRoot = Join-Path $PSScriptRoot 'data'
$audioModelRoot = Join-Path $PSScriptRoot 'release\m6-benchmark\models'

try {
  $version = Invoke-RestMethod -Uri "$endpoint/api/version" -TimeoutSec 10
  $catalog = Invoke-RestMethod -Uri "$endpoint/api/tags" -TimeoutSec 15
} catch {
  throw "The private Ollama host is unavailable at $endpoint. Confirm that Tailscale is connected on both computers. $($_.Exception.Message)"
}

$installedModels = @($catalog.models | ForEach-Object { $_.name; $_.model })
if ($Model -notin $installedModels) {
  throw "The Ollama host is reachable, but model '$Model' is not installed."
}

Write-Host "Ollama $($version.version) is ready at $endpoint"
Write-Host "Model: $Model (thinking: $ThinkingLevel)"

if ($CheckOnly) {
  return
}

if (-not (Test-Path -LiteralPath $executable -PathType Leaf)) {
  throw "Spanish C1 is not packaged at '$executable'. Run npm.cmd run dist:win:host-ai first."
}

if (-not (Test-Path -LiteralPath $dataRoot -PathType Container)) {
  New-Item -ItemType Directory -Path $dataRoot | Out-Null
}

$env:APP_DATA_ROOT = $dataRoot
$env:AUDIO_MODEL_ROOT = $audioModelRoot
$env:OLLAMA_BASE_URL = $endpoint
$env:OLLAMA_MODEL = $Model
$env:OLLAMA_CONTEXT_LENGTH = '8192'
$env:OLLAMA_TIMEOUT_MS = '120000'
$env:OLLAMA_THINK = $ThinkingLevel

Start-Process -FilePath $executable -WorkingDirectory $PSScriptRoot
