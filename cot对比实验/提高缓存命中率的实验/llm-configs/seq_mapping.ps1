$content = [System.IO.File]::ReadAllText('reasoning-output-Z1-Q3.json', [System.Text.Encoding]::UTF8)
$lines = $content -split "`n"
$line23 = $lines[22]
$line24 = $lines[23]

$LB = [char]0x3010
$RB = [char]0x3011

# L23: single 【N】, extract (pos, num, beforeText, afterText)
$regex23 = [regex]($LB + '(\d+)' + $RB)
$l23Items = @()
foreach ($m in $regex23.Matches($line23)) {
    $num = $m.Groups[1].Value
    $pos = $m.Index
    $mlen = $m.Length
    # afterText = the marker itself + next 200 chars
    $end = [Math]::Min($line23.Length, $pos + $mlen + 200)
    $afterText = $line23.Substring($pos + $mlen, $end - $pos - $mlen).Trim()
    $afterText = $afterText -replace "`n", " " -replace "`r", ""
    if ($afterText.Length -gt 200) { $afterText = $afterText.Substring(0, 200) + "..." }
    # beforeText = 400 chars before marker
    $start = [Math]::Max(0, $pos - 400)
    $beforeText = $line23.Substring($start, $pos - $start).Trim()
    $beforeText = $beforeText -replace "`n", " " -replace "`r", ""
    if ($beforeText.Length -gt 400) { $beforeText = "..." + $beforeText.Substring($beforeText.Length - 400) }
    $l23Items += @{
        idx = $l23Items.Count + 1
        num = $num
        pos = $pos
        beforeText = $beforeText
        afterText = $afterText
    }
}

# L24: double 【【N】】, extract (pos, num, afterText)
$regex24 = [regex]($LB + $LB + '(\d+)' + $RB + $RB)
$l24Items = @()
foreach ($m in $regex24.Matches($line24)) {
    $num = $m.Groups[1].Value
    $pos = $m.Index
    $mlen = $m.Length
    $end = [Math]::Min($line24.Length, $pos + $mlen + 200)
    $afterText = $line24.Substring($pos + $mlen, $end - $pos - $mlen).Trim()
    $afterText = $afterText -replace "`n", " " -replace "`r", ""
    if ($afterText.Length -gt 200) { $afterText = $afterText.Substring(0, 200) + "..." }
    $l24Items += @{
        idx = $l24Items.Count + 1
        num = $num
        pos = $pos
        afterText = $afterText
    }
}

$sb = New-Object System.Text.StringBuilder
$maxK = [Math]::Min($l23Items.Count, $l24Items.Count)
$null = $sb.AppendLine("L23 total 【N】: $($l23Items.Count)")
$null = $sb.AppendLine("L24 total 【【N】】: $($l24Items.Count)")
$null = $sb.AppendLine("Match count: $maxK")
$null = $sb.AppendLine("")
$null = $sb.AppendLine("================================================================")
$null = $sb.AppendLine("顺序对应（L23第k个 vs L24第k个）")
$null = $sb.AppendLine("================================================================")

for ($k = 0; $k -lt $maxK; $k++) {
    $l23 = $l23Items[$k]
    $l24 = $l24Items[$k]
    $match = if ($l23.num -eq $l24.num) { "✓ NUM_MATCH" } else { "✗ NUM_MISMATCH (L23=$($l23.num) vs L24=$($l24.num))" }
    $null = $sb.AppendLine("")
    $null = $sb.AppendLine("### Pair $k ### $match")
    $null = $sb.AppendLine("--- L23 #$($l23.idx) [N=$($l23.num)] ---")
    $null = $sb.AppendLine("before: $($l23.beforeText)")
    $null = $sb.AppendLine("after:  $($l23.afterText)")
    $null = $sb.AppendLine("--- L24 #$($l24.idx) [N=$($l24.num)] ---")
    $null = $sb.AppendLine("after:  $($l24.afterText)")
}

$out = $sb.ToString()
[System.IO.File]::WriteAllText('seq_mapping.txt', $out, [System.Text.Encoding]::UTF8)
Write-Host "Done. L23=$($l23Items.Count), L24=$($l24Items.Count), matched=$maxK"
