Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$path = ".github/workflows/ci.yml"
if (-not (Test-Path $path)) { throw "Missing workflow: $path" }

$content = Get-Content $path -Raw
$required = @(
    "name: Lint",
    "name: TypeScript Type Check",
    "name: Unit Tests",
    "name: Terraform Validate"
)

$missing = @($required | Where-Object { $content -notmatch [regex]::Escape($_) })
if ($missing.Count -gt 0) {
    throw "Missing required check names: $($missing -join ', ')"
}

Write-Host "Contract passed: required check names are present"
