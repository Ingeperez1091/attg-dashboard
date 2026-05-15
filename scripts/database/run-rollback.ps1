param(
    [string]$ServerInstance = ".\SQLEXPRESS",
    [string]$Database = "ATTG_Usage",
    [int]$From = 14,
    [int]$To = 6,
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
