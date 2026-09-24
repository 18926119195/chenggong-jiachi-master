$jsonData = ConvertFrom-Json ([System.IO.File]::ReadAllText('reasoning-output-Z1-Q3.json', [System.Text.Encoding]::UTF8))
$line24 = $jsonData.llmOutput
$line23 = $jsonData.thinkingChain

$LB = [char]0x3010
$RB = [char]0x3011

$sb = New-Object System.Text.StringBuilder
$sep = [string]::new([char]0x3D, 78)
$dash = [string]::new([char]0x2D, 78)

$null = $sb.AppendLine($sep)
$null = $sb.AppendLine('FINAL L24 -> L23 PATH MAPPING')
$null = $sb.AppendLine($sep)
$null = $sb.AppendLine('L23 (thinking) length: ' + $line23.Length + ' chars')
$null = $sb.AppendLine('L24 (output) length: ' + $line24.Length + ' chars')

# Build pattern with explicit chars
$lu = [string][char]0x8DEF
$jing = [string][char]0x5F84
$cnStr = ([string][char]0x4E00) + ([string][char]0x4E8C) + ([string][char]0x4E09) + ([string][char]0x56DB) + ([string][char]0x4E94) + ([string][char]0x516D) + ([string][char]0x4E03) + ([string][char]0x516B) + ([string][char]0x4E5D) + ([string][char]0x5341)

$pathPat = '#\s*' + $lu + $jing + '[' + $cnStr + ']'
$pathRe = [regex]($pathPat)

$chunkPat = $LB + $LB + '(\d+)' + $RB + $RB
$chunkRe = [regex]($chunkPat)

function Get-Arab([string]$cn) {
    $ord = [int][char]$cn
    switch ($ord) {
        0x4E00 { return '1' }
        0x4E8C { return '2' }
        0x4E09 { return '3' }
        0x56DB { return '4' }
        0x4E94 { return '5' }
        0x516D { return '6' }
        0x4E03 { return '7' }
        0x516B { return '8' }
        0x4E5D { return '9' }
        0x5341 { return '10' }
        default { return '?' }
    }
}

# Parse paths
$h24 = @()
foreach ($m in $pathRe.Matches($line24)) {
    $cn = $m.Value.Trim().Substring($m.Value.Trim().Length - 1, 1)
    $h24 += @{n=$cn; p=$m.Index}
}
$h24 = @($h24 | Sort-Object p)

$h23 = @()
foreach ($m in $pathRe.Matches($line23)) {
    $cn = $m.Value.Trim().Substring($m.Value.Trim().Length - 1, 1)
    $h23 += @{n=$cn; p=$m.Index}
}
$h23 = @($h23 | Sort-Object p)

$null = $sb.AppendLine('')
$null = $sb.AppendLine('L24 paths found: ' + $h24.Count)
$null = $sb.AppendLine('L23 paths found: ' + $h23.Count)

# Build blocks
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

# Title similarity (Jaccard on char set)
function Get-Sim([string]$a, [string]$b) {
    $ca = @(); foreach ($c in $a.ToCharArray()) { $ca += [int]$c }
    $cb = @(); foreach ($c in $b.ToCharArray()) { $cb += [int]$c }
    $shared = 0
    foreach ($x in $ca) { if ($cb -contains $x) { $shared++ } }
    if ($ca.Count + $cb.Count -eq 0) { return 0 }
    return [Math]::Round($shared * 2.0 / ($ca.Count + $cb.Count), 3)
}

$null = $sb.AppendLine('')
$null = $sb.AppendLine($sep)
$null = $sb.AppendLine('PER-PATH MAPPING (L24 -> L23)')
$null = $sb.AppendLine($sep)

