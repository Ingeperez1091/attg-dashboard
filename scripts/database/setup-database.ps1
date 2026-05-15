param(
    [string]$Server = ".\SQLEXPRESS",
    [string]$Instance = ".\SQLEXPRESS",

    [string]$Database = "ATTG_Usage",
    [string]$SqlCmdPath = "C:\Program Files\Microsoft SQL Server\Client SDK\ODBC\180\Tools\Binn\SQLCMD.EXE",
    [switch]$UseTrustedConnection = $true,
    [switch]$TrustServerCertificate = $true,
    [switch]$QuotedIdentifierOn = $true,
    [pscredential]$Credential,

    [bool]$InstallSqlCmdIfMissing = $true,
    [bool]$CreateSqlProject = $true,

    [string]$SqlProjectPath = "database/sqlproject",
    [string]$MigrationsPath = "database/migrations"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\.." )).Path

function Resolve-RepoPath([string]$RelativePath) {
    return (Resolve-Path (Join-Path $RepoRoot $RelativePath)).Path
}

function Write-Info([string]$Message) {
    Write-Host "[INFO ] $Message"
}

function Write-WarnLine([string]$Message) {
    Write-Host "[WARN ] $Message" -ForegroundColor Yellow
}

function Install-SqlCmdIfNeeded {
    if (Get-Command sqlcmd -ErrorAction SilentlyContinue) {
        Write-Info "sqlcmd found on PATH."
        return
    }

    if (-not $InstallSqlCmdIfMissing) {
        throw "sqlcmd not found and automatic installation is disabled."
    }

    Write-Info "sqlcmd not found. Attempting install..."

    if (Get-Command winget -ErrorAction SilentlyContinue) {
        & winget install --id Microsoft.Sqlcmd -e --accept-package-agreements --accept-source-agreements
        if ($LASTEXITCODE -ne 0) {
            throw "winget failed to install Microsoft.Sqlcmd."
        }
    } else {
        throw "winget not available. Install sqlcmd manually and rerun."
    }

    if (-not (Get-Command sqlcmd -ErrorAction SilentlyContinue)) {
        throw "sqlcmd installation did not succeed."
    }

    Write-Info "sqlcmd installed successfully."
}

function Start-SqlServices {
    try {
        $sqlService = Get-Service -Name "MSSQL`$SQLEXPRESS" -ErrorAction Stop
        if ($sqlService.Status -ne "Running") {
            Start-Service -Name "MSSQL`$SQLEXPRESS" -ErrorAction Stop
        }
    } catch {
        Write-Warning "Could not start MSSQL`$SQLEXPRESS automatically. Continuing and relying on reachable instance '$Instance'."
    }

    $browser = Get-Service -Name "SQLBrowser" -ErrorAction SilentlyContinue
    if ($null -ne $browser) {
        if ($browser.StartType -eq "Disabled") {
            Write-WarnLine "SQLBrowser is disabled. Changing startup type to Manual."
            Set-Service -Name "SQLBrowser" -StartupType Manual
        }
        if ($browser.Status -ne "Running") {
            Write-Info "Starting SQLBrowser service."
            Start-Service -Name "SQLBrowser"
        }
        Write-Info "SQLBrowser service is running."
    } else {
        Write-WarnLine "SQLBrowser service not found on this machine."
    }
}

function Initialize-Instance {

    if ($Server -like "*\\*") {
        if (-not (Get-Command sqllocaldb -ErrorAction SilentlyContinue)) {
            throw "sqllocaldb is required for LocalDB server targets."
        }

        $instanceName = $Server.Split('\\')[1]
        Write-Info "Ensuring LocalDB instance $instanceName is started."
        & sqllocaldb i $instanceName | Out-Null
        & sqllocaldb s $instanceName | Out-Null
    }
}

function Invoke-SqlCmdWithAuth {
    param(
        [Parameter(Mandatory = $true)]
        [string]$QueryOrFile,
        [switch]$IsFile,
        [switch]$DatabaseOptional
    )

    $base = @("-S", $Server)
    if (-not $DatabaseOptional) {
        $base += @("-d", $Database)
    }

    if ($IsFile) {
        $base += @("-i", $QueryOrFile)
    } else {
        $base += @("-Q", $QueryOrFile)
    }

    Write-Host "base '$base' ..."

    if ($UseTrustedConnection) {
        if ($Credential) {
            Write-Host "Credential '$Credential' ..."
            if ($TrustServerCertificate) {
                $base += "-C"
            }
            $argLine = ($base + "-E") -join " "
            $proc = Start-Process -FilePath $sqlcmdPath -ArgumentList $argLine -Credential $Credential -Wait -NoNewWindow -PassThru
            if ($proc.ExitCode -ne 0) {
                throw "sqlcmd failed with exit code $($proc.ExitCode)."
            }
        } else {
            & $SqlCmdPath "-b" @base -E
            if ($LASTEXITCODE -ne 0) {
                throw "sqlcmd failed with exit code $LASTEXITCODE."
            }
        }
    } else {
        throw "This setup script requires -UseTrustedConnection for Windows-auth deployment."
    }
}

function Invoke-SqlCmd {
  param(
    [string[]]$Arguments,
    [string]$Context
  )

  & $SqlCmdPath "-b" @Arguments
  if ($LASTEXITCODE -ne 0) {
    throw "sqlcmd failed during: $Context"
  }
}

function Test-ServerConnection {

Write-Host "Waiting for SQL instance '$Instance' to accept connections..."
$connected = $false
for ($i = 1; $i -le 15; $i++) {
  & $SqlCmdPath "-b" @sqlcmdFlags -Q "SELECT 1;" *> $null
  if ($LASTEXITCODE -eq 0) {
    $connected = $true
    Write-Host "SQL instance '$Instance' is accepting connections."
    break
  }

  Start-Sleep -Seconds 2

  }
  if (-not $connected) {
  throw "Unable to connect to SQL instance '$Instance'."
}
    
}

function Initialize-Database {
    Write-Info "Ensuring database [$Database] exists..."
    Invoke-SqlCmd -Arguments ($sqlcmdFlags + @("-Q", "IF DB_ID('$Database') IS NULL CREATE DATABASE [$Database];")) -Context "create database"
}

function Invoke-DeploymentScripts {
    $ordered = @(
        "001_create_schemas.sql",
        "002_create_audit_conventions.sql",
        "003_create_app_schema_objects.sql",
        "004_create_stage_engagement_usage_raw.sql",
        "005_run_seed_scripts.sql"
    )

    $fullMigrationPath = Resolve-RepoPath $MigrationsPath
    Write-Host 'Full migration path: ' $fullMigrationPath
    Push-Location $fullMigrationPath
    try {
        foreach ($script in $ordered) {
            if (-not (Test-Path $script)) {
                throw "Required migration script not found: $script"
            }
            Write-Info "Executing migration script: $script"
            
            Invoke-SqlCmd -Arguments ($sqlcmdFlags + @("-d", $Database, "-i", $script)) -Context "apply $script"
        }
    } finally {
        Pop-Location
    }

    $validationScript = Resolve-RepoPath "database/views/external-access-validation.sql"
    Write-Info "Executing validation script: $validationScript"
    
    Invoke-SqlCmd -Arguments ($sqlcmdFlags + @("-d", $Database, "-i", $validationScript)) -Context "apply $validationScript"
}

function Save-AsSqlProject {
    if (-not $CreateSqlProject) {
        return
    }

    $targetRoot = Join-Path $RepoRoot $SqlProjectPath

    if (-not (Test-Path $targetRoot)) {
        New-Item -Path $targetRoot -ItemType Directory | Out-Null
    }

    foreach ($dir in @("migrations", "schema", "seed", "views", "snapshot")) {
        $dest = Join-Path $targetRoot $dir
        if (-not (Test-Path $dest)) {
            New-Item -Path $dest -ItemType Directory | Out-Null
        }
    }

    Write-Info "Copying SQL source files into SQL project folder."
    Copy-Item (Join-Path $RepoRoot "database/migrations/*.sql") -Destination (Join-Path $targetRoot "migrations") -Force
    Copy-Item (Join-Path $RepoRoot "database/schema/app/*.sql") -Destination (Join-Path $targetRoot "schema") -Force
    Copy-Item (Join-Path $RepoRoot "database/schema/stage/*.sql") -Destination (Join-Path $targetRoot "schema") -Force
    Copy-Item (Join-Path $RepoRoot "database/seed/*.sql") -Destination (Join-Path $targetRoot "seed") -Force
    Copy-Item (Join-Path $RepoRoot "database/views/*.sql") -Destination (Join-Path $targetRoot "views") -Force

    $sqlProjPath = Join-Path $targetRoot "DatabaseFoundation.sqlproj"
    if (-not (Test-Path $sqlProjPath)) {
        @"
<Project Sdk=\"Microsoft.Build.Sql/project-sdk\">
  <PropertyGroup>
    <Name>DatabaseFoundation</Name>
    <TargetFramework>net8.0</TargetFramework>
    <SqlServerVersion>Sql150</SqlServerVersion>
  </PropertyGroup>
</Project>
"@ | Set-Content -Path $sqlProjPath -Encoding UTF8
    }

    $sqlPackage = Get-Command sqlpackage -ErrorAction SilentlyContinue
    if ($sqlPackage) {
        $dacpacPath = Join-Path $targetRoot "snapshot/DatabaseFoundation.dacpac"
        Write-Info "Extracting dacpac snapshot with sqlpackage."
        & $sqlPackage.Source /Action:Extract /SourceServerName:$Server /SourceDatabaseName:$Database /TargetFile:$dacpacPath
        if ($LASTEXITCODE -ne 0) {
            Write-WarnLine "sqlpackage extract failed. Source scripts were still copied to SQL project folder."
        }
    } else {
        Write-WarnLine "sqlpackage not found. Skipping dacpac extraction."
    }

    Write-Info "SQL project saved to: $targetRoot"
}

Write-Info "Starting database setup workflow..."
Install-SqlCmdIfNeeded
Start-SqlServices
Initialize-Instance

$script:sqlcmdFlags = @("-S", $Server)
if ($UseTrustedConnection) {
    $script:sqlcmdFlags += "-E"
}

if ($TrustServerCertificate) {
    $script:sqlcmdFlags += "-C"
}

if ($QuotedIdentifierOn) {
    $script:sqlcmdFlags += @("-I")
}

Test-ServerConnection
Initialize-Database
Invoke-DeploymentScripts
# Save-AsSqlProject

Write-Info "Database setup completed successfully."