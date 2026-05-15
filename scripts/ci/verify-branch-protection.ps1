param(
    [Parameter(Mandatory=$true)][string]$Owner,
    [Parameter(Mandatory=$true)][string]$Repo,
    [string[]]$Branches = @("main", "develop", "master")
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$expectedContexts = @("Lint", "TypeScript Type Check", "Unit Tests", "Dependency Security")

foreach ($branch in $Branches) {
    try {
        $result = gh api "repos/$Owner/$Repo/branches/$branch/protection" | ConvertFrom-Json
        $contexts = @($result.required_status_checks.contexts)
        Write-Host "Branch: $branch"
        Write-Host "  Require PR reviews: $($result.required_pull_request_reviews.required_approving_review_count)"
        Write-Host "  Dismiss stale reviews: $($result.required_pull_request_reviews.dismiss_stale_reviews)"
        Write-Host "  Enforce admins: $($result.enforce_admins.enabled)"
        Write-Host "  Required checks: $($contexts -join ', ')"

        $missingContexts = $expectedContexts | Where-Object { $_ -notin $contexts }
        if ($missingContexts.Count -gt 0) {
            Write-Warning "  Missing required checks: $($missingContexts -join ', ')"
        }
    } catch {
        Write-Warning "Could not read protection for $branch (branch may not exist yet): $($_.Exception.Message)"
    }
}
