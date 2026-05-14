Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$workflow = Get-Content ".github/workflows/ci.yml" -Raw
if ($workflow -notmatch 'NODE_VERSION:\s*"20\.x"|NODE_VERSION:\s*''20\.x''') {
    throw "Expected NODE_VERSION to be pinned to 20.x in workflow"
}

Write-Host "Contract passed: workflow Node runtime is pinned to 20.x"
