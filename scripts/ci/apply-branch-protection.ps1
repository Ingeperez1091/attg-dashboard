param(
    [Parameter(Mandatory=$true)][string]$Owner,
    [Parameter(Mandatory=$true)][string]$Repo,
    [string[]]$Branches = @("main", "develop", "master")
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$requiredContexts = @("Lint", "TypeScript Type Check", "Unit Tests", "Dependency Security")

foreach ($branch in $Branches) {
    $body = @{
        required_status_checks = @{
            strict = $true
            contexts = $requiredContexts
        }
        enforce_admins = $true
        required_pull_request_reviews = @{
            required_approving_review_count = 1
            dismiss_stale_reviews = $true
        }
        restrictions = $null
        allow_force_pushes = $false
        allow_deletions = $false
    } | ConvertTo-Json -Depth 10

    try {
        $body | gh api --method PUT "repos/$Owner/$Repo/branches/$branch/protection" --input - | Out-Null
        Write-Host "Applied branch protection for $branch"
    } catch {
        Write-Warning "Could not apply protection for $branch (branch may not exist yet): $($_.Exception.Message)"
    }
}
