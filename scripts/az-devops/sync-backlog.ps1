param(
    [Parameter(Position = 0)]
    [string]$EpicFilter,  # e.g. "epic-017" — syncs only that epic and its stories

    [switch]$Update        # When set, updates existing items. Without it, existing items are skipped.
)

$orgUrl = "https://dev.azure.com/eygs3"
$project = "attg-analytics-dashboard"
$pat = "" # Necesario para Invoke-RestMethod
$epicsPath = "C:\Repos\BTS-ATTG-ANALYTICS-DASHBOARD-ATTGANALYTICSDASHBOARD\Documentation\Backlog\epics"
$usPath = "C:\Repos\BTS-ATTG-ANALYTICS-DASHBOARD-ATTGANALYTICSDASHBOARD\Documentation\Backlog\stories"
$witApiVersion = "7.1-preview.3"


# Autenticación y Headers
$base64AuthInfo = [Convert]::ToBase64String([Text.Encoding]::ASCII.GetBytes(":$pat"))
$headers = @{ 
    Authorization = "Basic $base64AuthInfo"
    "Content-Type" = "application/json-patch+json"
}

function Get-WorkItemByTitle($title, $type) {
    $url = "$orgUrl/$project/_apis/wit/wiql?api-version=7.1"
    $safeTitle = $title.Replace("'", "''")
    $query = @{
        query = "SELECT [System.Id] FROM WorkItems WHERE [System.TeamProject] = '$project' AND [System.WorkItemType] = '$type' AND [System.Title] = '$safeTitle' AND [System.State] <> 'Removed' ORDER BY [System.Id] ASC"
    } | ConvertTo-Json

    try {
        $response = Invoke-RestMethod -Uri $url -Method Post -Body $query -ContentType "application/json" -Headers $headers
        $ids = @($response.workItems | ForEach-Object { $_.id } | Sort-Object -Unique)

        return [PSCustomObject]@{
            Success = $true
            Ids = $ids
            Id = if ($ids.Count -gt 0) { $ids[0] } else { $null }
        }
    }
    catch {
        Write-Host "   [X] Error al consultar '$type' por título: '$title'" -ForegroundColor Red
        Write-ApiErrorDetail -ErrorRecord $_
        return [PSCustomObject]@{
            Success = $false
            Ids = @()
            Id = $null
        }
    }
}

function Write-ApiErrorDetail($ErrorRecord) {
    $ex = $ErrorRecord.Exception
    $statusCode = $null
    $rawBody = $null

    if ($ex.PSObject.Properties.Name -contains "Response" -and $ex.Response) {
        if ($ex.Response.PSObject.Properties.Name -contains "StatusCode") {
            $statusCode = [int]$ex.Response.StatusCode
        }

        if ($ex.Response.PSObject.Methods.Name -contains "GetResponseStream") {
            try {
                $stream = $ex.Response.GetResponseStream()
                if ($stream) {
                    $reader = New-Object System.IO.StreamReader($stream)
                    $rawBody = $reader.ReadToEnd()
                }
            }
            catch {
                # Si no se puede leer el stream, usamos otros canales de error.
            }
        }
    }

    if (-not [string]::IsNullOrWhiteSpace($ErrorRecord.ErrorDetails.Message)) {
        $rawBody = $ErrorRecord.ErrorDetails.Message
    }

    if (-not [string]::IsNullOrWhiteSpace($rawBody)) {
        try {
            $json = $rawBody | ConvertFrom-Json -ErrorAction Stop
            $message = if ($json.message) { $json.message } else { $rawBody }
            $typeName = if ($json.typeName) { " [$($json.typeName)]" } else { "" }
            $statusText = if ($statusCode) { "HTTP $statusCode" } else { "HTTP N/A" }
            Write-Host "      DETALLE: $statusText$typeName - $message" -ForegroundColor DarkRed
        }
        catch {
            $statusText = if ($statusCode) { "HTTP $statusCode" } else { "HTTP N/A" }
            Write-Host "      DETALLE: $statusText - $rawBody" -ForegroundColor DarkRed
        }
    }
    else {
        Write-Host "      DETALLE: $($ex.Message)" -ForegroundColor DarkRed
    }
}

function Normalize-MarkdownContent($text) {
    if ($null -eq $text) {
        return ""
    }

    # Mantiene los saltos de línea en CRLF para evitar pérdida de formato en ADO.
    return ($text -replace "`r?`n", "`r`n")
}

