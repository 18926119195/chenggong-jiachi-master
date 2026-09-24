$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$baseDir = "C:\Users\Administrator\Desktop\2026-09-21-master"
$targetDir = Get-ChildItem -LiteralPath $baseDir -Directory | Where-Object { $_.Name -like '*2026-09-22' } | Select-Object -First 1
$newJsonPath = Join-Path $targetDir.FullName "final-noun-index.json"
$blJsonPath = Join-Path $baseDir "noun-blacklist.json"

Write-Host "Reading new dataset from: $newJsonPath"
$newJson = Get-Content -LiteralPath $newJsonPath -Raw -Encoding UTF8 | ConvertFrom-Json
$surfaces = @($newJson.nouns | ForEach-Object { $_.surface })
Write-Host "Total surfaces: $($surfaces.Count)"

Write-Host "`nReading blacklist..."
$blJson = Get-Content -LiteralPath $blJsonPath -Raw -Encoding UTF8 | ConvertFrom-Json
$bl = @($blJson.blacklist)
Write-Host "Blacklist size: $($bl.Count)"

Write-Host "`nChecking exact blacklist matches..."
$blHash = @{}
foreach ($b in $bl) { $blHash[$b] = $true }
$exactHits = @()
foreach ($s in $surfaces) {
    if ($blHash.ContainsKey($s)) {
        $exactHits += $s
    }
}
Write-Host "Exact hits: $($exactHits.Count)"
$exactHits | Select-Object -First 20 | ForEach-Object { Write-Host "  - $_" }
if ($exactHits.Count -gt 20) { Write-Host "  ... ($($exactHits.Count - 20) more)" }

Write-Host "`nChecking leading punctuation..."
$leadPunct = @($surfaces | Where-Object { $_ -match '^[,\-;]' })
Write-Host "Leading punct fragments: $($leadPunct.Count)"
$leadPunct | Select-Object -First 15 | ForEach-Object { Write-Host "  - $_" }
if ($leadPunct.Count -gt 15) { Write-Host "  ... ($($leadPunct.Count - 15) more)" }

Write-Host "`nChecking markdown artifacts..."
$markdown = @($surfaces | Where-Object { $_ -match '[\*#]' })
Write-Host "Markdown artifacts: $($markdown.Count)"
$markdown | Select-Object -First 15 | ForEach-Object { Write-Host "  - $_" }
if ($markdown.Count -gt 15) { Write-Host "  ... ($($markdown.Count - 15) more)" }

Write-Host "`nChecking CJK characters..."
$cjk = @($surfaces | Where-Object { $_ -match '[\u4e00-\u9fff]' })
Write-Host "CJK mixed: $($cjk.Count)"
$cjk | ForEach-Object { Write-Host "  - $_" }

Write-Host "`nChecking bare French stopwords..."
$stopwords = @('selon', 'donc', 'ainsi', 'le', 'la', 'les', 'un', 'une', 'des', 'de', 'du', 'au', 'aux')
$stopHits = @($surfaces | Where-Object { $stopwords -contains $_.Trim().ToLower() })
Write-Host "Bare stopwords: $($stopHits.Count)"
$stopHits | ForEach-Object { Write-Host "  - $_" }

$totalIssues = $exactHits.Count + $leadPunct.Count + $markdown.Count + $cjk.Count + $stopHits.Count
$pct = [math]::Round($totalIssues / $surfaces.Count * 100, 2)
Write-Host "`n=== SUMMARY ==="
Write-Host "Total nouns: $($surfaces.Count)"
Write-Host "Blacklist hits: $($exactHits.Count)"
Write-Host "Leading punct: $($leadPunct.Count)"
Write-Host "Markdown: $($markdown.Count)"
Write-Host "CJK: $($cjk.Count)"
Write-Host "Stopwords: $($stopHits.Count)"
Write-Host "Total issues: $totalIssues ($pct%)"
