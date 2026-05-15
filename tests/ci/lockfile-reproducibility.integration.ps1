Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$workflow = Get-Content ".github/workflows/ci.yml" -Raw
if ($workflow -notmatch "Install dependencies \(lockfile\)" -or $workflow -notmatch "npm ci") {
    throw "Expected lockfile install path using npm ci"
}
if ($workflow -notmatch "Install dependencies \(no lockfile\)" -or $workflow -notmatch "npm install") {
    throw "Expected fallback install path using npm install"
}

Write-Host "Integration passed: lockfile/fallback install strategy is present"
