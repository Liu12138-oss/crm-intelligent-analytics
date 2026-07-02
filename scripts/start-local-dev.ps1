[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$backendScript = Join-Path $PSScriptRoot 'start-backend-dev.ps1'
$frontendScript = Join-Path $PSScriptRoot 'start-frontend-dev.ps1'

$backendProcess = Start-Process `
    -FilePath 'powershell.exe' `
    -ArgumentList @(
        '-NoExit',
        '-ExecutionPolicy', 'Bypass',
        '-File', $backendScript
    ) `
    -WorkingDirectory $repoRoot `
    -PassThru

$frontendProcess = Start-Process `
    -FilePath 'powershell.exe' `
    -ArgumentList @(
        '-NoExit',
        '-ExecutionPolicy', 'Bypass',
        '-File', $frontendScript
    ) `
    -WorkingDirectory $repoRoot `
    -PassThru

[PSCustomObject]@{
    backendPid = $backendProcess.Id
    frontendPid = $frontendProcess.Id
    backendCommand = 'powershell -ExecutionPolicy Bypass -File .\scripts\start-backend-dev.ps1'
    frontendCommand = 'powershell -ExecutionPolicy Bypass -File .\scripts\start-frontend-dev.ps1'
} | ConvertTo-Json -Depth 3