function Save-WorkItem-WithDetail($title, $content, $type, $id = $null, $parentId = $null, $storyPoints = $null) {
    $isUpdate = $null -ne $id
    $url = if ($isUpdate) { "$orgUrl/_apis/wit/workitems/$id`?api-version=$witApiVersion" } 
           else { "$orgUrl/$project/_apis/wit/workitems/`$$type`?api-version=$witApiVersion" }

    $normalizedContent = Normalize-MarkdownContent -text $content

    if ($isUpdate) {
        # Update only the description content
        $patch = @(
            @{ op = "add"; path = "/fields/System.Description"; value = $normalizedContent },
            @{ op = "add"; path = "/multilineFieldsFormat/System.Description"; value = "markdown" }
        )
    } else {
        # Full field set for new items
        $patch = @(
            @{ op = "add"; path = "/fields/System.Title"; value = $title },
            @{ op = "add"; path = "/fields/System.Description"; value = $normalizedContent },
            @{ op = "add"; path = "/multilineFieldsFormat/System.Description"; value = "markdown" },
            @{ op = "add"; path = "/fields/Microsoft.VSTS.Common.ValueArea"; value = "Business" },
            @{ op = "add"; path = "/fields/System.AreaPath"; value = "attg-analytics-dashboard" },
            @{ op = "add"; path = "/fields/Custom.Planned"; value = "Yes" },
            @{ op = "add"; path = "/fields/Microsoft.VSTS.Scheduling.TargetDate"; value = "6/30/2026 12:00 AM" },
            @{ op = "add"; path = "/fields/Microsoft.VSTS.Scheduling.StartDate"; value = "4/30/2026 12:00 AM" },
            @{ op = "add"; path = "/fields/Microsoft.VSTS.Scheduling.Effort"; value = 5 }
        )
    }

    # Story Points only for User Stories
    if ($storyPoints) {
        $patch += @{ op = "add"; path = "/fields/Microsoft.VSTS.Scheduling.StoryPoints"; value = $storyPoints }
    }

    # Solo vinculamos si es creación y tenemos parentId
    if ($parentId -and -not $isUpdate) {
        $patch += @{ 
            op = "add"; path = "/relations/-"; 
            value = @{ rel = "System.LinkTypes.Hierarchy-Reverse"; url = "$orgUrl/_apis/wit/workItems/$parentId" } 
        }
    }

    try {
        $method = if ($isUpdate) { "Patch" } else { "Post" }
        $body = $patch | ConvertTo-Json -Depth 10 -Compress
        $res = Invoke-RestMethod -Uri $url -Method $method -Body $body -ContentType "application/json-patch+json; charset=utf-8" -Headers $headers
        return $res.id
    } 
    catch {
        # --- DETALLE DEL ERROR ---
        Write-Host "      [X] Error en API al procesar '$title'" -ForegroundColor Red
        Write-ApiErrorDetail -ErrorRecord $_
        return $null
    }
}

# --- PROCESO ---
$epicFiles = Get-ChildItem -Path $epicsPath -Filter *.md

if ($EpicFilter) {
    $normalizedFilter = $EpicFilter.ToLower() -replace '^epic-', ''
    $epicFiles = $epicFiles | Where-Object {
        $code = ($_.BaseName -split '-')[0..1] -join '-'
        $codeNumber = ($code -split '-')[1]
        $codeNumber -eq $normalizedFilter -or $code -eq $EpicFilter.ToLower()
    }

    if ($epicFiles.Count -eq 0) {
        Write-Host "[X] No epic file found matching filter '$EpicFilter'" -ForegroundColor Red
        exit 1
    }

    Write-Host "Filtering to epic: $EpicFilter" -ForegroundColor Magenta
}

$epicFiles | ForEach-Object {
    $file = $_
    $content = [System.IO.File]::ReadAllText($file.FullName)
    $title = (($content -split "`r?`n" | Where-Object { -not [string]::IsNullOrWhiteSpace($_) } | Select-Object -First 1).Trim('#').Trim())
    $epicCode = ($file.BaseName -split '-')[0..1] -join '-'

    Write-Host "`n>> EPIC: $title" -ForegroundColor Cyan
    
    # EVITAR DUPLICADOS: Buscar antes de crear
    $existing = Get-WorkItemByTitle -title $title -type "Epic"
    if (-not $existing.Success) {
        Write-Host "   [X] Se omite EPIC por error de consulta para evitar duplicados." -ForegroundColor Red
        return
    }

    if ($existing.Ids.Count -gt 1) {
        Write-Host "   [!] Se detectaron $($existing.Ids.Count) coincidencias para EPIC. Se usará ID $($existing.Id)." -ForegroundColor DarkYellow
    }
    if ($existing.Id -and -not $Update) {
        Write-Host "   [=] Ya existe (ID: $($existing.Id)). Use -Update para actualizar." -ForegroundColor Gray
        $epicId = $existing.Id
    } else {
        if ($existing.Id) {
            Write-Host "   [~] Ya existe (ID: $($existing.Id)). Actualizando..." -ForegroundColor Gray
        }
        $epicId = Save-WorkItem-WithDetail -title $title -content $content -type "Epic" -id $existing.Id
    }
    
    if ($epicId) {
        $folderUS = Join-Path $usPath $epicCode
        if (Test-Path $folderUS) {
            Get-ChildItem -Path $folderUS -Filter *.md | ForEach-Object {
                $usContent = [System.IO.File]::ReadAllText($_.FullName)
                $usTitle = (($usContent -split "`r?`n" | Where-Object { -not [string]::IsNullOrWhiteSpace($_) } | Select-Object -First 1).Trim('#').Trim())
                
                Write-Host "   -> US: $usTitle" -ForegroundColor Yellow
                
                # EVITAR DUPLICADOS US
                $existingUs = Get-WorkItemByTitle -title $usTitle -type "User Story"
                if (-not $existingUs.Success) {
                    Write-Host "      [X] Se omite US por error de consulta para evitar duplicados." -ForegroundColor Red
                    return
                }

                if ($existingUs.Ids.Count -gt 1) {
                    Write-Host "      [!] Se detectaron $($existingUs.Ids.Count) coincidencias para US. Se usará ID $($existingUs.Id)." -ForegroundColor DarkYellow
                }

                if ($existingUs.Id -and -not $Update) {
                    Write-Host "      [=] Ya existe (ID: $($existingUs.Id)). Use -Update para actualizar." -ForegroundColor Gray
                    return
                }
                if ($existingUs.Id) {
                    Write-Host "      [~] Ya existe (ID: $($existingUs.Id)). Actualizando..." -ForegroundColor Gray
                }
                
                $null = Save-WorkItem-WithDetail -title $usTitle -content $usContent -type "User Story" -id $existingUs.Id -parentId $epicId -storyPoints 5
            }
        }
    }
}
