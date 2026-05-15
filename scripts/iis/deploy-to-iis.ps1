# PowerShell Script to Deploy Next.js App to IIS
# Run as Administrator
# Usage: .\scripts\iis\deploy-to-iis.ps1 -AppName "AttDashboard" -AppPath "C:\inetpub\wwwroot\att-dashboard" -EntraIdId "..." -EntraIdSecret "..." -EntraIdTenantId "..."

param(
    [Parameter(Mandatory = $true)]
    [string]$AppName = "AttDashboard",
    
    [Parameter(Mandatory = $true)]
    [string]$AppPath = "C:\inetpub\wwwroot\att-dashboard",
    
    [Parameter(Mandatory = $true)]
    [string]$SourcePath = ".",
    
    [Parameter(Mandatory = $true)]
    [string]$EntraIdId,
    
    [Parameter(Mandatory = $true)]
    [string]$EntraIdSecret,
    
    [Parameter(Mandatory = $true)]
    [string]$EntraIdTenantId,
    
    [string]$AuthUrl = "http://localhost",
    
    [string]$AuthSecret = "changeme-generate-with-openssl-rand-base64-32",
    
    [string]$Port = 80,
    
    [string]$Hostname = "localhost"
)

$ErrorActionPreference = "Stop"

function Set-OrAddEnvVar {
    param(
        [Parameter(Mandatory = $true)]
        [string]$FilePath,

        [Parameter(Mandatory = $true)]
        [string]$Key,

        [Parameter(Mandatory = $true)]
        [string]$Value
    )

    $escapedKey = [Regex]::Escape($Key)
    $updated = $false
    $lines = @()

    if (Test-Path $FilePath) {
        $lines = Get-Content -Path $FilePath
    }

    $newLines = @()
    foreach ($line in $lines) {
        if ($line -match "^\s*$escapedKey\s*=") {
            $newLines += "$Key=$Value"
            $updated = $true
        }
        else {
            $newLines += $line
        }
    }

    if (-not $updated) {
        if ($newLines.Count -gt 0 -and $newLines[-1] -ne "") {
            $newLines += ""
        }
        $newLines += "$Key=$Value"
    }

    Set-Content -Path $FilePath -Value $newLines
}

try {
    Import-Module WebAdministration -ErrorAction Stop
}
catch {
    Write-Host "ERROR: WebAdministration module is not available. Install IIS Management Scripts and Tools feature." -ForegroundColor Red
    exit 1
}

Write-Host "========================================" -ForegroundColor Green
Write-Host "IIS Deployment Script for Next.js App" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""

# Check if running as Administrator
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole] "Administrator")
if (-not $isAdmin) {
    Write-Host "ERROR: This script must run as Administrator" -ForegroundColor Red
    exit 1
}

Write-Host "[1/8] Checking IIS Installation..." -ForegroundColor Cyan
$iisFeature = Get-WindowsOptionalFeature -Online -FeatureName IIS-WebServer -ErrorAction SilentlyContinue
if ($iisFeature.State -ne "Enabled") {
    Write-Host "ERROR: IIS is not installed. Please install IIS first." -ForegroundColor Red
    Write-Host "See scripts/iis/IIS_DEPLOYMENT_GUIDE.md for installation steps." -ForegroundColor Yellow
    exit 1
}
Write-Host "[OK] IIS is installed" -ForegroundColor Green

Write-Host ""
Write-Host "[2/8] Checking IISNode Installation..." -ForegroundColor Cyan
$iisNodePath = "C:\Program Files\iisnode"
if (-not (Test-Path $iisNodePath)) {
    Write-Host "ERROR: IISNode is not installed." -ForegroundColor Red
    Write-Host "Download from: https://github.com/azure/iisnode/releases" -ForegroundColor Yellow
    exit 1
}
Write-Host "[OK] IISNode is installed" -ForegroundColor Green

