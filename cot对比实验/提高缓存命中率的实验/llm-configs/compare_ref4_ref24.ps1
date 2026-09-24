$content = [System.IO.File]::ReadAllText('reasoning-output-Z1-Q3.json', [System.Text.Encoding]::UTF8)
$lines = $content -split "`n"
$line23 = $lines[22]
$line24 = $lines[23]

$LB = [char]0x3010
$RB = [char]0x3011

$regex23 = [regex]($LB + '(\d+)' + $RB)
$allMarkers = @()
foreach ($m in $regex23.Matches($line23)) {
    $allMarkers += @{ num = $m.Groups[1].Value; pos = $m.Index; mlen = $m.Length }
}

for ($i = 0; $i -lt $allMarkers.Count; $i++) {
    if ($i -gt 0) { $startPos = $allMarkers[$i-1].pos + $allMarkers[$i-1].mlen } else { $startPos = 0 }
    $endPos = $allMarkers[$i].pos
    $beforeText = $line23.Substring($startPos, $endPos - $startPos).Trim()
    $beforeText = $beforeText -replace "`n", " " -replace "`r", ""
    if ($beforeText.Length -gt 400) { $beforeText = $beforeText.Substring($beforeText.Length - 400) }
    $beforeText = "..." + $beforeText
    $allMarkers[$i] | Add-Member -NotePropertyName "before" -NotePropertyValue $beforeText
}

$regex24 = [regex]($LB + $LB + '(\d+)' + $RB + $RB)
$l24Numbers = @()
foreach ($m in $regex24.Matches($line24)) { $l24Numbers += $m.Groups[1].Value }

$lookup = @{}
foreach ($mkr in $allMarkers) {
    $n = $mkr.num
    if (-not $lookup.ContainsKey($n)) { $lookup[$n] = @() }
    $lookup[$n] += $mkr.before
}

# Find the L24 positions of [[224]] in REF#4 and REF#24
$refCount = 0
$ref4Idx = $null
$ref24Idx = $null
foreach ($n in $l24Numbers) {
    $refCount++
    if ($refCount -eq 4) { $ref4Idx = $refCount }
    if ($refCount -eq 24) { $ref24Idx = $refCount }
}

$tag = "[[224]]"
$entries = $lookup["224"]

$sb = New-Object System.Text.StringBuilder
$null = $sb.AppendLine("============================================================")
$null = $sb.AppendLine("对比：所有 REF#(4) 和 REF#(24) 对应的 before-text（同一 [[224]])")
$null = $sb.AppendLine("共 $($entries.Count) 处引用，展示每处 unique 内容")
$null = $sb.AppendLine("============================================================")

$seen = @{}
$uniqIdx = 0
$idx = 1
foreach ($bt in $entries) {
    $clean = $bt -replace '\s+', ' '
    $key = $clean
    $isDup = $false
    foreach ($k in $seen.Keys) {
        if ([Math]::Abs($clean.Length - $k.Length) -lt 50 -and $clean.Substring([Math]::Max(0,$clean.Length-100)) -eq $k.Substring([Math]::Max(0,$k.Length-100))) {
            $isDup = $true
            $null = $sb.AppendLine("")
            $null = $sb.AppendLine("[L23引用# $idx] -> L24 REF#$($seen[$k]) [DUPLICATE of # $($seen[$k])]")
            break
        }
    }
    if (-not $isDup) {
        $uniqIdx++
        $seen[$clean] = $uniqIdx
        $null = $sb.AppendLine("")
        $null = $sb.AppendLine("[L23引用# $idx] -> 唯一模板 #$uniqIdx")
        $null = $sb.AppendLine($clean)
    }
    $idx++
}

$out = $sb.ToString()
[System.IO.File]::WriteAllText('ref224_comparison.txt', $out, [System.Text.Encoding]::UTF8)
Write-Host "Done. Found $($entries.Count) L23 refs for [[224]], unique groups shown."
