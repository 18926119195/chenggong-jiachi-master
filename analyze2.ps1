[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$ErrorActionPreference = "Continue"

$folder = "C:\Users\Administrator\Desktop\2026-09-21-master"
$files = Get-ChildItem -Path $folder -Filter "final-noun-index.json" -Recurse -ErrorAction SilentlyContinue
$files = $files | Sort-Object LastWriteTime -Descending

Write-Host "Files (sorted by LastWriteTime, newest first):"
$files | ForEach-Object { Write-Host "  $($_.LastWriteTime)  $($_.FullName)" }

# Identify which is which
# The one in the subdirectory is the "new run" result
# The one in the root is the "original"
$newRunFile = $null
$originalFile = $null
foreach ($f in $files) {
    if ($f.Directory -like "*主流程*") {
        $newRunFile = $f
    } else {
        $originalFile = $f
    }
}

Write-Host ""
Write-Host "NEW RUN (subdirectory): $($newRunFile.FullName)"
Write-Host "ORIGINAL (root): $($originalFile.FullName)"

$newData = Get-Content -Path $newRunFile.FullName -Raw -Encoding UTF8 | ConvertFrom-Json
$oldData = Get-Content -Path $originalFile.FullName -Raw -Encoding UTF8 | ConvertFrom-Json

# Build dictionaries for easy lookup
$newDict = @{}
foreach ($n in $newData.nouns) {
    $newDict[$n.id] = $n
}
$oldDict = @{}
foreach ($n in $oldData.nouns) {
    $oldDict[$n.id] = $n
}

# Find common nouns and compare offsets
$commonIds = @($newDict.Keys | Where-Object { $oldDict.ContainsKey($_) })

Write-Host ""
Write-Host "=== META COMPARISON ==="
Write-Host ("{0,-30} {1,>15} {2,>15} {3,>15}" -f "Field", "NEW (subfolder)", "ORIGINAL (root)", "Difference")
Write-Host ("-"*80)

$metrics = @("chunkCount", "totalNouns", "s0Count", "s1Count", "totalOffsets")
foreach ($m in $metrics) {
    $newVal = $newData.meta.$m
    $oldVal = $oldData.meta.$m
    $diff = $newVal - $oldVal
    Write-Host ("{0,-30} {1,>15} {2,>15} {3,>+15}" -f $m, $newVal, $oldVal, $diff)
}

Write-Host ""
Write-Host "Dedup Rate NEW: $($newData.meta.dedupRate)"
Write-Host "Dedup Rate ORIGINAL: $($oldData.meta.dedupRate)"
Write-Host "Source NEW: $($newData.meta.source)"
Write-Host "Source ORIGINAL: $($oldData.meta.source)"

# Find common nouns with different offset counts
Write-Host ""
Write-Host "=== Common nouns with DIFFERENT offset counts ==="
$diffs = @()
foreach ($id in $commonIds) {
    $newNoun = $newDict[$id]
    $oldNoun = $oldDict[$id]
    if ($newNoun.offsets.Count -ne $oldNoun.offsets.Count) {
        $diffs += [PSCustomObject]@{
            Id = $id
            NewCount = $newNoun.offsets.Count
            OldCount = $oldNoun.offsets.Count
            Diff = $newNoun.offsets.Count - $oldNoun.offsets.Count
        }
    }
}

Write-Host "Total common nouns: $($commonIds.Count)"
Write-Host "Common nouns with same offset count: $($commonIds.Count - $diffs.Count)"
Write-Host "Common nouns with DIFFERENT offset count: $($diffs.Count)"

if ($diffs.Count -gt 0) {
    Write-Host ""
    Write-Host "Top 10 differences (sorted by absolute difference):"
    $topDiffs = $diffs | Sort-Object { [Math]::Abs($_.Diff) } -Descending | Select-Object -First 10
    foreach ($d in $topDiffs) {
        Write-Host "  $($d.Id): NEW=$($d.NewCount), ORIGINAL=$($d.OldCount), Diff=$($d.Diff)"
    }
}

# Show only-new nouns details
$onlyNewIds = @($newDict.Keys | Where-Object { -not $oldDict.ContainsKey($_) })
$onlyOldIds = @($oldDict.Keys | Where-Object { -not $newDict.ContainsKey($_) })

Write-Host ""
Write-Host "=== INTERSECTION SUMMARY ==="
Write-Host "Common: $($commonIds.Count)"
Write-Host "Only in NEW: $($onlyNewIds.Count)"
Write-Host "Only in ORIGINAL: $($onlyOldIds.Count)"

# Stats on offsets of only-new and only-old nouns
$onlyNewTotalOffsets = ($onlyNewIds | ForEach-Object { $newDict[$_].offsets.Count } | Measure-Object -Sum).Sum
$onlyOldTotalOffsets = ($onlyOldIds | ForEach-Object { $oldDict[$_].offsets.Count } | Measure-Object -Sum).Sum
Write-Host "Total offsets in only-NEW nouns: $onlyNewTotalOffsets"
Write-Host "Total offsets in only-ORIGINAL nouns: $onlyOldTotalOffsets"

# Sample detailed noun comparison
Write-Host ""
Write-Host "=== SAMPLE DETAILED COMPARISON ==="
Write-Host "Sample common noun with same offsets (e.g. 'flux'):"
if ($newDict.ContainsKey("flux")) {
    $n = $newDict["flux"]
    $o = $oldDict["flux"]
    Write-Host "  NEW: id=flux, surface=$($n.surface), source=$($n.source), offsetCount=$($n.offsets.Count)"
    Write-Host "  ORIG: id=flux, surface=$($o.surface), source=$($o.source), offsetCount=$($o.offsets.Count)"
    Write-Host "  First 3 offsets in NEW:"
    $n.offsets | Select-Object -First 3 | ForEach-Object {
        Write-Host "    page=$($_.page) [start=$($_.start) end=$($_.end)]"
    }
}

Write-Host ""
Write-Host "Sample only-NEW noun ('a-signifiante'):"
if ($newDict.ContainsKey("a-signifiante")) {
    $n = $newDict["a-signifiante"]
    Write-Host "  Surface: $($n.surface), Source: $($n.source), Offsets: $($n.offsets.Count)"
    $n.offsets | ForEach-Object {
        Write-Host "    page=$($_.page) [start=$($_.start) end=$($_.end)]"
    }
}

Write-Host ""
Write-Host "Sample only-ORIGINAL noun:"
if ($onlyOldIds.Count -gt 0) {
    $sampleId = $onlyOldIds[0]
    $o = $oldDict[$sampleId]
    Write-Host "  ID: $sampleId, Surface: $($o.surface), Source: $($o.source), Offsets: $($o.offsets.Count)"
    $o.offsets | ForEach-Object {
        Write-Host "    page=$($_.page) [start=$($_.start) end=$($_.end)]"
    }
}
