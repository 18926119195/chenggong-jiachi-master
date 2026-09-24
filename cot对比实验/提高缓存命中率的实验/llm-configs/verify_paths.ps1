$content = [System.IO.File]::ReadAllText('reasoning-output-Z1-Q3.json', [System.Text.Encoding]::UTF8)
$lines = $content -split "`n"
$line23 = $lines[22]
$line24 = $lines[23]

$sep = '=' * 70

$sb = New-Object System.Text.StringBuilder

$null = $sb.AppendLine($sep)
$null = $sb.AppendLine('L23 PATH MARKERS')
$null = $sb.AppendLine($sep)

# English: "Path N" 
$regexEn = [regex]'(?i)\bpath\s*(\d+)\b'
$pathsEn = @()
foreach ($m in $regexEn.Matches($line23)) {
    $n = $m.Groups[1].Value
    $pos = $m.Index
    $ctx = $line23.Substring([Math]::Max(0,$pos-30), [Math]::Min(100, $line23.Length-$pos+30))
    $ctx = $ctx -replace "`n", ' ' -replace "`r", ''
    $pathsEn += @{ num = $n; pos = $pos; ctx = $ctx }
}

# Chinese: "lu jing" (path) + chinese number 
$zhMap = @{ [char]0x4E00='1'; [char]0x4E8C='2'; [char]0x4E09='3'; [char]0x56DB='4'; [char]0x4E94='5'; [char]0x516D='6'; [char]0x4E03='7'; [char]0x516B='8'; [char]0x4E5D='9'; [char]0x5341='10' }
$regexZh = New-Object System.Text.RegularExpressions.Regex([string]::Format([char]0x8DEF + [char]0x5F84 + '\s*([{0}{1}{2}{3}{4}{5}{6}{7}{8}{9}])\s*[{10}{11}]', [char]0x4E00, [char]0x4E8C, [char]0x4E09, [char]0x56DB, [char]0x4E94, [char]0x516D, [char]0x4E03, [char]0x516B, [char]0x4E5D, [char]0x5341, [char]0xFF1A, [char]0x003A))
$pathsZh = @()
foreach ($m in $regexZh.Matches($line23)) {
    $cn = $m.Groups[1].Value
    $n = $zhMap[$cn]
    if (-not $n) { $n = '?' }
    $pos = $m.Index
    $ctx = $line23.Substring([Math]::Max(0,$pos-30), [Math]::Min(100, $line23.Length-$pos+30))
    $ctx = $ctx -replace "`n", ' ' -replace "`r", ''
    $pathsZh += @{ num = $n; cn = $cn; pos = $pos; ctx = $ctx }
}

# Step markers
$regexStep = New-Object System.Text.RegularExpressions.Regex([string]::Format('(?:step|{0}{1}{2})\s*(\d+)\s*[{3}{4}]', [char]0x6B65, [char]0x9AA4, [char]0x3001, [char]0xFF1A, [char]0x003A))
$stepsEn = @()
foreach ($m in $regexStep.Matches($line23)) {
    $stepsEn += @{ num = $m.Groups[1].Value; pos = $m.Index }
}

$null = $sb.AppendLine('English Path markers: ' + $pathsEn.Count)
foreach ($p in $pathsEn) {
    $null = $sb.AppendLine('  Path ' + $p.num + ' @ ' + $p.pos + ': ' + $p.ctx)
}
$null = $sb.AppendLine('')
$null = $sb.AppendLine('Chinese 路径 markers: ' + $pathsZh.Count)
foreach ($p in $pathsZh) {
    $line = '  [' + $p.cn + '](' + $p.num + ') @ ' + $p.pos + ': ' + $p.ctx
    $null = $sb.AppendLine($line)
}
$null = $sb.AppendLine('')
$null = $sb.AppendLine('Step/步骤 markers: ' + $stepsEn.Count)
foreach ($s in $stepsEn) {
    $null = $sb.AppendLine('  step ' + $s.num + ' @ ' + $s.pos)
}

$null = $sb.AppendLine('')
$null = $sb.AppendLine($sep)
$null = $sb.AppendLine('L24 PATH MARKERS')
$null = $sb.AppendLine($sep)

$pathsEn24 = @()
foreach ($m in $regexEn.Matches($line24)) {
    $n = $m.Groups[1].Value
    $pos = $m.Index
    $ctx = $line24.Substring([Math]::Max(0,$pos-30), [Math]::Min(100, $line24.Length-$pos+30))
    $ctx = $ctx -replace "`n", ' ' -replace "`r", ''
    $pathsEn24 += @{ num = $n; pos = $pos; ctx = $ctx }
}

$pathsZh24 = @()
foreach ($m in $regexZh.Matches($line24)) {
    $cn = $m.Groups[1].Value
    $n = $zhMap[$cn]
    if (-not $n) { $n = '?' }
    $pos = $m.Index
    $ctx = $line24.Substring([Math]::Max(0,$pos-30), [Math]::Min(100, $line24.Length-$pos+30))
    $ctx = $ctx -replace "`n", ' ' -replace "`r", ''
    $pathsZh24 += @{ num = $n; cn = $cn; pos = $pos; ctx = $ctx }
}

$steps24 = @()
foreach ($m in $regexStep.Matches($line24)) {
    $steps24 += @{ num = $m.Groups[1].Value; pos = $m.Index }
}

$null = $sb.AppendLine('English Path markers: ' + $pathsEn24.Count)
foreach ($p in $pathsEn24) {
    $null = $sb.AppendLine('  Path ' + $p.num + ' @ ' + $p.pos + ': ' + $p.ctx)
}
$null = $sb.AppendLine('')
$null = $sb.AppendLine('Chinese 路径 markers: ' + $pathsZh24.Count)
foreach ($p in $pathsZh24) {
    $line = '  [' + $p.cn + '](' + $p.num + ') @ ' + $p.pos + ': ' + $p.ctx
    $null = $sb.AppendLine($line)
}
$null = $sb.AppendLine('')
$null = $sb.AppendLine('Step/步骤 markers: ' + $steps24.Count)
foreach ($s in $steps24) {
    $null = $sb.AppendLine('  step ' + $s.num + ' @ ' + $s.pos)
}

$null = $sb.AppendLine('')
$null = $sb.AppendLine($sep)
$null = $sb.AppendLine('COMPARISON')
$null = $sb.AppendLine($sep)

$l23PathNums = @()
$l23PathNums += $pathsEn | ForEach-Object { $_.num }
$l23PathNums += $pathsZh | ForEach-Object { $_.num }
$l23PathNums = @($l23PathNums | Sort-Object -Unique)

$l24PathNums = @()
$l24PathNums += $pathsEn24 | ForEach-Object { $_.num }
$l24PathNums += $pathsZh24 | ForEach-Object { $_.num }
$l24PathNums = @($l24PathNums | Sort-Object -Unique)

$null = $sb.AppendLine('L23 path numbers: [' + ($l23PathNums -join ', ') + ']')
$null = $sb.AppendLine('L24 path numbers: [' + ($l24PathNums -join ', ') + ']')

$l23StepNums = @($stepsEn | ForEach-Object { $_.num })
$l24StepNums = @($steps24 | ForEach-Object { $_.num })

$null = $sb.AppendLine('L23 step numbers: [' + ($l23StepNums -join ', ') + ']')
$null = $sb.AppendLine('L24 step numbers: [' + ($l24StepNums -join ', ') + ']')

$out = $sb.ToString()
[System.IO.File]::WriteAllText('path_step_analysis.txt', $out, [System.Text.Encoding]::UTF8)
Write-Host 'Done.'
