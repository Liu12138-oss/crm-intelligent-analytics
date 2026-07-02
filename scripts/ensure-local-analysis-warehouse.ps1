[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'

function Test-TcpPortOpen {
    param(
        [Parameter(Mandatory = $true)]
        [string]$HostName,
        [Parameter(Mandatory = $true)]
        [int]$Port
    )

    try {
        $client = [System.Net.Sockets.TcpClient]::new()
        $asyncResult = $client.BeginConnect($HostName, $Port, $null, $null)
        $connected = $asyncResult.AsyncWaitHandle.WaitOne(1000, $false)
        if ($connected) {
            $client.EndConnect($asyncResult)
        }
        $client.Close()
        return $connected
    } catch {
        return $false
    }
}

function Wait-TcpPortOpen {
    param(
        [Parameter(Mandatory = $true)]
        [string]$HostName,
        [Parameter(Mandatory = $true)]
        [int]$Port,
        [int]$TimeoutSeconds = 90
    )

    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
    while ((Get-Date) -lt $deadline) {
        if (Test-TcpPortOpen -HostName $HostName -Port $Port) {
            return $true
        }
        Start-Sleep -Seconds 2
    }

    return $false
}

function Test-LocalHostName {
    param([string]$HostName)

    $normalized = ''
    if ($null -ne $HostName) {
        $normalized = $HostName.Trim().ToLowerInvariant()
    }
    return $normalized -in @('127.0.0.1', 'localhost', '::1')
}

function Try-Start-DockerWarehouse {
    param(
        [Parameter(Mandatory = $true)]
        [string]$HostName,
        [Parameter(Mandatory = $true)]
        [int]$Port,
        [Parameter(Mandatory = $true)]
        [string]$Database,
        [Parameter(Mandatory = $true)]
        [string]$User,
        [Parameter(Mandatory = $true)]
        [string]$Password
    )

    $docker = Get-Command docker -ErrorAction SilentlyContinue
    if (-not $docker) {
        return $false
    }

    $containerName = 'crm-agent-analysis-mysql'
    if (-not [string]::IsNullOrWhiteSpace($env:ANALYSIS_WAREHOUSE_DOCKER_CONTAINER_NAME)) {
        $containerName = $env:ANALYSIS_WAREHOUSE_DOCKER_CONTAINER_NAME.Trim()
    }

    $image = 'mysql:8.4'
    if (-not [string]::IsNullOrWhiteSpace($env:ANALYSIS_WAREHOUSE_DOCKER_IMAGE)) {
        $image = $env:ANALYSIS_WAREHOUSE_DOCKER_IMAGE.Trim()
    }

    $volumeName = 'crm-agent-analysis-mysql-data'
    if (-not [string]::IsNullOrWhiteSpace($env:ANALYSIS_WAREHOUSE_DOCKER_VOLUME)) {
        $volumeName = $env:ANALYSIS_WAREHOUSE_DOCKER_VOLUME.Trim()
    }

    $rootPassword = $Password
    if (-not [string]::IsNullOrWhiteSpace($env:ANALYSIS_WAREHOUSE_DB_ROOT_PASSWORD)) {
        $rootPassword = $env:ANALYSIS_WAREHOUSE_DB_ROOT_PASSWORD
    }

    $existingContainer = & docker ps -a --filter "name=^/${containerName}$" --format '{{.Names}}' 2>$null
    if ($existingContainer -eq $containerName) {
        $runningContainer = & docker ps --filter "name=^/${containerName}$" --format '{{.Names}}' 2>$null
        if ($runningContainer -ne $containerName) {
            Write-Host "Starting local analysis warehouse container: $containerName"
            & docker start $containerName | Out-Null
        }
    } else {
        Write-Host "Creating local analysis warehouse container: $containerName"
        $dockerRunArgs = @(
            'run',
            '-d',
            '--name',
            $containerName,
            '-p',
            "${HostName}:${Port}:3306",
            '-e',
            "MYSQL_DATABASE=$Database",
            '-e',
            "MYSQL_USER=$User",
            '-e',
            "MYSQL_PASSWORD=$Password",
            '-e',
            "MYSQL_ROOT_PASSWORD=$rootPassword",
            '-v',
            "${volumeName}:/var/lib/mysql",
            $image,
            '--character-set-server=utf8mb4',
            '--collation-server=utf8mb4_unicode_ci'
        )
        & docker @dockerRunArgs | Out-Null
    }

    if (Wait-TcpPortOpen -HostName $HostName -Port $Port -TimeoutSeconds 90) {
        Write-Host "Local analysis warehouse is ready: ${HostName}:${Port}"
        return $true
    }

    Write-Warning "Docker analysis warehouse was started, but ${HostName}:${Port} is still not ready."
    return $false
}

function Try-Start-WindowsMysqlService {
    param(
        [Parameter(Mandatory = $true)]
        [string]$HostName,
        [Parameter(Mandatory = $true)]
        [int]$Port
    )

    $service = Get-Service -ErrorAction SilentlyContinue |
        Where-Object {
            $_.Name -match 'mysql|mariadb' -or $_.DisplayName -match 'mysql|mariadb'
        } |
        Select-Object -First 1

    if (-not $service) {
        return $false
    }

    if ($service.Status -ne 'Running') {
        Write-Host "Starting local MySQL/MariaDB service: $($service.Name)"
        try {
            Start-Service -Name $service.Name
        } catch {
            Write-Warning "Could not start local MySQL/MariaDB service: $($_.Exception.Message)"
            return $false
        }
    }

    if (Wait-TcpPortOpen -HostName $HostName -Port $Port -TimeoutSeconds 30) {
        Write-Host "Local MySQL/MariaDB port is ready: ${HostName}:${Port}"
        return $true
    }

    return $false
}

if ($env:ANALYSIS_WAREHOUSE_DB_AUTOSTART -eq 'false') {
    Write-Host 'Skipped local analysis warehouse autostart: ANALYSIS_WAREHOUSE_DB_AUTOSTART=false'
    return
}

if ($env:ANALYSIS_WAREHOUSE_SQLITE_ONLY -eq 'true') {
    Write-Host 'Skipped local analysis warehouse autostart: ANALYSIS_WAREHOUSE_SQLITE_ONLY=true'
    return
}

$hostName = '127.0.0.1'
if (-not [string]::IsNullOrWhiteSpace($env:ANALYSIS_WAREHOUSE_DB_HOST)) {
    $hostName = $env:ANALYSIS_WAREHOUSE_DB_HOST.Trim()
}

$port = 3306
if (-not [string]::IsNullOrWhiteSpace($env:ANALYSIS_WAREHOUSE_DB_PORT)) {
    $port = [int]$env:ANALYSIS_WAREHOUSE_DB_PORT
}

$database = $env:ANALYSIS_WAREHOUSE_DB_NAME
$user = $env:ANALYSIS_WAREHOUSE_DB_USER
$password = $env:ANALYSIS_WAREHOUSE_DB_PASSWORD

if (
    [string]::IsNullOrWhiteSpace($database) -or
    [string]::IsNullOrWhiteSpace($user) -or
    [string]::IsNullOrWhiteSpace($password)
) {
    Write-Warning 'Analysis warehouse config is incomplete. Check ANALYSIS_WAREHOUSE_DB_NAME, USER and PASSWORD.'
    return
}

if (-not (Test-LocalHostName -HostName $hostName)) {
    Write-Host "Analysis warehouse is not local. Skipped autostart: ${hostName}:${port}"
    return
}

if (Test-TcpPortOpen -HostName $hostName -Port $port) {
    Write-Host "Local analysis warehouse is already listening: ${hostName}:${port}"
    return
}

if (Try-Start-WindowsMysqlService -HostName $hostName -Port $port) {
    return
}

if (Try-Start-DockerWarehouse -HostName $hostName -Port $port -Database $database -User $user -Password $password) {
    return
}

Write-Warning "Could not autostart local analysis warehouse at ${hostName}:${port}. Docker or a local MySQL/MariaDB service is required. Backend will still start and use fallback paths."