foreach ($p24 in $h24) {
    $arab24 = Get-Arab $p24.n
    $chunks = @()
    foreach ($cm in $chunkRe.Matches($p24.block)) { $chunks += $cm.Groups[1].Value }

    $null = $sb.AppendLine('')
    $null = $sb.AppendLine($dash)
    $null = $sb.AppendLine('L24 PATH ' + $arab24)
    $null = $sb.AppendLine('Title: ' + $p24.block.Substring(0, [Math]::Min(150, $p24.block.Length)))
    $null = $sb.AppendLine('Cited chunks: [' + ($chunks -join ', ') + ']')

    # Find L23 paths that share these chunks
    $matchedByChunks = @()
    foreach ($p23 in $h23) {
        $shared = @()
        foreach ($ch in $chunks) {
            $marker = $LB + $ch + $RB
            if ($p23.block.IndexOf($marker) -ge 0) { $shared += $ch }
        }
        if ($shared.Count -gt 0) {
            $matchedByChunks += @{
                path = $p23
                shared = $shared
            }
        }
    }

    # Best title similarity
    $bestSim = 0; $bestPath = $null
    foreach ($p23 in $h23) {
        $s = Get-Sim $p24.block $p23.block
        if ($s -gt $bestSim) { $bestSim = $s; $bestPath = $p23 }
    }

    $null = $sb.AppendLine('')
    $null = $sb.AppendLine('L23 paths sharing cited chunks:')
    if ($matchedByChunks.Count -eq 0) {
        $null = $sb.AppendLine('  (none)')
    } else {
        foreach ($m in $matchedByChunks) {
            $arab23 = Get-Arab $m.path.n
            $null = $sb.AppendLine('  P' + $arab23 + ' shares chunks: [' + ($m.shared -join ', ') + ']')
        }
    }

    if ($bestPath) {
        $null = $sb.AppendLine('Best title match: L23 P' + (Get-Arab $bestPath.n) + ' (sim=' + $bestSim + ')')
    }
}

# Final summary table
$null = $sb.AppendLine('')
$null = $sb.AppendLine($sep)
$null = $sb.AppendLine('FINAL SUMMARY TABLE')
$null = $sb.AppendLine($sep)
$null = $sb.AppendLine('L24# | CitedChunks       | Title-Best L23# | Chunks-Best L23#')
$null = $sb.AppendLine($dash)

foreach ($p24 in $h24) {
    $arab24 = Get-Arab $p24.n
    $chunks = @()
    foreach ($cm in $chunkRe.Matches($p24.block)) { $chunks += $cm.Groups[1].Value }

    # Best title match
    $bestSim = 0; $bestPath = $null
    foreach ($p23 in $h23) {
        $s = Get-Sim $p24.block $p23.block
        if ($s -gt $bestSim) { $bestSim = $s; $bestPath = $p23 }
    }

    # Best chunk match (most shared chunks)
    $bestChunkCount = 0; $bestChunkPath = $null
    foreach ($p23 in $h23) {
        $cnt = 0
        foreach ($ch in $chunks) {
            $marker = $LB + $ch + $RB
            if ($p23.block.IndexOf($marker) -ge 0) { $cnt++ }
        }
        if ($cnt -gt $bestChunkCount) { $bestChunkCount = $cnt; $bestChunkPath = $p23 }
    }

    $titleMatch = if ($bestPath) { 'P' + (Get-Arab $bestPath.n) + '(' + $bestSim + ')' } else { '?' }
    $chunkMatch = if ($bestChunkPath) { 'P' + (Get-Arab $bestChunkPath.n) + '(' + $bestChunkCount + '/' + $chunks.Count + ')' } else { '?' }

    $null = $sb.AppendLine('P' + $arab24 + '   | [' + ($chunks -join ',') + ']' + (' ' * [Math]::Max(0, 16 - ($chunks -join ',').Length)) + ' | ' + $titleMatch + ' | ' + $chunkMatch)
}

[System.IO.File]::WriteAllText('path_mapping_result.txt', $sb.ToString(), [System.Text.Encoding]::UTF8)
