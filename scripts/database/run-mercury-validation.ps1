param(
    [Parameter(Mandatory = $true)]
    [string]$Server,

    [Parameter(Mandatory = $true)]
    [string]$Database,

    [pscredential]$Credential,
    [switch]$UseTrustedConnection,
    [switch]$TrustServerCertificate = $true,
    [int]$LoginTimeout = 15,
    [int]$QueryTimeout = 60
)

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\.." )).Path
$scriptPath = Join-Path $repoRoot 'database\views\mercury-validation-pass.sql'
if (-not (Test-Path $scriptPath)) {
    Write-Error "Validation SQL not found: $scriptPath"
    exit 1
}

$scriptPath = (Resolve-Path $scriptPath).Path

if (-not (Get-Command sqlcmd -ErrorAction SilentlyContinue)) {
    Write-Error 'sqlcmd is not available on PATH.'
    exit 1
}

Write-Host 'Running Mercury external validation...'

if ($UseTrustedConnection) {
    if ($Credential) {
        $sqlcmdPath = (Get-Command sqlcmd).Source
        $trustFlag = if ($TrustServerCertificate) { " -C" } else { "" }
        $sqlcmdArgString = "-b -S `"$Server`" -d `"$Database`" -l $LoginTimeout -t $QueryTimeout -i `"$scriptPath`" -E$trustFlag"

        Write-Host "Running trusted connection with alternate Windows credential: $($Credential.UserName)"

        $process = Start-Process -FilePath $sqlcmdPath -ArgumentList $sqlcmdArgString -Credential $Credential -Wait -NoNewWindow -PassThru
        $exitCode = $process.ExitCode
    } else {
        $sqlcmdArgs = @("-b", "-S", $Server, "-d", $Database, "-l", $LoginTimeout, "-t", $QueryTimeout, "-i", $scriptPath, "-E")
        if ($TrustServerCertificate) {
            $sqlcmdArgs += "-C"
        }
        & sqlcmd @sqlcmdArgs
        $exitCode = $LASTEXITCODE
    }
} else {
    if (-not $Credential) {
        $envUser = $env:MERCURY_SQL_USER
        $envSecret = $env:MERCURY_SQL_PASSWORD
        if ([string]::IsNullOrWhiteSpace($envUser) -or [string]::IsNullOrWhiteSpace($envSecret)) {
            Write-Error 'Provide -Credential, or set MERCURY_SQL_USER and MERCURY_SQL_PASSWORD.'
            exit 1
        }

        $secureSecret = ConvertTo-SecureString $envSecret -AsPlainText -Force
        $Credential = New-Object System.Management.Automation.PSCredential($envUser, $secureSecret)
    }

    $userName = $Credential.UserName
    $secretText = $Credential.GetNetworkCredential().Password

    $sqlcmdArgs = @("-b", "-S", $Server, "-d", $Database, "-l", $LoginTimeout, "-t", $QueryTimeout, "-i", $scriptPath, "-U", $userName, "-P", $secretText)
    if ($TrustServerCertificate) {
        $sqlcmdArgs += "-C"
    }
    & sqlcmd @sqlcmdArgs
    $exitCode = $LASTEXITCODE
}

if ($exitCode -ne 0) {
    Write-Error "Mercury validation failed with exit code $exitCode"
    exit $exitCode
}

Write-Host 'Mercury validation completed.'