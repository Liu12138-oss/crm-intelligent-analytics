[CmdletBinding()]
param(
    [ValidateSet('all', 'department', 'user')]
    [string]$ResourceType = 'all'
)

$ErrorActionPreference = 'Stop'

. (Join-Path $PSScriptRoot 'load-local-runtime-env.ps1') | Out-Null

$baseUrl = if ($env:PORT) { "http://127.0.0.1:$($env:PORT)" } else { 'http://127.0.0.1:3001' }
$uri = "$baseUrl/api/v1/internal/wecom-directory-sync/run"

if (
    [string]::IsNullOrWhiteSpace($env:WECOM_WEB_LOGIN_APP_ID) -or
    [string]::IsNullOrWhiteSpace($env:WECOM_DIRECTORY_SECRET)
) {
    throw '企业微信目录同步缺少可用凭证，请先配置 WECOM_WEB_LOGIN_APP_ID 和 WECOM_DIRECTORY_SECRET。'
}

$body = @{
    resourceType = $ResourceType
} | ConvertTo-Json

Write-Host "Starting WeCom directory sync. Resource type: $ResourceType" -ForegroundColor Cyan

$response = Invoke-RestMethod -Uri $uri -Method Post -ContentType "application/json" -Body $body

Write-Host 'WeCom directory sync result:' -ForegroundColor Green
$response | ConvertTo-Json -Depth 6
