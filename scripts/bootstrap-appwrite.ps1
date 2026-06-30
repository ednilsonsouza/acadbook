# =============================================================================
# bootstrap-appwrite.ps1
# Cria database, 7 collections com atributos e índices, e bucket de storage
# Uso: .\bootstrap-appwrite.ps1
# =============================================================================

$ErrorActionPreference = "Continue"

$endpoint = "https://appwrite-appwrite.yyg0pb.easypanel.host/v1"
$projectId = "6a432a3e0035999f54b2"
$apiKey = "standard_4e35082c289bacbea845ac44164bff7226ea24af2be2c25e2454566823ad0b5b6b9812e303cbc84f29f4a627b4b06fc4c3d79a0ba2c5d4593eea50d15297a81a43ee817bc526af6798a9c80a3027355061f364933b6b06d2197d7db7f077c02e2a696e49a52785bf21c087b9170ed32940f03dd4bd4ef3e97a0f222eeaa835e0"
$databaseId = "academicbook"

$headers = @{
    "Content-Type" = "application/json"
    "X-Appwrite-Project" = $projectId
    "X-Appwrite-Key" = $apiKey
    "X-Appwrite-Response-Format" = "1.5.0"
}

# -----------------------------------------------------------------------------
# Helpers
# -----------------------------------------------------------------------------

function Invoke-Appwrite {
    param([string]$Method, [string]$Path, [object]$Body = $null)
    $uri = "$endpoint$Path"
    $params = @{
        Uri = $uri
        Method = $Method
        Headers = $headers
    }
    if ($Body) {
        $params.Body = ($Body | ConvertTo-Json -Depth 10 -Compress)
    }
    try {
        $response = Invoke-RestMethod @params
        return @{ ok = $true; data = $response }
    } catch {
        $status = $_.Exception.Response.StatusCode.value__
        $stream = $_.Exception.Response.GetResponseStream()
        $reader = New-Object System.IO.StreamReader($stream)
        $errBody = $reader.ReadToEnd()
        return @{ ok = $false; status = $status; error = $errBody }
    }
}

function Test-Database {
    $r = Invoke-Appwrite "GET" "/databases/$databaseId"
    return $r.ok
}

function New-Database {
    Write-Host "Criando database '$databaseId'..." -ForegroundColor Yellow
    $body = @{ databaseId = $databaseId; name = "AcadBook" }
    $r = Invoke-Appwrite "POST" "/databases" $body
    if ($r.ok) { Write-Host "  OK" -ForegroundColor Green } else { Write-Host "  ERRO: $($r.error)" -ForegroundColor Red }
}

function Test-Collection {
    param([string]$CollId)
    $r = Invoke-Appwrite "GET" "/databases/$databaseId/collections/$CollId"
    return $r.ok
}

function New-Collection {
    param([string]$CollId, [string]$Name, [bool]$DocSecurity, [string[]]$Permissions)
    Write-Host "Criando collection '$CollId'..." -ForegroundColor Yellow
    $body = @{
        collectionId = $CollId
        name = $Name
        documentSecurity = $DocSecurity
        permissions = $Permissions
    }
    $r = Invoke-Appwrite "POST" "/databases/$databaseId/collections" $body
    if ($r.ok) {
        Write-Host "  OK" -ForegroundColor Green
        return $true
    } elseif ($r.status -eq 409) {
        Write-Host "  Ja existe" -ForegroundColor DarkYellow
        return $true
    } else {
        Write-Host "  ERRO: $($r.error)" -ForegroundColor Red
        return $false
    }
}

function New-StringAttr {
    param([string]$CollId, [string]$Key, [int]$Size, [bool]$Required)
    $body = @{ key = $Key; size = $Size; required = $Required }
    $r = Invoke-Appwrite "POST" "/databases/$databaseId/collections/$CollId/attributes/string" $body
    if ($r.ok) { return $true }
    elseif ($r.status -eq 409) { return $true }  # ja existe
    return $false
}

