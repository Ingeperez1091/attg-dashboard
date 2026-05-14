param(
    [string]$ServerInstance = ".\SQLEXPRESS",
    [string]$Database = "ATTG_Usage4",
    [int]$From = 6,
    [int]$To = 9,
    [switch]$UseTrustedConnection,
    [string]$SqlCmdPath = "C:\Program Files\Microsoft SQL Server\Client SDK\ODBC\180\Tools\Binn\SQLCMD.EXE",
    [switch]$TrustServerCertificate,
    [bool]$QuotedIdentifierOn = $true
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

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
