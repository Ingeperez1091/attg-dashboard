param(
    [string]$ServerInstance = ".\SQLEXPRESS",
    [string]$Database = "ATTG_Usage",
    [string]$ConnectionString,
    [string]$Username,
    [string]$Password,
    [int]$From = 29,
    [int]$To = 6,
    [switch]$UseTrustedConnection,
    [string]$SqlCmdPath = "C:\Program Files\Microsoft SQL Server\Client SDK\ODBC\180\Tools\Binn\SQLCMD.EXE",
    [switch]$TrustServerCertificate = $true,
    [bool]$QuotedIdentifierOn = $true
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Resolve-ConnectionSettings {
    if (-not $ConnectionString) {
        return
    }

    $builder = [System.Data.SqlClient.SqlConnectionStringBuilder]::new($ConnectionString)

    if (-not $PSBoundParameters.ContainsKey("ServerInstance") -and -not [string]::IsNullOrWhiteSpace($builder.DataSource)) {
        $script:ServerInstance = $builder.DataSource
    }

    if (-not $PSBoundParameters.ContainsKey("Database") -and -not [string]::IsNullOrWhiteSpace($builder.InitialCatalog)) {
        $script:Database = $builder.InitialCatalog
    }

    if ($builder.IntegratedSecurity) {
        $script:UseTrustedConnection = $true
    } elseif (-not [string]::IsNullOrWhiteSpace($builder.UserID) -and -not [string]::IsNullOrWhiteSpace($builder.Password)) {
        if (-not $PSBoundParameters.ContainsKey("Username")) {
            $script:Username = $builder.UserID
        }
        if (-not $PSBoundParameters.ContainsKey("Password")) {
            $script:Password = $builder.Password
        }
    }

    if ($builder.ContainsKey("TrustServerCertificate") -and -not $PSBoundParameters.ContainsKey("TrustServerCertificate")) {
        $script:TrustServerCertificate = [bool]$builder.TrustServerCertificate
    }
}

function Validate-AuthenticationSettings {
    if ($UseTrustedConnection -and ($PSBoundParameters.ContainsKey("Username") -or $PSBoundParameters.ContainsKey("Password"))) {
        throw "Specify either trusted auth (-UseTrustedConnection) or SQL auth (-Username/-Password), not both."
    }

    if (($PSBoundParameters.ContainsKey("Username") -and -not $PSBoundParameters.ContainsKey("Password")) -or
        ($PSBoundParameters.ContainsKey("Password") -and -not $PSBoundParameters.ContainsKey("Username"))) {
        throw "Both -Username and -Password are required together for SQL authentication."
    }

    if (-not $UseTrustedConnection -and ($PSBoundParameters.ContainsKey("Username") -and $PSBoundParameters.ContainsKey("Password"))) {
        return
    }

    if (-not $UseTrustedConnection -and $ConnectionString) {
        $hasUser = -not [string]::IsNullOrWhiteSpace($Username)
        $hasPass = -not [string]::IsNullOrWhiteSpace($Password)
        if ($hasUser -and $hasPass) {
            return
        }
    }
}

Resolve-ConnectionSettings
Validate-AuthenticationSettings

if ($SqlCmdPath -in @("True", "False")) {
    if (-not $PSBoundParameters.ContainsKey("TrustServerCertificate")) {
        $TrustServerCertificate = [bool]::Parse($SqlCmdPath)
    }

    $SqlCmdPath = "C:\Program Files\Microsoft SQL Server\Client SDK\ODBC\180\Tools\Binn\SQLCMD.EXE"
}

if (-not (Test-Path -LiteralPath $SqlCmdPath)) {
    $resolvedSqlCmd = Get-Command sqlcmd -ErrorAction SilentlyContinue
    if ($resolvedSqlCmd) {
        $SqlCmdPath = $resolvedSqlCmd.Source
    }
}

if (-not (Test-Path -LiteralPath $SqlCmdPath)) {
    throw "sqlcmd executable was not found at '$SqlCmdPath'."
}

if ($From -lt $To) {
    throw "From must be greater than or equal to To for rollback."
}

$rollbackPath = Resolve-Path (Join-Path $PSScriptRoot "..\\..\\database\\rollback")

Push-Location $rollbackPath
try {
    for ($i = $From; $i -ge $To; $i--) {
        $pattern = "rollback_{0:D3}_*.sql" -f $i
        $match = Get-ChildItem -Path . -Filter $pattern | Select-Object -First 1
        if (-not $match) {
            Write-Host "[WARN ] Rollback file missing for index $i ($pattern), skipping."
            continue
        }

        Write-Host "[INFO ] Rolling back with $($match.Name)"
        $sqlcmdParams = @("-b", "-S", $ServerInstance, "-d", $Database, "-i", $match.Name)
        if ($UseTrustedConnection) {
            $sqlcmdParams += "-E"
        } elseif (-not [string]::IsNullOrWhiteSpace($Username) -and -not [string]::IsNullOrWhiteSpace($Password)) {
            $sqlcmdParams += @("-U", $Username, "-P", $Password)
        }
        if ($TrustServerCertificate) {
            $sqlcmdParams += "-C"
        }
        if ($QuotedIdentifierOn) {
            $sqlcmdParams += "-I"
        }

        & $SqlCmdPath @sqlcmdParams
        if ($LASTEXITCODE -ne 0) {
            throw "Rollback failed: $($match.Name)"
        }
    }
}
finally {
    Pop-Location
}

Write-Host "[INFO ] Rollback run completed successfully."
