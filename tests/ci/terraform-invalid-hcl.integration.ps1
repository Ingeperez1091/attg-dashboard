Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

Write-Host "Integration scenario: invalid Terraform HCL"
Write-Host "1. Create or edit infra/terraform/*.tf with invalid syntax"
Write-Host "2. Open a PR and verify 'Terraform Validate' fails"
Write-Host "3. Fix the syntax and verify the check passes"
Write-Host "4. Remove infra/terraform and verify the job is skipped with notice"
