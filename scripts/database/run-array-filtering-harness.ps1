param(
    [string]$ServerInstance = ".\SQLEXPRESS",
    [string]$Database = "ATTG_Usage",
    [switch]$UseTrustedConnection,
    [string]$SqlCmdPath = "C:\Program Files\Microsoft SQL Server\Client SDK\ODBC\180\Tools\Binn\SQLCMD.EXE",
    [switch]$TrustServerCertificate,
    [bool]$QuotedIdentifierOn = $true
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

if (-not (Test-Path -LiteralPath $SqlCmdPath)) {
    $resolvedSqlCmd = Get-Command sqlcmd -ErrorAction SilentlyContinue
    if ($resolvedSqlCmd) {
        $SqlCmdPath = $resolvedSqlCmd.Source
    }
}

if (-not (Test-Path -LiteralPath $SqlCmdPath)) {
    throw "sqlcmd executable was not found at '$SqlCmdPath'."
}

$scriptPath = Resolve-Path (Join-Path $PSScriptRoot "validate-array-filtering-harness.sql")

Write-Host "[INFO ] Running array-filtering harness against $ServerInstance / $Database"

$args = @("-b", "-S", $ServerInstance, "-d", $Database, "-i", $scriptPath)
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
    throw "Array-filtering harness failed."
}

Write-Host "[INFO ] Array-filtering harness completed successfully."