Write-Host ""
Write-Host "[3/8] Creating Application Directory..." -ForegroundColor Cyan
if (-not (Test-Path $AppPath)) {
    New-Item -ItemType Directory -Path $AppPath -Force | Out-Null
    Write-Host "[OK] Created directory: $AppPath" -ForegroundColor Green
}
else {
    Write-Host "[OK] Directory exists: $AppPath" -ForegroundColor Green
}

Write-Host ""
Write-Host "[4/8] Copying Application Files..." -ForegroundColor Cyan
$sourceAppPath = Join-Path $SourcePath "src\frontend"
$standaloneAppPath = Join-Path $sourceAppPath ".next\standalone\src\frontend"
if (-not (Test-Path (Join-Path $standaloneAppPath "server.js"))) {
    Write-Host "ERROR: Standalone build output not found. Run 'npm run build' first." -ForegroundColor Red
    Write-Host "Expected: $standaloneAppPath\server.js" -ForegroundColor Yellow
    exit 1
}

# Copy standalone application files.
# Next.js emits server.js at .next\standalone\src\frontend\server.js in this repo layout.
$itemsToCopy = @(".next", "server.js", "package.json")
foreach ($item in $itemsToCopy) {
    $srcItem = Join-Path $standaloneAppPath $item
    if (Test-Path $srcItem) {
        Write-Host "  Copying $item..." -ForegroundColor Gray
        Copy-Item -Path $srcItem -Destination $AppPath -Recurse -Force | Out-Null
    }
}

# Force CommonJS entrypoint because standalone package.json may set type=module.
$serverJsPath = Join-Path $AppPath "server.js"
if (Test-Path $serverJsPath) {
    $serverCjsPath = Join-Path $AppPath "server.cjs"
    Copy-Item -Path $serverJsPath -Destination $serverCjsPath -Force | Out-Null

    # IISNode sets PORT to a named pipe string; parseInt(PORT) breaks this flow.
    # Rewrite the emitted standalone entrypoint so Node listens on the provided value.
    $serverContent = Get-Content -Path $serverCjsPath -Raw
    $updatedServerContent = $serverContent -replace "const currentPort = parseInt\(process\.env\.PORT, 10\) \|\| 3000", "const currentPort = process.env.PORT || 3000"
    if ($updatedServerContent -ne $serverContent) {
        Set-Content -Path $serverCjsPath -Value $updatedServerContent -NoNewline
        Write-Host "  Patched server.cjs for IIS named-pipe PORT binding" -ForegroundColor Gray
    }

    Write-Host "  Created server.cjs runtime entrypoint" -ForegroundColor Gray
}

# node_modules is one level up from standalone app folder.
$standaloneNodeModules = Join-Path $sourceAppPath ".next\standalone\node_modules"
if (Test-Path $standaloneNodeModules) {
    Write-Host "  Copying node_modules..." -ForegroundColor Gray
    Copy-Item -Path $standaloneNodeModules -Destination $AppPath -Recurse -Force | Out-Null
}

# Next standalone output does not include browser assets under .next/static.
# Copy static assets from the main build output so CSS/JS chunks are served by IIS.
$buildStaticPath = Join-Path $sourceAppPath ".next\static"
if (Test-Path $buildStaticPath) {
    $targetStaticPath = Join-Path $AppPath ".next\static"
    if (-not (Test-Path $targetStaticPath)) {
        New-Item -ItemType Directory -Path $targetStaticPath -Force | Out-Null
    }
    Write-Host "  Copying .next/static..." -ForegroundColor Gray
    Copy-Item -Path (Join-Path $buildStaticPath "*") -Destination $targetStaticPath -Recurse -Force | Out-Null
}

# Public assets come from source frontend folder.
$publicPath = Join-Path $sourceAppPath "public"
if (Test-Path $publicPath) {
    Write-Host "  Copying public..." -ForegroundColor Gray
    Copy-Item -Path $publicPath -Destination $AppPath -Recurse -Force | Out-Null
}

