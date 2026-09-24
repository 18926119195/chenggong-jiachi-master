$ErrorActionPreference = 'Stop'

$jsonData = ConvertFrom-Json ([System.IO.File]::ReadAllText('reasoning-output-Z1-Q4.json', [System.Text.Encoding]::UTF8))
$line23 = [string]$jsonData.thinkingChain
$line24 = [string]$jsonData.llmOutput

$sb = New-Object System.Text.StringBuilder
$sep = [string]::new([char]0x3D, 80)
$dash = [string]::new([char]0x2D, 60)

$LB = [string][char]0x3010
$RB = [string][char]0x3011
$singlePat = [string]$LB + '(\d+)' + [string]$RB
$doublePat = [string]$LB + [string]$LB + '(\d+)' + [string]$RB + [string]$RB

# Find all chunk positions in L23
$matches23 = [System.Text.RegularExpressions.Regex]::Matches($line23, $singlePat)
$chunkPositions = @{}
foreach ($m in $matches23) {
    $n = $m.Groups[1].Value
    if (-not $chunkPositions.ContainsKey($n)) {
        $chunkPositions[$n] = New-Object System.Collections.Generic.List[int]
    }
    $chunkPositions[$n].Add($m.Index)
}

# Extract L24 paths
$lu = [string][char]0x8DEF
$jing = [string][char]0x5F84
$cnStr = ([string][char]0x4E00) + ([string][char]0x4E8C) + ([string][char]0x4E09) + ([string][char]0x56DB) + ([string][char]0x4E94) + ([string][char]0x516D) + ([string][char]0x4E03) + ([string][char]0x516B) + ([string][char]0x4E5D) + ([string][char]0x5341)
$pathPat = '#\s*' + $lu + $jing + '[' + $cnStr + '][^#]*'
$pathMatches = [System.Text.RegularExpressions.Regex]::Matches($line24, $pathPat)

$paths24 = New-Object 'System.Collections.Generic.List[object]'
foreach ($m in $pathMatches) {
    $block = $m.Value
    $newlineIdx = $block.IndexOf("`n")
    $title = if ($newlineIdx -gt 0) { $block.Substring(0, $newlineIdx).Trim() } else { $block.Substring(0, [Math]::Min(80, $block.Length)) }
    $chunks = @()
    $chunkMatches = [System.Text.RegularExpressions.Regex]::Matches($block, $doublePat)
    foreach ($cm in $chunkMatches) { $chunks += $cm.Groups[1].Value }
    $uniqueChunks = ($chunks | Sort-Object -Unique)
    $paths24.Add(@{ title = $title; chunks = $uniqueChunks })
}

$null = $sb.AppendLine($sep)
$null = $sb.AppendLine('Z1-Q4: CLUSTER ANALYSIS OF L23 CHUNK POSITIONS PER L24 PATH')
$null = $sb.AppendLine($sep)
$null = $sb.AppendLine('')
$null = $sb.AppendLine('Hypothesis: For each L24 path, the L23 chunk positions should cluster')
$null = $sb.AppendLine('around the same planning section. Each cluster = the L23 thinking for that path.')
$null = $sb.AppendLine('')

# For each L24 path, gather all positions and cluster them
function Cluster-Positions($positions, $gap = 500) {
    if ($positions.Count -eq 0) { return @() }
    $sorted = $positions | Sort-Object
    $clusters = New-Object 'System.Collections.Generic.List[object]'
    $current = New-Object System.Collections.Generic.List[int]
    $current.Add($sorted[0])
    for ($i = 1; $i -lt $sorted.Count; $i++) {
        if ($sorted[$i] - $sorted[$i-1] -gt $gap) {
            $clusters.Add($current)
            $current = New-Object System.Collections.Generic.List[int]
        }
        $current.Add($sorted[$i])
    }
    $clusters.Add($current)
    return $clusters
}

foreach ($p in $paths24) {
    $null = $sb.AppendLine($dash)
    $null = $sb.AppendLine('PATH: ' + $p.title)
    $null = $sb.AppendLine('Cited chunks in L24: [' + ($p.chunks -join ', ') + ']')
    $null = $sb.AppendLine($dash)

    $allPos = New-Object System.Collections.Generic.List[int]
    foreach ($c in $p.chunks) {
        if ($chunkPositions.ContainsKey($c)) {
            foreach ($pos in $chunkPositions[$c]) { $allPos.Add($pos) }
        }
    }
    $allPos = @($allPos | Sort-Object)

    $null = $sb.AppendLine('All L23 positions of cited chunks (sorted): [' + ($allPos -join ', ') + ']')

    # Cluster by gaps > 500
    $clusters = Cluster-Positions $allPos 500
    $null = $sb.AppendLine('')
    $null = $sb.AppendLine('Clusters (gap > 500 chars between clusters):')
    $ci = 0
    foreach ($cluster in $clusters) {
        $ci++
        $minP = ($cluster | Measure-Object -Minimum).Minimum
        $maxP = ($cluster | Measure-Object -Maximum).Maximum
        $null = $sb.AppendLine('  Cluster ' + $ci + ': ' + $cluster.Count + ' positions, range [' + $minP + ' - ' + $maxP + ']')

        # Extract content
        $ctxStart = [Math]::Max(0, $minP - 200)
        $ctxEnd = [Math]::Min($line23.Length, $maxP + 400)
        $ctx = $line23.Substring($ctxStart, $ctxEnd - $ctxStart)
        $null = $sb.AppendLine('  >>> Content (L23[' + $ctxStart + ' - ' + $ctxEnd + ']):')
        $lines = $ctx -split "`n"
        $maxLines = 30
        $lineCount = 0
        foreach ($line in $lines) {
            if ($lineCount -ge $maxLines) { $null = $sb.AppendLine('  ... (truncated)'); break }
            $null = $sb.AppendLine('    ' + $line)
            $lineCount++
        }
        $null = $sb.AppendLine('  <<<')
        $null = $sb.AppendLine('')
    }
}

[System.IO.File]::WriteAllText('q4_cluster_analysis.txt', $sb.ToString(), [System.Text.Encoding]::UTF8)
Write-Host "Done. Output written to q4_cluster_analysis.txt"
