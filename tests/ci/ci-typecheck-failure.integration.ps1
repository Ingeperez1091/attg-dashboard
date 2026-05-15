Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

Write-Host "Integration scenario: type-check failure"
Write-Host "1. Ensure src/frontend/tsconfig.json exists"
Write-Host "2. Introduce an intentional TypeScript error"
Write-Host "3. Open a PR and verify 'TypeScript Type Check' fails"
Write-Host "4. Confirm merge is blocked while check is failing"
