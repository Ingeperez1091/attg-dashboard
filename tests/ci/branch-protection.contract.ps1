Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

param(
    [Parameter(Mandatory=$true)][string]$Owner,
    [Parameter(Mandatory=$true)][string]$Repo,
    [string]$Branch = "main"
)

$result = gh api "repos/$Owner/$Repo/branches/$Branch/protection" | ConvertFrom-Json
$contexts = @($result.required_status_checks.contexts)

if ($result.required_pull_request_reviews.required_approving_review_count -lt 1) {
    throw "Expected at least one required approving review"
}

foreach ($check in @("Lint","TypeScript Type Check","Unit Tests")) {
    if ($contexts -notcontains $check) {
        throw "Missing required status check: $check"
    }
}

Write-Host "Contract passed: branch protection policy is compliant for $Branch"
