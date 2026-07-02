[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'

function Get-RepoRoot {
    return (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
}

function Find-ConfigFile {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Root,
        [string]$FileName,
        [string]$Filter = '*',
        [string]$ContentPattern
    )

    $searchRoots = New-Object System.Collections.Generic.List[string]
    $configRoot = Join-Path $Root '配置'

    if (Test-Path -LiteralPath $configRoot) {
        $null = $searchRoots.Add($configRoot)
    }

    $null = $searchRoots.Add($Root)

    $file = $null
    foreach ($searchRoot in $searchRoots) {
        # 启动脚本只需要在仓库配置区找少量文件，遍历时遇到 pnpm 虚拟目录、
        # 断链或权限异常时直接跳过，避免把本地启动整体打崩。
        $candidates = Get-ChildItem -LiteralPath $searchRoot -Recurse -File -Filter $Filter -ErrorAction SilentlyContinue
        foreach ($candidate in $candidates) {
            if (
                $candidate.FullName -like '*\node_modules\*' -or
                $candidate.FullName -like '*\.git\*' -or
                $candidate.FullName -like '*\dist\*'
            ) {
                continue
            }

            if ($FileName -and $candidate.Name -eq $FileName) {
                $file = $candidate
                break
            }

            if ($ContentPattern) {
                $content = Get-Content -Raw -Encoding UTF8 $candidate.FullName -ErrorAction SilentlyContinue
                if ($content -and $content -match $ContentPattern) {
                    $file = $candidate
                    break
                }
            }
        }

        if ($file) {
            break
        }
    }

    if (-not $file) {
        throw "Missing config file target: $FileName $Filter"
    }

    return $file.FullName
}

function TryFind-ConfigFile {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Root,
        [string]$FileName,
        [string]$Filter = '*',
        [string]$ContentPattern
    )

    try {
        return Find-ConfigFile -Root $Root -FileName $FileName -Filter $Filter -ContentPattern $ContentPattern
    }
    catch {
        return $null
    }
}

function Get-LineValue {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Content,
        [Parameter(Mandatory = $true)]
        [string]$Pattern
    )

    $match = [regex]::Match($Content, $Pattern, [System.Text.RegularExpressions.RegexOptions]::Multiline)
    if ($match.Success) {
        return $match.Groups[1].Value.Trim()
    }

    return $null
}

function Get-TomlValue {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Content,
        [Parameter(Mandatory = $true)]
        [string]$Key,
        [string]$Section
    )

    if ($Section) {
        $escapedSection = [regex]::Escape($Section)
        $sectionPattern = '^\[' + $escapedSection + '\]\s*$([\s\S]*?)(?=^\[|\z)'
        $sectionMatch = [regex]::Match(
            $Content,
            $sectionPattern,
            [System.Text.RegularExpressions.RegexOptions]::Multiline
        )
        if (-not $sectionMatch.Success) {
            return $null
        }

        $Content = $sectionMatch.Groups[1].Value
    }

    $escapedKey = [regex]::Escape($Key)
    $rawValue = Get-LineValue -Content $Content -Pattern ('^\s*' + $escapedKey + '\s*=\s*["'']?(.+?)["'']?\s*$')
    return $rawValue
}

function Set-EnvValue {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Name,
        [AllowNull()]
        [string]$Value
    )

    if (
        -not [string]::IsNullOrWhiteSpace($Value) -and
        [string]::IsNullOrWhiteSpace([Environment]::GetEnvironmentVariable($Name))
    ) {
        Set-Item -Path "Env:$Name" -Value $Value
    }
}

function Import-DotEnvFile {
    param(
        [Parameter(Mandatory = $true)]
        [string]$FilePath
    )

    if (-not (Test-Path -LiteralPath $FilePath)) {
        return
    }

    Get-Content -LiteralPath $FilePath -Encoding UTF8 | ForEach-Object {
        $line = $_.Trim()
        if (-not $line -or $line.StartsWith('#')) {
            return
        }

        $parts = $line -split '=', 2
        if ($parts.Length -ne 2) {
            return
        }

        $name = $parts[0].Trim()
        $value = $parts[1].Trim().Trim('"').Trim("'")
        if (-not [string]::IsNullOrWhiteSpace($name)) {
            Set-Item -Path "Env:$name" -Value $value
        }
    }
}

$repoRoot = Get-RepoRoot

