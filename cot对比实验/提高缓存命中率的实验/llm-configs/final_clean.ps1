$jsonData = ConvertFrom-Json ([System.IO.File]::ReadAllText('reasoning-output-Z1-Q3.json', [System.Text.Encoding]::UTF8))
$line24 = $jsonData.llmOutput
$line23 = $jsonData.thinkingChain

$LB = [char]0x3010
$RB = [char]0x3011

$sb = New-Object System.Text.StringBuilder
$sep = [string]::new([char]0x3D, 80)
$dash = [string]::new([char]0x2D, 80)

# Build pattern with explicit chars
$cnStr = ([string][char]0x4E00) + ([string][char]0x4E8C) + ([string][char]0x4E09) + ([string][char]0x56DB) + ([string][char]0x4E94) + ([string][char]0x516D) + ([string][char]0x4E03) + ([string][char]0x516B) + ([string][char]0x4E5D) + ([string][char]0x5341)
$lu = [string][char]0x8DEF
$jing = [string][char]0x5F84
$pathPat = '#\s*' + $lu + $jing + '[' + $cnStr + ']'
$pathRe = [regex]($pathPat)

function Get-Arab([string]$cn) {
    if ($cn.Length -ne 1) { return '?' }
    $ord = [int][char]$cn
    switch ($ord) {
        19968 { return '1' }
        20108 { return '2' }
        19977 { return '3' }
        22235 { return '4' }
        20116 { return '5' }
        20845 { return '6' }
        19971 { return '7' }
        20872 { return '8' }
        20197 { return '9' }
        default { return '?' }
    }
}

# Parse paths with .NET array
function ParsePaths([string]$text) {
    $matches = $pathRe.Matches($text)
    $arr = New-Object 'System.Collections.Generic.List[object]'
    foreach ($m in $matches) {
        $cn = $m.Value.Substring($m.Value.Length - 1, 1)
        $obj = New-Object PSObject -Property @{ n = $cn; p = $m.Index }
        $arr.Add($obj)
    }
    return $arr
}

$paths24 = ParsePaths $line24
$paths23 = ParsePaths $line23

$null = $sb.AppendLine($sep)
$null = $sb.AppendLine('L24 -> L23 PATH MAPPING (final, clean version)')
$null = $sb.AppendLine($sep)
$null = $sb.AppendLine('L23 length: ' + $line23.Length + ', paths: ' + $paths24.Count)
$null = $sb.AppendLine('L24 length: ' + $line24.Length + ', paths: ' + $paths24.Count)

# Build blocks - sort by position
$paths24Sorted = $paths24 | Sort-Object p
$paths23Sorted = $paths23 | Sort-Object p

$null = $sb.AppendLine('')
$null = $sb.AppendLine('L24 paths in order:')
foreach ($p in $paths24Sorted) {
    $arab = Get-Arab $p.n
    $null = $sb.AppendLine('  P' + $arab + ' @ pos=' + $p.p)
}
$null = $sb.AppendLine('')
$null = $sb.AppendLine('L23 paths in order:')
foreach ($p in $paths23Sorted) {
    $arab = Get-Arab $p.n
    $null = $sb.AppendLine('  P' + $arab + ' @ pos=' + $p.p)
}

# Build blocks
$blocks24 = New-Object 'System.Collections.Generic.List[object]'
for ($i = 0; $i -lt $paths24Sorted.Count; $i++) {
    $start = $paths24Sorted[$i].p
    $end = if ($i+1 -lt $paths24Sorted.Count) { $paths24Sorted[$i+1].p } else { $line24.Length }
    $block = $line24.Substring($start, $end - $start)
    $obj = New-Object PSObject -Property @{
        n = $paths24Sorted[$i].n
        arab = Get-Arab $paths24Sorted[$i].n
        p = $start
        block = $block
    }
    $blocks24.Add($obj)
}

$blocks23 = New-Object 'System.Collections.Generic.List[object]'
for ($i = 0; $i -lt $paths23Sorted.Count; $i++) {
    $start = $paths23Sorted[$i].p
    $end = if ($i+1 -lt $paths23Sorted.Count) { $paths23Sorted[$i+1].p } else { $line23.Length }
    $block = $line23.Substring($start, $end - $start)
    $obj = New-Object PSObject -Property @{
        n = $paths23Sorted[$i].n
        arab = Get-Arab $paths23Sorted[$i].n
        p = $start
        block = $block
    }
    $blocks23.Add($obj)
}