function New-IntegerAttr {
    param([string]$CollId, [string]$Key, [bool]$Required, [int]$Default = 0)
    # Appwrite NAO aceita 'default' em atributos required — somente em optional
    $body = @{ key = $Key; required = $Required }
    if (-not $Required) { $body.default = $Default }
    $r = Invoke-Appwrite "POST" "/databases/$databaseId/collections/$CollId/attributes/integer" $body
    if ($r.ok) { return $true }
    elseif ($r.status -eq 409) { return $true }
    return $false
}

function New-BooleanAttr {
    param([string]$CollId, [string]$Key, [bool]$Required)
    $body = @{ key = $Key; required = $Required }
    $r = Invoke-Appwrite "POST" "/databases/$databaseId/collections/$CollId/attributes/boolean" $body
    if ($r.ok) { return $true }
    elseif ($r.status -eq 409) { return $true }
    return $false
}

function Wait-Attr {
    param([string]$CollId, [string]$AttrKey, [int]$MaxWait = 15)
    Write-Host "    aguardando atributo '$AttrKey'..." -NoNewline
    $elapsed = 0
    while ($elapsed -lt $MaxWait) {
        Start-Sleep -Seconds 1
        $elapsed++
        $r = Invoke-Appwrite "GET" "/databases/$databaseId/collections/$CollId/attributes/$AttrKey"
        if ($r.ok -and $r.data.status -eq "available") {
            Write-Host " OK" -ForegroundColor Green
            return $true
        }
    }
    Write-Host " TIMEOUT" -ForegroundColor Red
    return $false
}

function New-Index {
    param([string]$CollId, [string]$Key, [string]$Type, [string[]]$Attributes, [string[]]$Orders)
    $body = @{ key = $Key; type = $Type; attributes = $Attributes; orders = $Orders }
    $r = Invoke-Appwrite "POST" "/databases/$databaseId/collections/$CollId/indexes" $body
    if ($r.ok) { return $true }
    elseif ($r.status -eq 409) { return $true }
    return $false
}

function Wait-Index {
    param([string]$CollId, [string]$IndexKey, [int]$MaxWait = 15)
    Write-Host "    aguardando indice '$IndexKey'..." -NoNewline
    $elapsed = 0
    while ($elapsed -lt $MaxWait) {
        Start-Sleep -Seconds 1
        $elapsed++
        $r = Invoke-Appwrite "GET" "/databases/$databaseId/collections/$CollId/indexes/$IndexKey"
        if ($r.ok -and $r.data.status -eq "available") {
            Write-Host " OK" -ForegroundColor Green
            return $true
        }
    }
    Write-Host " TIMEOUT" -ForegroundColor Red
    return $false
}

function Process-Attributes {
    param([string]$CollId, [array]$StringAttrs, [array]$IntegerAttrs, [array]$BooleanAttrs)

    foreach ($a in $StringAttrs) {
        $ok = New-StringAttr -CollId $CollId -Key $a.Key -Size $a.Size -Required $a.Required
        if (-not $ok) { Write-Host "    FALHA string: $($a.Key)" -ForegroundColor Red; continue }
        Wait-Attr -CollId $CollId -AttrKey $a.Key | Out-Null
        Start-Sleep -Milliseconds 300
    }
    foreach ($a in $IntegerAttrs) {
        $ok = New-IntegerAttr -CollId $CollId -Key $a.Key -Required $a.Required -Default $a.Default
        if (-not $ok) { Write-Host "    FALHA integer: $($a.Key)" -ForegroundColor Red; continue }
        Wait-Attr -CollId $CollId -AttrKey $a.Key | Out-Null
        Start-Sleep -Milliseconds 300
    }
    foreach ($a in $BooleanAttrs) {
        $ok = New-BooleanAttr -CollId $CollId -Key $a.Key -Required $a.Required
        if (-not $ok) { Write-Host "    FALHA boolean: $($a.Key)" -ForegroundColor Red; continue }
        Wait-Attr -CollId $CollId -AttrKey $a.Key | Out-Null
        Start-Sleep -Milliseconds 300
    }
}

function Process-Indexes {
    param([string]$CollId, [array]$Indexes)
    foreach ($idx in $Indexes) {
        $ok = New-Index -CollId $CollId -Key $idx.Key -Type $idx.Type -Attributes $idx.Attributes -Orders $idx.Orders
        if ($ok) {
            Write-Host "  indice '$($idx.Key)' criado" -ForegroundColor Green
        } else {
            Write-Host "  FALHA indice: $($idx.Key)" -ForegroundColor Red
        }
        Start-Sleep -Milliseconds 400
    }
}