Import-DotEnvFile -FilePath (Join-Path $repoRoot '.env.development.local')
Import-DotEnvFile -FilePath (Join-Path $repoRoot 'backend\.env.development.local')
Import-DotEnvFile -FilePath (Join-Path $repoRoot 'frontend\.env.development.local')
Import-DotEnvFile -FilePath (Join-Path $repoRoot '.env.local')
Import-DotEnvFile -FilePath (Join-Path $repoRoot 'backend\.env.local')
Import-DotEnvFile -FilePath (Join-Path $repoRoot 'frontend\.env.local')

$authPath = TryFind-ConfigFile -Root $repoRoot -FileName 'auth.json'
$tomlPath = TryFind-ConfigFile -Root $repoRoot -FileName 'config.toml'
$dbPath = TryFind-ConfigFile -Root $repoRoot -FileName '' -Filter '*.txt' -ContentPattern 'MySQL'
$wecomPath = TryFind-ConfigFile -Root $repoRoot -FileName '' -Filter '*.md' -ContentPattern 'Bot ID:'

$authJson = if ($authPath) { Get-Content -Raw -Encoding UTF8 $authPath | ConvertFrom-Json } else { $null }
$tomlContent = if ($tomlPath) { Get-Content -Raw -Encoding UTF8 $tomlPath } else { '' }
$dbContent = if ($dbPath) { Get-Content -Raw -Encoding UTF8 $dbPath } else { '' }
$wecomContent = if ($wecomPath) { Get-Content -Raw -Encoding UTF8 $wecomPath } else { '' }

$modelProvider = if ($tomlContent) { Get-TomlValue -Content $tomlContent -Key 'model_provider' } else { $null }
$model = if ($tomlContent) { Get-TomlValue -Content $tomlContent -Key 'model' } else { $null }
$reasoningEffort = if ($tomlContent) { Get-TomlValue -Content $tomlContent -Key 'model_reasoning_effort' } else { $null }
$baseUrl = if ($tomlContent -and $modelProvider) {
    Get-TomlValue -Content $tomlContent -Section "model_providers.$modelProvider" -Key 'base_url'
} else {
    $null
}

$colonPattern = '[:=' + [char]0xFF1A + ']'
$dbLines = if ($dbPath) {
    Get-Content -Encoding UTF8 $dbPath | Where-Object {
        $trim = $_.Trim()
        $trim -and -not $trim.StartsWith('<!--') -and -not $trim.StartsWith('*') -and -not $trim.StartsWith('-->')
    }
} else {
    @()
}
$dbValues = New-Object System.Collections.Generic.List[string]
foreach ($line in $dbLines) {
    $parts = $line -split $colonPattern, 2
    if ($parts.Length -eq 2) {
        $value = $parts[1].Trim()
        $null = $dbValues.Add($value)
    }
}
$dbName = if ($dbValues.Count -ge 1) { $dbValues[0] } else { $null }
$dbHost = if ($dbValues.Count -ge 2) { $dbValues[1] } else { $null }
$dbPort = if ($dbValues.Count -ge 3) { $dbValues[2] } else { $null }
$dbUser = if ($dbValues.Count -ge 4) { $dbValues[3] } else { $null }
$dbPassword = if ($dbValues.Count -ge 5) { $dbValues[4] } else { $null }

if ([string]::IsNullOrWhiteSpace($dbName) -or $dbName.Trim().ToLower() -eq 'mysql') {
    $dbName = 'vcooline_ikcrm_production'
}

$wecomBotId = if ($wecomContent) { Get-LineValue -Content $wecomContent -Pattern 'Bot ID:\s*(.+?)\s*$' } else { $null }
$wecomBotSecret = if ($wecomContent) { Get-LineValue -Content $wecomContent -Pattern 'Secret:\s*(.+?)\s*$' } else { $null }

Set-EnvValue -Name 'PORT' -Value '3001'
Set-EnvValue -Name 'ANALYSIS_AI_MODEL_PROVIDER' -Value $modelProvider
Set-EnvValue -Name 'ANALYSIS_AI_MODEL' -Value $model
Set-EnvValue -Name 'ANALYSIS_AI_REASONING_EFFORT' -Value $reasoningEffort
Set-EnvValue -Name 'ANALYSIS_AI_BASE_URL' -Value $baseUrl
Set-EnvValue -Name 'OPENAI_API_KEY' -Value $(if ($authJson) { [string]$authJson.OPENAI_API_KEY } else { $null })

Set-EnvValue -Name 'CRM_READONLY_DB_HOST' -Value $dbHost
Set-EnvValue -Name 'CRM_READONLY_DB_PORT' -Value $dbPort
Set-EnvValue -Name 'CRM_READONLY_DB_NAME' -Value $dbName
Set-EnvValue -Name 'CRM_READONLY_DB_USER' -Value $dbUser
Set-EnvValue -Name 'CRM_READONLY_DB_PASSWORD' -Value $dbPassword

