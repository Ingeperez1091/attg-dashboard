Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$workflow = Get-Content ".github/workflows/ci.yml" -Raw
if ($workflow -notmatch "has_terraform") {
    throw "Expected capability output has_terraform in workflow"
}
if ($workflow -notmatch "Skip \(IaC not available yet\)") {
    throw "Expected skip notice for missing IaC"
}

Write-Host "Contract passed: Terraform conditional behavior is configured"
