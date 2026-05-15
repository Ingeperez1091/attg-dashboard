Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$workflowValidator = "./scripts/ci/validate-workflow-yaml.ps1"
if (Test-Path $workflowValidator) {
    & $workflowValidator
}

if (-not (Test-Path "src/frontend")) {
    Write-Host "Skipping frontend checks: src/frontend not found"
} else {
    # package.json is at the repo root; run all npm commands from here
    if (Test-Path "package-lock.json") {
        npm ci
    } else {
        npm install
    }

    $pkg = Get-Content "package.json" -Raw | ConvertFrom-Json

    if ($pkg.scripts.PSObject.Properties.Name -contains "lint") {
        npm run lint
    } else {
        Write-Host "Skipping lint: script not defined"
    }

    if (Test-Path "tsconfig.json") {
        npx tsc --noEmit
    } else {
        Write-Host "Skipping type-check: tsconfig.json not found"
    }

    if ($pkg.scripts.PSObject.Properties.Name -contains "test") {
        # vitest v4 writes diagnostic lines to stderr; temporarily lower
        # $ErrorActionPreference so PowerShell doesn't treat stderr from
        # node.exe as a fatal NativeCommandError. Exit code is checked explicitly.
        $prevEAP = $ErrorActionPreference
        $ErrorActionPreference = 'Continue'
        npm test -- --passWithNoTests 2>&1 | Out-Host
        $testExitCode = $LASTEXITCODE
        $ErrorActionPreference = $prevEAP
        if ($testExitCode -ne 0) {
            throw "npm test failed with exit code $testExitCode"
        }
    } else {
        Write-Host "Skipping tests: script not defined"
    }
}

if (-not (Test-Path "infra/terraform")) {
    Write-Host "Skipping Terraform checks: infra/terraform not found"
} else {
    $tfFiles = Get-ChildItem -Path "infra/terraform" -Filter "*.tf" -Recurse -ErrorAction SilentlyContinue
    if ($null -eq $tfFiles -or $tfFiles.Count -eq 0) {
        Write-Host "Skipping Terraform checks: no .tf files found"
    } else {
        Push-Location "infra/terraform"
        try {
            terraform init -backend=false
            terraform fmt -check -recursive
            terraform validate
        } finally {
            Pop-Location
        }
    }
}

Write-Host "Local CI validation flow completed"
