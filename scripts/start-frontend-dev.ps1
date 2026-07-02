[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'

. (Join-Path $PSScriptRoot 'load-local-runtime-env.ps1') | Out-Null

# 本地前端开发统一走 Vite 同源代理，避免浏览器从 127.0.0.1 页面跨域调用 10.x/localhost 后端时，
# 因 `SameSite=Lax` 会话 Cookie 不回传，出现“登录成功但 capabilities 401”的假失败。
$backendPort = '3001'
if (-not [string]::IsNullOrWhiteSpace($env:PORT)) {
    $backendPort = $env:PORT.Trim()
}
Set-Item -Path 'Env:VITE_API_BASE_URL' -Value ''
Set-Item -Path 'Env:VITE_DEV_API_PROXY_TARGET' -Value "http://127.0.0.1:$backendPort"

Set-Location (Resolve-Path (Join-Path $PSScriptRoot '..'))
pnpm --dir frontend dev -- --host 0.0.0.0 --port 5173
