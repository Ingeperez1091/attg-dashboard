Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

Write-Host "Integration scenario: lint failure"
Write-Host "1. Ensure src/frontend/package.json contains a lint script"
Write-Host "2. Introduce a known lint error in frontend code"
Write-Host "3. Open a PR and verify the 'Lint' check fails"
Write-Host "4. Confirm merge is blocked while check is failing"
