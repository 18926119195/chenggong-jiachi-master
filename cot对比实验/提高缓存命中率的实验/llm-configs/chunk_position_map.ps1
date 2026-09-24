$jsonData = ConvertFrom-Json ([System.IO.File]::ReadAllText('reasoning-output-Z1-Q4.json', [System.Text.Encoding]::UTF8))
$line23 = $jsonData.thinkingChain
$line24 = $jsonData.llmOutput

$sb = New-Object System.Text.StringBuilder
$sep = [string]::new([char]0x3D, 100)
$dash = [string]::new([char]0x2D, 60)

$LB = [char]0x3010
$RB = [char]0x3011

# Regex for both single-bracket 【N】 and double-bracket 【【N】】
$singleRe = New-Object System.Text.RegularExpressions.Regex('\[(\d+)\]')
$doubleRe = New-Object System.Text.RegularExpressions.Regex('\[\[(\d+)\]\]')

# Find all chunk mentions in L23 (both single and double bracket)
function Get-All-Chunk-Positions([string]$text) {
    $results = @{}
    foreach ($m in $singleRe.Matches($text)) {
        $n = $m.Groups[1].Value
        if (-not $results.ContainsKey($n)) { $results[$n] = New-Object System.Collections.Generic.List[int] }
        $results[$n].Add($m.Index)
    }
    return $results
}

# Extract L24 path -> chunks mapping
function Get-L24-Path-Chunks([string]$text) {
    $lu = [string][char]0x8DEF
    $jing = [string][char]0x5F84
    $cnStr = ([string][char]0x4E00) + ([string][char]0x4E8C) + ([string][char]0x4E09) + ([string][char]0x56DB) + ([string][char]0x4E94) + ([string][char]0x516D) + ([string][char]0x4E03) + ([string][char]0x516B) + ([string][char]0x4E5D) + ([string][char]0x5341)
    $pathRe = New-Object System.Text.RegularExpressions.Regex('#\s*' + $lu + $jing + '[' + $cnStr + '][^#]*')

    $matches = $pathRe.Matches($text)
    $arr = New-Object 'System.Collections.Generic.List[object]'
    foreach ($m in $matches) {
        $block = $m.Value
        $newlineIdx = $block.IndexOf("`n")
        $title = if ($newlineIdx -gt 0) { $block.Substring(0, $newlineIdx).Trim() } else { $block.Substring(0, [Math]::Min(80, $block.Length)) }
        $chunks = @()
        foreach ($cm in $doubleRe.Matches($block)) { $chunks += $cm.Groups[1].Value }
        $uniqueChunks = ($chunks | Sort-Object -Unique)
        $arr.Add(@{ title = $title; chunks = $uniqueChunks; block = $block })
    }
    return $arr
}

$paths24 = Get-L24-Path-Chunks $line24
$chunkPositions = Get-All-Chunk-Positions $line23

$null = $sb.AppendLine($sep)
$null = $sb.AppendLine('Z1-Q4: CHUNK-BASED POSITION MAPPING')
$null = $sb.AppendLine($sep)
$null = $sb.AppendLine('')
$null = $sb.AppendLine('L23 length: ' + $line23.Length)
$null = $sb.AppendLine('Total unique chunks mentioned in L23: ' + $chunkPositions.Count)
$null = $sb.AppendLine('L24 has ' + $paths24.Count + ' paths')

# For each L24 path, find positions of cited chunks in L23
$null = $sb.AppendLine('')
$null = $sb.AppendLine($sep)
$null = $sb.AppendLine('PATH-BY-PATH: chunks cited in L24, positions in L23')
$null = $sb.AppendLine($sep)

foreach ($p in $paths24) {
    $null = $sb.AppendLine('')
    $null = $sb.AppendLine($dash)
    $null = $sb.AppendLine('PATH: ' + $p.title)
    $null = $sb.AppendLine('Cited chunks in L24: [' + ($p.chunks -join ', ') + ']')
    $null = $sb.AppendLine($dash)

    foreach ($c in $p.chunks) {
        if ($chunkPositions.ContainsKey($c)) {
            $positions = $chunkPositions[$c]
            $posList = ($positions | ForEach-Object { $_ }) -join ', '
            $null = $sb.AppendLine('  Chunk ' + $c + ' -> L23 positions: [' + $posList + ']')
        } else {
            $null = $sb.AppendLine('  Chunk ' + $c + ' -> NOT in L23')
        }
    }

    # Extract context around first L23 mention of any cited chunk
    $firstPos = -1
    $firstChunk = ''
    foreach ($c in $p.chunks) {
        if ($chunkPositions.ContainsKey($c)) {
            $p_val = $chunkPositions[$c][0]
            if ($firstPos -lt 0 -or $p_val -lt $firstPos) {
                $firstPos = $p_val
                $firstChunk = $c
            }
        }
    }

    if ($firstPos -ge 0) {
        $ctxStart = [Math]::Max(0, $firstPos - 150)
        $ctxEnd = [Math]::Min($line23.Length, $firstPos + 350)
        $ctx = $line23.Substring($ctxStart, $ctxEnd - $ctxStart)
        $null = $sb.AppendLine('')
        $null = $sb.AppendLine('  Context around first L23 mention of chunk ' + $firstChunk + ' (pos=' + $firstPos + '):')
        $null = $sb.AppendLine('  >>>')
        $null = $sb.AppendLine('  ' + ($ctx -replace "`n", "`n  "))
        $null = $sb.AppendLine('  <<<')
    }
}

$null = $sb.AppendLine('')
$null = $sb.AppendLine($sep)
$null = $sb.AppendLine('COVERAGE SUMMARY')
$null = $sb.AppendLine($sep)

$allCited24 = @()
foreach ($p in $paths24) { $allCited24 += $p.chunks }
$uniqueCited24 = ($allCited24 | Sort-Object -Unique)

$null = $sb.AppendLine('Unique chunks cited in L24: ' + $uniqueCited24.Count)
$null = $sb.AppendLine('Chunks found in L23: ' + (($uniqueCited24 | Where-Object { $chunkPositions.ContainsKey($_) }).Count))
$null = $sb.AppendLine('Chunks NOT found in L23: ' + (($uniqueCited24 | Where-Object { -not $chunkPositions.ContainsKey($_) }).Count))

$missingChunks = @()
foreach ($c in $uniqueCited24) { if (-not $chunkPositions.ContainsKey($c)) { $missingChunks += $c } }
if ($missingChunks.Count -gt 0) {
    $null = $sb.AppendLine('Missing chunks: [' + ($missingChunks -join ', ') + ']')
}

[System.IO.File]::WriteAllText('q4_chunk_mapping.txt', $sb.ToString(), [System.Text.Encoding]::UTF8)
