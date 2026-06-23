param(
    [string]$ServerInstance = ".\SQLEXPRESS",
    [string]$Database = "ATTG_Usage",
    [string]$ConnectionString,
    [string]$Username,
    [string]$Password,
    [int]$From = 6,
    [int]$To = 29,
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

if ($From -gt $To) {
    throw "From must be less than or equal to To."
}

$migrationsPath = Resolve-Path (Join-Path $PSScriptRoot "..\\..\\database\\migrations")

Push-Location $migrationsPath
try {
    for ($i = $From; $i -le $To; $i++) {
        $pattern = "{0:D3}_*.sql" -f $i
        $match = Get-ChildItem -Path . -Filter $pattern | Select-Object -First 1
        if (-not $match) {
            throw "Migration file not found for index $i ($pattern)."
        }

        Write-Host "[INFO ] Applying $($match.Name)"
        $args = @("-b", "-S", $ServerInstance, "-d", $Database, "-i", $match.Name)
        if ($UseTrustedConnection) {
            $args += "-E"
        } elseif (-not [string]::IsNullOrWhiteSpace($Username) -and -not [string]::IsNullOrWhiteSpace($Password)) {
            $args += @("-U", $Username, "-P", $Password)
        }
        if ($TrustServerCertificate) {
            $args += "-C"
        }
        if ($QuotedIdentifierOn) {
            $args += "-I"
        }

        & $SqlCmdPath @args
        if ($LASTEXITCODE -ne 0) {
            throw "Migration failed: $($match.Name)"
        }
    }
}
finally {
    Pop-Location
}

Write-Host "[INFO ] Migration run completed successfully."