# =============================================================================
# 1. DATABASE
# =============================================================================
Write-Host "`n=== DATABASE ===" -ForegroundColor Cyan
if (Test-Database) {
    Write-Host "Database '$databaseId' ja existe" -ForegroundColor DarkYellow
} else {
    New-Database
    Start-Sleep -Seconds 2
}

# =============================================================================
# 2. COLLECTIONS
# =============================================================================
Write-Host "`n=== COLLECTIONS ===" -ForegroundColor Cyan

$userPerms = @(
    'read("any")', 'create("any")', 'update("any")', 'delete("any")'
)

# -----------------------------------------------------------------------------
# 2.1 books (documentSecurity = true — permissoes por documento)
# -----------------------------------------------------------------------------
$collId = "books"
Write-Host "`n--- $collId ---" -ForegroundColor Magenta
$created = New-Collection -CollId $collId -Name "Books" -DocSecurity $true -Permissions $userPerms
if ($created) {
    Start-Sleep -Seconds 1.5
    Process-Attributes -CollId $collId `
        -StringAttrs @(
            @{ Key = "title"; Size = 200; Required = $true },
            @{ Key = "description"; Size = 2000; Required = $true },
            @{ Key = "authors"; Size = 500; Required = $true },
            @{ Key = "status"; Size = 50; Required = $true },
            @{ Key = "approvedPlanId"; Size = 64; Required = $false },
            @{ Key = "pdfFileId"; Size = 64; Required = $false },
            @{ Key = "createdBy"; Size = 64; Required = $true },
            @{ Key = "errorMessage"; Size = 500; Required = $false },
            @{ Key = "templateId"; Size = 64; Required = $false },
            @{ Key = "citationStyle"; Size = 20; Required = $true },
            @{ Key = "assembledHtmlFileId"; Size = 64; Required = $false }
        ) `
        -IntegerAttrs @(
            @{ Key = "chaptersCount"; Required = $true; Default = 0 },
            @{ Key = "sectionsPerChapter"; Required = $true; Default = 0 },
            @{ Key = "paragraphsPerSection"; Required = $true; Default = 0 }
        ) `
        -BooleanAttrs @()
    Start-Sleep -Seconds 2
    Process-Indexes -CollId $collId -Indexes @(
        @{ Key = "createdBy_idx"; Type = "key"; Attributes = @("createdBy"); Orders = @("ASC") },
        @{ Key = "status_idx"; Type = "key"; Attributes = @("status"); Orders = @("ASC") }
    )
}

# -----------------------------------------------------------------------------
# 2.2 book_plans
# -----------------------------------------------------------------------------
$collId = "book_plans"
Write-Host "`n--- $collId ---" -ForegroundColor Magenta
$created = New-Collection -CollId $collId -Name "Book Plans" -DocSecurity $false -Permissions $userPerms
if ($created) {
    Start-Sleep -Seconds 1.5
    Process-Attributes -CollId $collId `
        -StringAttrs @(
            @{ Key = "bookId"; Size = 64; Required = $true },
            @{ Key = "status"; Size = 20; Required = $true },
            @{ Key = "chapters"; Size = 16000; Required = $true },
            @{ Key = "approvedAt"; Size = 32; Required = $false }
        ) `
        -IntegerAttrs @(
            @{ Key = "version"; Required = $true; Default = 1 }
        ) `
        -BooleanAttrs @()
    Start-Sleep -Seconds 2
    Process-Indexes -CollId $collId -Indexes @(
        @{ Key = "bookId_idx"; Type = "key"; Attributes = @("bookId"); Orders = @("ASC") }
    )
}

# -----------------------------------------------------------------------------
# 2.3 chapters
# -----------------------------------------------------------------------------
$collId = "chapters"
Write-Host "`n--- $collId ---" -ForegroundColor Magenta
$created = New-Collection -CollId $collId -Name "Chapters" -DocSecurity $false -Permissions $userPerms
if ($created) {
    Start-Sleep -Seconds 1.5
    Process-Attributes -CollId $collId `
        -StringAttrs @(
            @{ Key = "bookId"; Size = 64; Required = $true },
            @{ Key = "planId"; Size = 64; Required = $true },
            @{ Key = "title"; Size = 200; Required = $true },
            @{ Key = "content"; Size = 15000; Required = $false },
            @{ Key = "status"; Size = 20; Required = $true },
            @{ Key = "errorMessage"; Size = 500; Required = $false },
            @{ Key = "generatedAt"; Size = 32; Required = $false }
        ) `
        -IntegerAttrs @(
            @{ Key = "chapterNumber"; Required = $true; Default = 0 },
            @{ Key = "retryCount"; Required = $true; Default = 0 }
        ) `
        -BooleanAttrs @()
    Start-Sleep -Seconds 2
    Process-Indexes -CollId $collId -Indexes @(
        @{ Key = "bookId_idx"; Type = "key"; Attributes = @("bookId"); Orders = @("ASC") },
        @{ Key = "bookId_chapterNumber_idx"; Type = "unique"; Attributes = @("bookId","chapterNumber"); Orders = @("ASC","ASC") }
    )
}

# -----------------------------------------------------------------------------
# 2.4 sources
# -----------------------------------------------------------------------------
$collId = "sources"
Write-Host "`n--- $collId ---" -ForegroundColor Magenta
$created = New-Collection -CollId $collId -Name "Sources" -DocSecurity $false -Permissions $userPerms
if ($created) {
    Start-Sleep -Seconds 1.5
    Process-Attributes -CollId $collId `
        -StringAttrs @(
            @{ Key = "bookId"; Size = 64; Required = $true },
            @{ Key = "chapterId"; Size = 64; Required = $true },
            @{ Key = "sectionId"; Size = 64; Required = $false },
            @{ Key = "title"; Size = 500; Required = $true },
            @{ Key = "authors"; Size = 500; Required = $true },
            @{ Key = "url"; Size = 2048; Required = $true },
            @{ Key = "publisher"; Size = 200; Required = $false },
            @{ Key = "publishedAt"; Size = 50; Required = $false },
            @{ Key = "accessedAt"; Size = 32; Required = $true },
            @{ Key = "excerpt"; Size = 2000; Required = $false },
            @{ Key = "citationType"; Size = 20; Required = $true },
            @{ Key = "usedInParagraphId"; Size = 64; Required = $false },
            @{ Key = "metadata"; Size = 2000; Required = $false }
        ) `
        -IntegerAttrs @() `
        -BooleanAttrs @(
            @{ Key = "isComplete"; Required = $true }
        )
    Start-Sleep -Seconds 2
    Process-Indexes -CollId $collId -Indexes @(
        @{ Key = "bookId_idx"; Type = "key"; Attributes = @("bookId"); Orders = @("ASC") },
        @{ Key = "chapterId_idx"; Type = "key"; Attributes = @("chapterId"); Orders = @("ASC") }
    )
}

# -----------------------------------------------------------------------------
# 2.5 references
# -----------------------------------------------------------------------------
$collId = "references"
Write-Host "`n--- $collId ---" -ForegroundColor Magenta
$created = New-Collection -CollId $collId -Name "References" -DocSecurity $false -Permissions $userPerms
if ($created) {
    Start-Sleep -Seconds 1.5
    Process-Attributes -CollId $collId `
        -StringAttrs @(
            @{ Key = "bookId"; Size = 64; Required = $true },
            @{ Key = "sourceId"; Size = 64; Required = $true },
            @{ Key = "style"; Size = 20; Required = $true },
            @{ Key = "formattedReference"; Size = 2000; Required = $true }
        ) `
        -IntegerAttrs @() `
        -BooleanAttrs @()
    Start-Sleep -Seconds 2
    Process-Indexes -CollId $collId -Indexes @(
        @{ Key = "bookId_idx"; Type = "key"; Attributes = @("bookId"); Orders = @("ASC") }
    )
}

# -----------------------------------------------------------------------------
# 2.6 exports
# -----------------------------------------------------------------------------
$collId = "exports"
Write-Host "`n--- $collId ---" -ForegroundColor Magenta
$created = New-Collection -CollId $collId -Name "Exports" -DocSecurity $false -Permissions $userPerms
if ($created) {
    Start-Sleep -Seconds 1.5
    Process-Attributes -CollId $collId `
        -StringAttrs @(
            @{ Key = "bookId"; Size = 64; Required = $true },
            @{ Key = "format"; Size = 10; Required = $true },
            @{ Key = "fileId"; Size = 64; Required = $false },
            @{ Key = "status"; Size = 20; Required = $true },
            @{ Key = "errorMessage"; Size = 500; Required = $false },
            @{ Key = "templateId"; Size = 64; Required = $true }
        ) `
        -IntegerAttrs @() `
        -BooleanAttrs @()
    Start-Sleep -Seconds 2
    Process-Indexes -CollId $collId -Indexes @(
        @{ Key = "bookId_idx"; Type = "key"; Attributes = @("bookId"); Orders = @("ASC") },
        @{ Key = "status_idx"; Type = "key"; Attributes = @("status"); Orders = @("ASC") }
    )
}

# -----------------------------------------------------------------------------
# 2.7 generation_logs
# -----------------------------------------------------------------------------
$collId = "generation_logs"
Write-Host "`n--- $collId ---" -ForegroundColor Magenta
$created = New-Collection -CollId $collId -Name "Generation Logs" -DocSecurity $false -Permissions $userPerms
if ($created) {
    Start-Sleep -Seconds 1.5
    Process-Attributes -CollId $collId `
        -StringAttrs @(
            @{ Key = "bookId"; Size = 64; Required = $true },
            @{ Key = "chapterId"; Size = 64; Required = $false },
            @{ Key = "agent"; Size = 100; Required = $true },
            @{ Key = "step"; Size = 100; Required = $true },
            @{ Key = "status"; Size = 20; Required = $true },
            @{ Key = "message"; Size = 1000; Required = $true },
            @{ Key = "metadata"; Size = 2000; Required = $false }
        ) `
        -IntegerAttrs @() `
        -BooleanAttrs @()
    Start-Sleep -Seconds 2
    Process-Indexes -CollId $collId -Indexes @(
        @{ Key = "bookId_idx"; Type = "key"; Attributes = @("bookId"); Orders = @("ASC") },
        @{ Key = "status_idx"; Type = "key"; Attributes = @("status"); Orders = @("ASC") }
    )
}

# =============================================================================
# 3. STORAGE BUCKET
# =============================================================================
Write-Host "`n=== STORAGE BUCKET ===" -ForegroundColor Cyan
$bucketId = "book-exports"
$r = Invoke-Appwrite "GET" "/storage/buckets/$bucketId"
if ($r.ok) {
    Write-Host "Bucket '$bucketId' ja existe" -ForegroundColor DarkYellow
} else {
    Write-Host "Criando bucket '$bucketId'..." -ForegroundColor Yellow
    $body = @{
        bucketId = $bucketId
        name = "Book Exports"
        permissions = @('read("any")', 'create("any")', 'update("any")', 'delete("any")')
        fileSecurity = $true
        enabled = $true
        maximumFileSize = 30000000
        allowedFileExtensions = @("pdf", "html")
        compression = "none"
        encryption = $false
        antivirus = $false
    }
    $r = Invoke-Appwrite "POST" "/storage/buckets" $body
    if ($r.ok) { Write-Host "  OK" -ForegroundColor Green } else { Write-Host "  ERRO: $($r.error)" -ForegroundColor Red }
}

# =============================================================================
# 4. RESUMO
# =============================================================================
Write-Host "`n=== RESUMO ===" -ForegroundColor Cyan
$collections = @("books","book_plans","chapters","sources","references","exports","generation_logs")
foreach ($c in $collections) {
    $r = Invoke-Appwrite "GET" "/databases/$databaseId/collections/$c/attributes"
    if ($r.ok) {
        $count = ($r.data.attributes | Measure-Object).Count
        Write-Host "  $c : $count atributos" -ForegroundColor Green
    } else {
        Write-Host "  $c : NAO ENCONTRADA" -ForegroundColor Red
    }
}
Write-Host "`nBootstrap concluido!" -ForegroundColor Green
