[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$newFile = Get-ChildItem -Path "C:\Users\Administrator\Desktop\2026-09-21-master" -Filter "final-noun-index.json" -Recurse | Select-Object -First 2
Write-Host "Found files:"
$newFile | ForEach-Object { Write-Host "  $($_.FullName)" }

$newData = Get-Content -Path $newFile[0].FullName -Raw -Encoding UTF8 | ConvertFrom-Json
$oldData = Get-Content -Path $newFile[1].FullName -Raw -Encoding UTF8 | ConvertFrom-Json

Write-Host ""
Write-Host "=== META ==="
Write-Host "NEW ($($newFile[0].Directory.Name)): nouns=$($newData.meta.totalNouns) s0=$($newData.meta.s0Count) s1=$($newData.meta.s1Count) offsets=$($newData.meta.totalOffsets)"
Write-Host "OLD ($($newFile[1].Directory.Name)): nouns=$($oldData.meta.totalNouns) s0=$($oldData.meta.s0Count) s1=$($oldData.meta.s1Count) offsets=$($oldData.meta.totalOffsets)"

$newIds = @($newData.nouns | ForEach-Object { $_.id })
$oldIds = @($oldData.nouns | ForEach-Object { $_.id })

$common = $newIds | Where-Object { $oldIds -contains $_ }
$onlyNew = $newIds | Where-Object { $oldIds -notcontains $_ }
$onlyOld = $oldIds | Where-Object { $newIds -notcontains $_ }

Write-Host ""
Write-Host "=== INTERSECTION ==="
Write-Host "Common: $($common.Count)"
Write-Host "Only NEW: $($onlyNew.Count)"
Write-Host "Only OLD: $($onlyOld.Count)"

if ($onlyNew.Count -gt 0) {
    Write-Host ""
    Write-Host "=== Only in NEW (sample 20) ==="
    $onlyNew | Select-Object -First 20 | ForEach-Object { Write-Host "  $_" }
}

if ($onlyOld.Count -gt 0) {
    Write-Host ""
    Write-Host "=== Only in OLD (sample 20) ==="
    $onlyOld | Select-Object -First 20 | ForEach-Object { Write-Host "  $_" }
}

Write-Host ""
Write-Host "=== Sample noun details ==="
if ($onlyNew.Count -gt 0) {
    Write-Host "In NEW (onlyNew[0]):"
    $onlyNewNoun = $newData.nouns | Where-Object { $_.id -eq $onlyNew[0] } | Select-Object -First 1
    if ($onlyNewNoun) {
        Write-Host "  Surface: $($onlyNewNoun.surface)"
        Write-Host "  Source: $($onlyNewNoun.source)"
        Write-Host "  Offset count: $($onlyNewNoun.offsets.Count)"
        Write-Host "  First 3 offsets:"
        $onlyNewNoun.offsets | Select-Object -First 3 | ForEach-Object {
            Write-Host "    page=$($_.page) start=$($_.start) end=$($_.end)"
        }
    }
}

if ($onlyOld.Count -gt 0) {
    Write-Host ""
    Write-Host "In OLD (onlyOld[0]):"
    $onlyOldNoun = $oldData.nouns | Where-Object { $_.id -eq $onlyOld[0] } | Select-Object -First 1
    if ($onlyOldNoun) {
        Write-Host "  Surface: $($onlyOldNoun.surface)"
        Write-Host "  Source: $($onlyOldNoun.source)"
        Write-Host "  Offset count: $($onlyOldNoun.offsets.Count)"
        Write-Host "  First 3 offsets:"
        $onlyOldNoun.offsets | Select-Object -First 3 | ForEach-Object {
            Write-Host "    page=$($_.page) start=$($_.start) end=$($_.end)"
        }
    }
}
