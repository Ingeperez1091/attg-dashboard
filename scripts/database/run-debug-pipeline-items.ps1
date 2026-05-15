param(
    [Parameter(Mandatory = $true)]
    [string]$RunId,
    [string]$ApplicationId = "",
    [string]$ServerInstance = ".\SQLEXPRESS",
    [string]$Database = "ATTG_Usage",
    [switch]$UseTrustedConnection,
    [string]$SqlCmdPath = "C:\Program Files\Microsoft SQL Server\Client SDK\ODBC\180\Tools\Binn\SQLCMD.EXE",
    [bool]$TrustServerCertificate = $true,
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

$scriptPath = Resolve-Path (Join-Path $PSScriptRoot "debug-pipeline-items.sql")

Write-Host "[INFO ] Debugging run $RunId on $ServerInstance / $Database"

$args = @(
    "-b",
    "-S", $ServerInstance,
    "-d", $Database,
    "-i", $scriptPath,
    "-v", "RunId=$RunId"
)

if (-not [string]::IsNullOrWhiteSpace($ApplicationId)) {
    $args += "ApplicationId=$ApplicationId"
}

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
    throw "Debug pipeline items script failed."
}

Write-Host "[INFO ] Debug output completed successfully."
