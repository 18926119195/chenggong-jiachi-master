$content = [System.IO.File]::ReadAllText('reasoning-output-Z1-Q3.json', [System.Text.Encoding]::UTF8)
$lines = $content -split "`n"
$line24 = $lines[23]
$line23 = $lines[22]

$LB = [char]0x3010
$RB = [char]0x3011

$sb = New-Object System.Text.StringBuilder
$sep = [string]::new([char]0x3D, 78)
$dash = [string]::new([char]0x2D, 78)
$null = $sb.AppendLine($sep)
$null = $sb.AppendLine('L24 -> L23 PATH MAPPING')
$null = $sb.AppendLine($sep)

# Use Unicode range covering 一-十
$r24 = [regex]('#\s*\u8def\u5f84[\u4e00-\u56db]')
$h24 = @()
foreach ($m in $r24.Matches($line24)) {
    $cn = $m.Value.Trim().Substring($m.Value.Trim().Length - 1, 1)
    $h24 += @{n=$cn; p=$m.Index}
}
$h24 = @($h24 | Sort-Object p)

# Same for L23
$r23 = [regex]('#\s*\u8def\u5f84[\u4e00-\u56db]')
$h23 = @()
foreach ($m in $r23.Matches($line23)) {
    $cn = $m.Value.Trim().Substring($m.Value.Trim().Length - 1, 1)
    $h23 += @{n=$cn; p=$m.Index}
}
$h23 = @($h23 | Sort-Object p)

$null = $sb.AppendLine('L24 paths: ' + $h24.Count + ' | L23 paths: ' + $h23.Count)
$null = $sb.AppendLine('')

# Map chinese num -> arab
function Get-Arab([string]$cn) {
    switch -Regex ($cn) {
        '\u4e00' { return '1' }
        '\u4e8c' { return '2' }
        '\u4e09' { return '3' }
        '\u56db' { return '4' }
        '\u4e94' { return '5' }
        '\u516d' { return '6' }
        '\u4e03' { return '7' }
        '\u516b' { return '8' }
        '\u4e5d' { return '9' }
        '\u5341' { return '10' }
        default { return '?' }
    }
}

# Build all blocks
for ($i = 0; $i -lt $h24.Count; $i++) {
    $start = $h24[$i].p
    $end = if ($i+1 -lt $h24.Count) { $h24[$i+1].p } else { $line24.Length }
    $h24[$i].start = $start
    $h24[$i].end = $end
    $h24[$i].block = $line24.Substring($start, $end - $start)
}
for ($i = 0; $i -lt $h23.Count; $i++) {
    $start = $h23[$i].p
    $end = if ($i+1 -lt $h23.Count) { $h23[$i+1].p } else { $line23.Length }
    $h23[$i].start = $start
    $h23[$i].end = $end
    $h23[$i].block = $line23.Substring($start, $end - $start)
}

# Find chunks cited in L24 path block
$chunkRe = [regex]($LB + $LB + '(\d+)' + $RB + $RB)

# Similarity function
function Get-Sim([string]$a, [string]$b) {
    $ca = @(); foreach ($c in $a.ToCharArray()) { $ca += [int]$c }
    $cb = @(); foreach ($c in $b.ToCharArray()) { $cb += [int]$c }
    $shared = 0
    foreach ($x in $ca) { if ($cb -contains $x) { $shared++ } }
    if ($ca.Count + $cb.Count -eq 0) { return 0 }
    return [Math]::Round($shared * 2.0 / ($ca.Count + $cb.Count), 3)
}

# Per L24 path, do mapping
foreach ($p24 in $h24) {
    $arab24 = Get-Arab $p24.n

    $chunks = @()
    foreach ($cm in $chunkRe.Matches($p24.block)) { $chunks += $cm.Groups[1].Value }

    $null = $sb.AppendLine($dash)
    $null = $sb.AppendLine('L24 PATH ' + $arab24 + ' | Cited chunks: [' + ($chunks -join ', ') + ']')
    $null = $sb.AppendLine('Title: ' + $p24.block.Substring(0, [Math]::Min(200, $p24.block.Length)))
    $null = $sb.AppendLine('')

    # Find L23 paths that share chunks
    $matchedByChunks = @()
    foreach ($p23 in $h23) {
        $cnt = 0
        foreach ($ch in $chunks) {
            $marker = $LB + $ch + $RB
            if ($p23.block.IndexOf($marker) -ge 0) { $cnt++ }
        }
        if ($cnt -gt 0) {
            $matchedByChunks += @{
                path = $p23
                shared = $cnt
            }
        }
    }

    # Best title match
    $bestSim = 0; $bestPath = $null
    foreach ($p23 in $h23) {
        $s = Get-Sim $p24.block $p23.block
        if ($s -gt $bestSim) { $bestSim = $s; $bestPath = $p23 }
    }

    $null = $sb.AppendLine('L23 paths sharing cited chunks:')
    foreach ($m in $matchedByChunks) {
        $arab23 = Get-Arab $m.path.n
        $null = $sb.AppendLine('  P' + $arab23 + ' (shares ' + $m.shared + ' chunks)')
    }

    if ($bestPath) {
        $null = $sb.AppendLine('Best title match: P' + (Get-Arab $bestPath.n) + ' (sim=' + $bestSim + ')')
    }
    $null = $sb.AppendLine('')
}

# Summary
$null = $sb.AppendLine($sep)
$null = $sb.AppendLine('SUMMARY: L24# | Best Title Match | Chunks Co-occurrence')
$null = $sb.AppendLine($sep)
foreach ($p24 in $h24) {
    $arab24 = Get-Arab $p24.n
    $chunks = @()
    foreach ($cm in $chunkRe.Matches($p24.block)) { $chunks += $cm.Groups[1].Value }

    $bestSim = 0; $bestPath = $null
    foreach ($p23 in $h23) {
        $s = Get-Sim $p24.block $p23.block
        if ($s -gt $bestSim) { $bestSim = $s; $bestPath = $p23 }
    }

    # Co-occurring chunks
    $coOccur = @()
    foreach ($p23 in $h23) {
        $cnt = 0
        foreach ($ch in $chunks) {
            $marker = $LB + $ch + $RB
            if ($p23.block.IndexOf($marker) -ge 0) { $cnt++ }
        }
        if ($cnt -gt 0) {
            $coOccur += 'P' + (Get-Arab $p23.n) + '(' + $cnt + ')'
        }
    }

    $titleMatch = if ($bestPath) { 'P' + (Get-Arab $bestPath.n) + ' sim=' + $bestSim } else { '?' }
    $null = $sb.AppendLine('L24 P' + $arab24 + ' | Title: ' + $titleMatch + ' | Chunk-co: ' + ($coOccur -join ', '))
}

[System.IO.File]::WriteAllText('path_mapping_result.txt', $sb.ToString(), [System.Text.Encoding]::UTF8)
