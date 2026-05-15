param(
    [string]$WorkflowPath = ".github/workflows/ci.yml"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

if (-not (Test-Path $WorkflowPath)) {
    throw "Workflow file not found: $WorkflowPath"
}

$raw = Get-Content -Path $WorkflowPath -Raw
if ([string]::IsNullOrWhiteSpace($raw)) {
    throw "Workflow YAML is empty: $WorkflowPath"
}

$requiredSnippets = @(
    "name: CI",
    "pull_request:",
    "concurrency:",
    "permissions:",
    "detect-capabilities:",
    "lint:",
    "type-check:",
    "test:",
    "terraform-validate:"
)

$missing = @()
foreach ($snippet in $requiredSnippets) {
    if ($raw -notmatch [regex]::Escape($snippet)) {
        $missing += $snippet
    }
}

if ($missing.Count -gt 0) {
    throw "Workflow YAML is missing required snippets: $($missing -join ', ')"
}

Write-Host "Workflow YAML basic validation passed: $WorkflowPath"
