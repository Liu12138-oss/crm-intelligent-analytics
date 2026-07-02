[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'

. (Join-Path $PSScriptRoot 'load-local-runtime-env.ps1') | Out-Null
. (Join-Path $PSScriptRoot 'ensure-local-analysis-warehouse.ps1')

$backendPort = '3001'
if (-not [string]::IsNullOrWhiteSpace($env:PORT)) {
    $backendPort = $env:PORT.Trim()
}

& (Join-Path $PSScriptRoot 'cleanup-local-backend-dev.ps1') -Port $backendPort

Set-Location (Resolve-Path (Join-Path $PSScriptRoot '..\backend'))
node --watch -r ts-node/register src/main.ts
