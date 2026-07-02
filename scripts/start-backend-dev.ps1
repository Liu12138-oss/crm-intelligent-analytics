[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'

. (Join-Path $PSScriptRoot 'load-local-runtime-env.ps1') | Out-Null

Set-Location (Resolve-Path (Join-Path $PSScriptRoot '..'))
pnpm --dir backend dev
