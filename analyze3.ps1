[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$ErrorActionPreference = "Continue"

$folder = "C:\Users\Administrator\Desktop\2026-09-21-master"
$files = Get-ChildItem -Path $folder -Filter "final-noun-index.json" -Recurse -ErrorAction SilentlyContinue

# Get the files - use their indices explicitly
$file1 = $files[0].FullName
$file2 = $files[1].FullName

Write-Host "File1: $file1"
Write-Host "File2: $file2"

$content1 = Get-Content -Path $file1 -Raw -Encoding UTF8
$content2 = Get-Content -Path $file2 -Raw -Encoding UTF8

$data1 = $content1 | ConvertFrom-Json
$data2 = $content2 | ConvertFrom-Json

Write-Host ""
Write-Host "=== META COMPARISON ==="
$m1 = $data1.meta
$m2 = $data2.meta

Write-Host "File1 (older timestamp):"
Write-Host "  totalNouns: $($m1.totalNouns)"
Write-Host "  s0Count: $($m1.s0Count)"
Write-Host "  s1Count: $($m1.s1Count)"
Write-Host "  totalOffsets: $($m1.totalOffsets)"
Write-Host "  dedupRate: $($m1.dedupRate)"
Write-Host "  source: $($m1.source)"

Write-Host ""
Write-Host "File2 (newer timestamp):"
Write-Host "  totalNouns: $($m2.totalNouns)"
Write-Host "  s0Count: $($m2.s0Count)"
Write-Host "  s1Count: $($m2.s1Count)"
Write-Host "  totalOffsets: $($m2.totalOffsets)"
Write-Host "  dedupRate: $($m2.dedupRate)"
Write-Host "  source: $($m2.source)"

# Build dictionaries
$d1 = @{}
foreach ($n in $data1.nouns) {
    $d1[$n.id] = $n
}
$d2 = @{}
foreach ($n in $data2.nouns) {
    $d2[$n.id] = $n
}

$ids1 = @($d1.Keys)
$ids2 = @($d2.Keys)

$common = @($ids1 | Where-Object { $d2.ContainsKey($_) })
$only1 = @($ids1 | Where-Object { -not $d2.ContainsKey($_) })
$only2 = @($ids2 | Where-Object { -not $d1.ContainsKey($_) })

Write-Host ""
Write-Host "=== INTERSECTION ==="
Write-Host "Common: $($common.Count)"
Write-Host "Only File1: $($only1.Count)"
Write-Host "Only File2: $($only2.Count)"

# Find nouns with different offset counts in common
$diffs = @()
foreach ($id in $common) {
    $n1 = $d1[$id]
    $n2 = $d2[$id]
    if ($n1.offsets.Count -ne $n2.offsets.Count) {
        $diffs += [PSCustomObject]@{
            Id = $id
            N1 = $n1.offsets.Count
            N2 = $n2.offsets.Count
            Diff = $n1.offsets.Count - $n2.offsets.Count
        }
    }
}

Write-Host ""
Write-Host "=== Common nouns with same offset count: $($common.Count - $diffs.Count) ==="
Write-Host "=== Common nouns with DIFFERENT offset count: $($diffs.Count) ==="

if ($diffs.Count -gt 0) {
    Write-Host ""
    Write-Host "Top differences (sorted by absolute diff):"
    $sortedDiffs = $diffs | Sort-Object -Property @{Expression={ [Math]::Abs($_.Diff) }} -Descending | Select-Object -First 10
    foreach ($d in $sortedDiffs) {
        Write-Host "  $($d.Id): File1=$($d.N1), File2=$($d.N2), Diff=$($d.Diff)"
    }
}

# Sample nouns from each side
Write-Host ""
Write-Host "=== ONLY IN File1 (first 10) ==="
foreach ($id in $only1[0..9]) {
    $n = $d1[$id]
    Write-Host "  $($id): surface=$($n.surface), source=$($n.source), offsets=$($n.offsets.Count)"
}

Write-Host ""
Write-Host "=== ONLY IN File2 (first 10) ==="
foreach ($id in $only2[0..9]) {
    $n = $d2[$id]
    Write-Host "  $($id): surface=$($n.surface), source=$($n.source), offsets=$($n.offsets.Count)"
}

# Sample detailed for specific common nouns
Write-Host ""
Write-Host "=== Sample common noun 'flux' details ==="
if ($d1.ContainsKey("flux")) {
    $n1 = $d1["flux"]
    $n2 = $d2["flux"]
    Write-Host "File1: surface=$($n1.surface), source=$($n1.source), offsets=$($n1.offsets.Count)"
    Write-Host "  First 2 offsets:"
    $n1.offsets[0..1] | ForEach-Object { Write-Host "    page=$($_.page) [start=$($_.start) end=$($_.end)]" }
    Write-Host "File2: surface=$($n2.surface), source=$($n2.source), offsets=$($n2.offsets.Count)"
    Write-Host "  First 2 offsets:"
    $n2.offsets[0..1] | ForEach-Object { Write-Host "    page=$($_.page) [start=$($_.start) end=$($_.end)]" }
}