# Copy web.config
$webConfigSrc = Join-Path $sourceAppPath "web.config"
if (Test-Path $webConfigSrc) {
    Copy-Item -Path $webConfigSrc -Destination $AppPath -Force | Out-Null
    Write-Host "  Copying web.config..." -ForegroundColor Gray
}
Write-Host "[OK] Files copied to: $AppPath" -ForegroundColor Green

Write-Host ""
Write-Host "[4.5/8] Updating Deployed .env.local Auth Settings..." -ForegroundColor Cyan
$deployedEnvPath = Join-Path $AppPath ".env.local"
if (-not (Test-Path $deployedEnvPath)) {
    New-Item -ItemType File -Path $deployedEnvPath -Force | Out-Null
}

Set-OrAddEnvVar -FilePath $deployedEnvPath -Key "AUTH_URL" -Value $AuthUrl
Set-OrAddEnvVar -FilePath $deployedEnvPath -Key "AUTH_SECRET" -Value $AuthSecret
Set-OrAddEnvVar -FilePath $deployedEnvPath -Key "AUTH_MICROSOFT_ENTRA_ID_ID" -Value $EntraIdId
Set-OrAddEnvVar -FilePath $deployedEnvPath -Key "AUTH_MICROSOFT_ENTRA_ID_SECRET" -Value $EntraIdSecret
Set-OrAddEnvVar -FilePath $deployedEnvPath -Key "AUTH_MICROSOFT_ENTRA_ID_TENANT_ID" -Value $EntraIdTenantId
Set-OrAddEnvVar -FilePath $deployedEnvPath -Key "ENABLE_DEV_BYPASS" -Value "false"
##Set-OrAddEnvVar -FilePath $deployedEnvPath -Key "DEV_SESSION_USER_ID" -Value ""
Set-OrAddEnvVar -FilePath $deployedEnvPath -Key "AUTH_DEBUG_SSO" -Value "false"
Write-Host "[OK] Updated deployed auth env file: $deployedEnvPath" -ForegroundColor Green

Write-Host ""
Write-Host "[5/8] Creating Application Pool..." -ForegroundColor Cyan
$poolName = "${AppName}Pool"
$poolPath = "IIS:\AppPools\$poolName"
$pool = Get-Item $poolPath -ErrorAction SilentlyContinue

if ($null -eq $pool) {
    New-WebAppPool -Name $poolName | Out-Null
    $pool = Get-Item $poolPath
    Write-Host "[OK] Created application pool: $poolName" -ForegroundColor Green
}
else {
    Write-Host "[OK] Application pool exists: $poolName" -ForegroundColor Green
}

# Configure application pool
Write-Host "  Configuring app pool..." -ForegroundColor Gray
Set-ItemProperty -Path $poolPath -Name "managedRuntimeVersion" -Value ""
Set-ItemProperty -Path $poolPath -Name "processModel.identityType" -Value "ApplicationPoolIdentity"
Set-ItemProperty -Path $poolPath -Name "processModel.maxProcesses" -Value 1
Set-ItemProperty -Path $poolPath -Name "recycling.periodicRestart.time" -Value ([TimeSpan]::FromHours(29))
Set-ItemProperty -Path $poolPath -Name "recycling.periodicRestart.privateMemory" -Value 524288

Write-Host ""
Write-Host "[6/8] Creating IIS Website..." -ForegroundColor Cyan
$site = Get-Website -Name $AppName -ErrorAction SilentlyContinue

if ($null -eq $site) {
    New-Website -Name $AppName -PhysicalPath $AppPath -Port ([int]$Port) -HostHeader $Hostname -ApplicationPool $poolName | Out-Null
    Write-Host "[OK] Created website: $AppName" -ForegroundColor Green
}
else {
    Write-Host "[OK] Website exists: $AppName" -ForegroundColor Green
}

# Assign app pool and physical path for existing sites
Set-ItemProperty -Path "IIS:\Sites\$AppName" -Name "applicationPool" -Value $poolName
Set-ItemProperty -Path "IIS:\Sites\$AppName" -Name "physicalPath" -Value $AppPath

