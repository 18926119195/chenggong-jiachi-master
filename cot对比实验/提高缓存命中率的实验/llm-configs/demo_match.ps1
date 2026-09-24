Set-Location -LiteralPath 'C:\Users\Administrator\Desktop\chenggong-jiachi-master\cot对比实验\提高缓存命中率的实验\llm-configs'
$content = [System.IO.File]::ReadAllText('reasoning-output-Z1-Q3.json', [System.Text.Encoding]::UTF8)
$lines = $content -split "`n"
$line23 = $lines[22]
$line24 = $lines[23]

$LB = [char]0x3010
$RB = [char]0x3011

Write-Host '=== FILE STATS ===' -ForegroundColor Cyan
Write-Host ('L23 length: ' + $line23.Length + ' chars')
Write-Host ('L24 length: ' + $line24.Length + ' chars')
Write-Host ''

$pattern23 = $LB + '(\d+)' + $RB
$regex23 = [regex]$pattern23
$matches23 = $regex23.Matches($line23)
$nums23 = @()
foreach ($m in $matches23) { $nums23 += $m.Groups[1].Value }
$unique23 = $nums23 | Sort-Object -Unique

Write-Host '=== L23 (thinkingChain) ===' -ForegroundColor Cyan
Write-Host ('Total N matches: ' + $matches23.Count)
Write-Host ('Unique numbers (' + $unique23.Count + '): ' + ($unique23 -join ', '))
Write-Host ''

$pattern24 = $LB + $LB + '(\d+)' + $RB + $RB
$regex24 = [regex]$pattern24
$matches24 = $regex24.Matches($line24)
$nums24 = @()
foreach ($m in $matches24) { $nums24 += $m.Groups[1].Value }
$unique24 = $nums24 | Sort-Object -Unique

Write-Host '=== L24 (llmOutput) ===' -ForegroundColor Cyan
Write-Host ('Total N matches: ' + $matches24.Count)
Write-Host ('Unique numbers (' + $unique24.Count + '): ' + ($unique24 -join ', '))
Write-Host ''

$missingIn23 = $unique24 | Where-Object { $_ -notin $unique23 }
$extraIn23 = $unique23 | Where-Object { $_ -notin $unique24 }

Write-Host '=== DIFF ===' -ForegroundColor Yellow
if ($missingIn23.Count -eq 0) {
    Write-Host 'All L24 numbers found in L23 (no hallucinations)' -ForegroundColor Green
} else {
    Write-Host ('L24 not in L23: ' + ($missingIn23 -join ', ')) -ForegroundColor Red
}
Write-Host ('L23 dropped: ' + ($extraIn23 -join ', '))
Write-Host ''

$tag224 = $LB + '224' + $RB
Write-Host '=== DEMO: tag 224 positions in L23 ===' -ForegroundColor Magenta
$positions = @()
$start = 0
while (($idx = $line23.IndexOf($tag224, $start)) -ge 0) {
    $positions += $idx
    $start = $idx + 1
}
Write-Host ('Total occurrences: ' + $positions.Count)
Write-Host ''
foreach ($pos in $positions) {
    $ctxStart = [Math]::Max(0, $pos - 70)
    $ctxEnd = [Math]::Min($line23.Length, $pos + 110)
    $snippet = $line23.Substring($ctxStart, $ctxEnd - $ctxStart) -replace "`n", ' ' -replace "`r", ''
    Write-Host ('[pos=' + $pos + '] ...' + $snippet + '...')
    Write-Host ''
}

Write-Host '=== SUMMARY ===' -ForegroundColor Cyan
foreach ($n in $unique24) {
    $count = ($nums23 | Where-Object { $_ -eq $n }).Count
    $status = if ($count -gt 0) { 'OK' } else { 'MISSING' }
    $color = if ($count -gt 0) { 'Green' } else { 'Red' }
    Write-Host ('tag ' + $n + ' -> L23 count: ' + $count + ' [' + $status + ']') -ForegroundColor $color
}
