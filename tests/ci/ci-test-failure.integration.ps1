Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

Write-Host "Integration scenario: test failure"
Write-Host "1. Ensure src/frontend/package.json contains a test script"
Write-Host "2. Add or modify a test to fail"
Write-Host "3. Open a PR and verify 'Unit Tests' fails"
Write-Host "4. Confirm merge is blocked while check is failing"