# Ensure expected HTTP binding exists
$expectedBinding = "*:${Port}:${Hostname}"
$existingBinding = Get-WebBinding -Name $AppName -Protocol "http" -ErrorAction SilentlyContinue |
    Where-Object { $_.bindingInformation -eq $expectedBinding }
if ($null -eq $existingBinding) {
    New-WebBinding -Name $AppName -Protocol "http" -IPAddress "*" -Port ([int]$Port) -HostHeader $Hostname | Out-Null
}

Write-Host ""
Write-Host "[7/8] Setting Folder Permissions..." -ForegroundColor Cyan
$poolIdentity = "IIS AppPool\$poolName"
Write-Host "  Granting read permissions to: $poolIdentity" -ForegroundColor Gray
icacls $AppPath /grant "${poolIdentity}:(OI)(CI)(RX)" /T /C | Out-Null
Write-Host "[OK] Permissions set" -ForegroundColor Green

Write-Host ""
Write-Host "[8/8] Configuring Environment Variables..." -ForegroundColor Cyan
Write-Host "  IMPORTANT: Set these environment variables in the App Pool!" -ForegroundColor Yellow
Write-Host "  "
Write-Host "  In IIS Manager:" -ForegroundColor Yellow
Write-Host "    1. Application Pools -> AttDashboardPool -> Advanced Settings" -ForegroundColor Gray
Write-Host "    2. Section: Process Model -> Environment Variables" -ForegroundColor Gray
Write-Host "  "
Write-Host "  Required Variables:" -ForegroundColor Yellow
Write-Host "    AUTH_URL=$AuthUrl" -ForegroundColor Gray
Write-Host "    AUTH_SECRET=$AuthSecret" -ForegroundColor Gray
Write-Host "    AUTH_MICROSOFT_ENTRA_ID_ID=$EntraIdId" -ForegroundColor Gray
Write-Host "    AUTH_MICROSOFT_ENTRA_ID_SECRET=$EntraIdSecret" -ForegroundColor Gray
Write-Host "    AUTH_MICROSOFT_ENTRA_ID_TENANT_ID=$EntraIdTenantId" -ForegroundColor Gray
Write-Host "    NODE_ENV=production" -ForegroundColor Gray
Write-Host "  "

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "Deployment Complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Next Steps:" -ForegroundColor Cyan
Write-Host "  1. Open IIS Manager (inetmgr)" -ForegroundColor White
Write-Host "  2. Navigate to Application Pools -> $poolName -> Advanced Settings" -ForegroundColor White
Write-Host "  3. Find 'Environment Variables' and add:" -ForegroundColor White
Write-Host "     - AUTH_URL" -ForegroundColor Gray
Write-Host "     - AUTH_SECRET" -ForegroundColor Gray
Write-Host "     - AUTH_MICROSOFT_ENTRA_ID_ID" -ForegroundColor Gray
Write-Host "     - AUTH_MICROSOFT_ENTRA_ID_SECRET" -ForegroundColor Gray
Write-Host "     - AUTH_MICROSOFT_ENTRA_ID_TENANT_ID" -ForegroundColor Gray
Write-Host "     - NODE_ENV=production" -ForegroundColor Gray
Write-Host "  4. Click Start on the website to begin serving requests" -ForegroundColor White
Write-Host "  5. Test by opening: http://$Hostname/" -ForegroundColor White
Write-Host ""
Write-Host "Restart IIS (if needed):" -ForegroundColor Yellow
Write-Host "  iisreset /restart" -ForegroundColor Gray
Write-Host ""
Write-Host "View Logs:" -ForegroundColor Yellow
Write-Host "  IISNode: $AppPath\..\logs\" -ForegroundColor Gray
Write-Host "  IIS: C:\inetpub\logs\LogFiles\" -ForegroundColor Gray
Write-Host ""