Set-EnvValue -Name 'WECOM_BOT_ID' -Value $wecomBotId
Set-EnvValue -Name 'WECOM_BOT_SECRET' -Value $wecomBotSecret
Set-EnvValue -Name 'APP_WEB_BASE_URL' -Value 'http://127.0.0.1:5173'

Set-EnvValue -Name 'VITE_API_BASE_URL' -Value 'http://127.0.0.1:3001'
Set-EnvValue -Name 'VITE_APP_BASE_PATH' -Value '/'

if (-not [string]::IsNullOrWhiteSpace($env:CRM_WRITEBACK_DB_HOST)) {
    Set-Item -Path 'Env:CRM_READONLY_DB_HOST' -Value $env:CRM_WRITEBACK_DB_HOST
}
if (-not [string]::IsNullOrWhiteSpace($env:CRM_WRITEBACK_DB_PORT)) {
    Set-Item -Path 'Env:CRM_READONLY_DB_PORT' -Value $env:CRM_WRITEBACK_DB_PORT
}
if (-not [string]::IsNullOrWhiteSpace($env:CRM_WRITEBACK_DB_NAME)) {
    Set-Item -Path 'Env:CRM_READONLY_DB_NAME' -Value $env:CRM_WRITEBACK_DB_NAME
}
if (-not [string]::IsNullOrWhiteSpace($env:CRM_WRITEBACK_DB_USER)) {
    Set-Item -Path 'Env:CRM_READONLY_DB_USER' -Value $env:CRM_WRITEBACK_DB_USER
}
if (-not [string]::IsNullOrWhiteSpace($env:CRM_WRITEBACK_DB_PASSWORD)) {
    Set-Item -Path 'Env:CRM_READONLY_DB_PASSWORD' -Value $env:CRM_WRITEBACK_DB_PASSWORD
}

[PSCustomObject]@{
    ANALYSIS_AI_BASE_URL = -not [string]::IsNullOrWhiteSpace($env:ANALYSIS_AI_BASE_URL)
    ANALYSIS_AI_MODEL = -not [string]::IsNullOrWhiteSpace($env:ANALYSIS_AI_MODEL)
    OPENAI_API_KEY = -not [string]::IsNullOrWhiteSpace($env:OPENAI_API_KEY)
    CRM_READONLY_DB_HOST = -not [string]::IsNullOrWhiteSpace($env:CRM_READONLY_DB_HOST)
    CRM_READONLY_DB_NAME = -not [string]::IsNullOrWhiteSpace($env:CRM_READONLY_DB_NAME)
    CRM_READONLY_DB_USER = -not [string]::IsNullOrWhiteSpace($env:CRM_READONLY_DB_USER)
    CRM_WRITEBACK_DB_HOST = -not [string]::IsNullOrWhiteSpace($env:CRM_WRITEBACK_DB_HOST)
    CRM_WRITEBACK_DB_NAME = -not [string]::IsNullOrWhiteSpace($env:CRM_WRITEBACK_DB_NAME)
    CRM_WRITEBACK_DB_USER = -not [string]::IsNullOrWhiteSpace($env:CRM_WRITEBACK_DB_USER)
    WECOM_BOT_ID = -not [string]::IsNullOrWhiteSpace($env:WECOM_BOT_ID)
    WECOM_BOT_SECRET = -not [string]::IsNullOrWhiteSpace($env:WECOM_BOT_SECRET)
    WECOM_WEB_LOGIN_APP_ID = -not [string]::IsNullOrWhiteSpace($env:WECOM_WEB_LOGIN_APP_ID)
    WECOM_WEB_LOGIN_AGENT_ID = -not [string]::IsNullOrWhiteSpace($env:WECOM_WEB_LOGIN_AGENT_ID)
    WECOM_WEB_LOGIN_SECRET = -not [string]::IsNullOrWhiteSpace($env:WECOM_WEB_LOGIN_SECRET)
    WECOM_DIRECTORY_AGENT_ID = -not [string]::IsNullOrWhiteSpace($env:WECOM_DIRECTORY_AGENT_ID)
    WECOM_DIRECTORY_SECRET = -not [string]::IsNullOrWhiteSpace($env:WECOM_DIRECTORY_SECRET)
    CRM_OPEN_API_BASE_URL = -not [string]::IsNullOrWhiteSpace($env:CRM_OPEN_API_BASE_URL)
    VITE_API_BASE_URL = $env:VITE_API_BASE_URL
    VITE_APP_BASE_PATH = $env:VITE_APP_BASE_PATH
} | ConvertTo-Json -Depth 3