# Chunk citation regex
$chunkRe = [regex]($LB + $LB + '(\d+)' + $RB + $RB)

# Title similarity (Jaccard on chars)
function Get-Sim([string]$a, [string]$b) {
    if ($a.Length -gt 1000) { $a = $a.Substring(0, 1000) }
    if ($b.Length -gt 1000) { $b = $b.Substring(0, 1000) }
    $ca = @(); foreach ($c in $a.ToCharArray()) { $ca += [int]$c }
    $cb = @(); foreach ($c in $b.ToCharArray()) { $cb += [int]$c }
    $shared = 0
    foreach ($x in $ca) { if ($cb -contains $x) { $shared++ } }
    if ($ca.Count + $cb.Count -eq 0) { return 0 }
    return [Math]::Round($shared * 2.0 / ($ca.Count + $cb.Count), 3)
}

# Per-path mapping
$null = $sb.AppendLine('')
$null = $sb.AppendLine($sep)
$null = $sb.AppendLine('PER-PATH MAPPING: L24 -> L23')
$null = $sb.AppendLine($sep)

$summaryRows = @()

foreach ($b24 in $blocks24) {
    $arab24 = $b24.arab
    $chunks = @()
    foreach ($cm in $chunkRe.Matches($b24.block)) { $chunks += $cm.Groups[1].Value }

    $null = $sb.AppendLine('')
    $null = $sb.AppendLine($dash)
    $null = $sb.AppendLine('L24 PATH ' + $arab24)
    $titleShort = $b24.block.Substring(0, [Math]::Min(80, $b24.block.Length))
    $null = $sb.AppendLine('Title: ' + $titleShort + '...')
    $null = $sb.AppendLine('Cited chunks: [' + ($chunks -join ', ') + ']')

    # Find L23 paths sharing chunks
    $matchedByChunks = @()
    foreach ($b23 in $blocks23) {
        $shared = @()
        foreach ($ch in $chunks) {
            $marker = $LB + $ch + $RB
            if ($b23.block.IndexOf($marker) -ge 0) { $shared += $ch }
        }
        if ($shared.Count -gt 0) {
            $matchedByChunks += @{
                path = $b23
                shared = $shared
            }
        }
    }

    # Best title match
    $bestSim = 0; $bestPath = $null
    foreach ($b23 in $blocks23) {
        $s = Get-Sim $b24.block $b23.block
        if ($s -gt $bestSim) { $bestSim = $s; $bestPath = $b23 }
    }

    $null = $sb.AppendLine('')
    $null = $sb.AppendLine('L23 paths sharing cited chunks:')
    if ($matchedByChunks.Count -eq 0) {
        $null = $sb.AppendLine('  (none)')
    } else {
        foreach ($m in $matchedByChunks) {
            $null = $sb.AppendLine('  P' + $m.path.arab + ' shares [' + ($m.shared -join ', ') + ']')
        }
    }

    if ($bestPath) {
        $null = $sb.AppendLine('Best title match: L23 P' + $bestPath.arab + ' (sim=' + $bestSim + ')')
    }

    $summaryRows += @{
        l24 = 'P' + $arab24
        chunks = ($chunks -join ',')
        bestTitle = if ($bestPath) { 'P' + $bestPath.arab + '(' + $bestSim + ')' } else { '?' }
        bestChunk = if ($matchedByChunks.Count -gt 0) {
            $top = $matchedByChunks | Sort-Object { $_.shared.Count } -Descending | Select-Object -First 1
            'P' + $top.path.arab + '(' + $top.shared.Count + '/' + $chunks.Count + ')'
        } else { '-' }
    }
}

# Summary
$null = $sb.AppendLine('')
$null = $sb.AppendLine($sep)
$null = $sb.AppendLine('SUMMARY TABLE')
$null = $sb.AppendLine($sep)
$null = $sb.AppendLine('L24# | Cited Chunks          | Title-Best L23#   | Chunks-Best L23#')
$null = $sb.AppendLine($dash)

foreach ($row in $summaryRows) {
    $chunksStr = '[' + $row.chunks + ']'
    $null = $sb.AppendLine(($row.l24 + '   | ' + $chunksStr + (' ' * [Math]::Max(0, 22 - $chunksStr.Length)) + ' | ' + $row.bestTitle + (' ' * [Math]::Max(0, 18 - $row.bestTitle.Length)) + ' | ' + $row.bestChunk))
}

[System.IO.File]::WriteAllText('path_mapping_result.txt', $sb.ToString(), [System.Text.Encoding]::UTF8)
