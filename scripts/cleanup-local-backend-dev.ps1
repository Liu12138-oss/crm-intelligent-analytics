[CmdletBinding()]
param(
    [string]$Port = '3001'
)

$ErrorActionPreference = 'Stop'

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$lockPath = Join-Path $repoRoot '.runtime\wecom-bot-listener.lock'

function Test-IsProjectBackendProcess {
    param(
        [object]$ProcessInfo,
        [int[]]$TrustedPids
    )

    if ($null -eq $ProcessInfo) {
        return $false
    }

    $processId = [int]$ProcessInfo.ProcessId
    $commandLine = ''
    if ($null -ne $ProcessInfo.CommandLine) {
        $commandLine = [string]$ProcessInfo.CommandLine
    }

    # 锁文件里的 PID 来自本仓库运行态，优先按旧后端实例处理。
    if ($TrustedPids -contains $processId) {
        return $true
    }

    # 本地后端开发入口：node --watch -r ts-node/register src/main.ts。
    if ($commandLine -match '(^|\s)src[/\\]main\.ts(\s|$)' -and $commandLine -match 'ts-node/register') {
        return $true
    }

    # 兼容少量直接运行构建产物的本地排障场景。
    if ($commandLine -match 'backend[/\\]dist[/\\]src[/\\]main\.js') {
        return $true
    }

    return $false
}

function Stop-ProjectBackendProcess {
    param(
        [int]$ProcessId,
        [string]$Reason,
        [int[]]$TrustedPids
    )

    $processInfo = Get-CimInstance Win32_Process -Filter "ProcessId = $ProcessId" -ErrorAction SilentlyContinue
    if ($null -eq $processInfo) {
        return
    }

    if (-not (Test-IsProjectBackendProcess -ProcessInfo $processInfo -TrustedPids $TrustedPids)) {
        Write-Warning "PID $ProcessId was detected but does not look like this repo backend. Skipped. Reason: $Reason"
        Write-Warning "CommandLine: $($processInfo.CommandLine)"
        return
    }

    Write-Host "Stopping stale backend process PID $ProcessId. Reason: $Reason"
    Stop-Process -Id $ProcessId -Force -ErrorAction SilentlyContinue
    Start-Sleep -Milliseconds 500
}

function Get-LockOwnerPid {
    param([string]$Path)

    if (-not (Test-Path -LiteralPath $Path)) {
        return $null
    }

    try {
        $lock = Get-Content -LiteralPath $Path -Encoding UTF8 -Raw | ConvertFrom-Json
        if ($null -ne $lock.pid) {
            return [int]$lock.pid
        }
    } catch {
        return $null
    }

    return $null
}

$trustedPids = @()
$lockOwnerPid = Get-LockOwnerPid -Path $lockPath
if ($null -ne $lockOwnerPid) {
    $trustedPids += $lockOwnerPid
}

if ($null -ne $lockOwnerPid) {
    Stop-ProjectBackendProcess -ProcessId $lockOwnerPid -Reason "wecom listener lock owner" -TrustedPids $trustedPids
}

$portNumber = 3001
if ([int]::TryParse($Port, [ref]$portNumber)) {
    $connections = Get-NetTCPConnection -LocalPort $portNumber -ErrorAction SilentlyContinue |
        Where-Object { $_.State -eq 'Listen' } |
        Select-Object -ExpandProperty OwningProcess -Unique

    foreach ($connectionPid in $connections) {
        Stop-ProjectBackendProcess -ProcessId ([int]$connectionPid) -Reason "backend port $portNumber is already in use" -TrustedPids $trustedPids
    }
}

# 只有确认锁持有进程已退出后才删除锁，避免企业微信长连接被重复启动。
$lockOwnerPid = Get-LockOwnerPid -Path $lockPath
if ($null -ne $lockOwnerPid) {
    $ownerProcess = Get-Process -Id $lockOwnerPid -ErrorAction SilentlyContinue
    if ($null -eq $ownerProcess) {
        Remove-Item -LiteralPath $lockPath -Force -ErrorAction SilentlyContinue
        Write-Host "Removed stale WeCom listener lock: $lockPath"
    }
} elseif (Test-Path -LiteralPath $lockPath) {
    Remove-Item -LiteralPath $lockPath -Force -ErrorAction SilentlyContinue
    Write-Host "Removed unreadable WeCom listener lock: $lockPath"
}

