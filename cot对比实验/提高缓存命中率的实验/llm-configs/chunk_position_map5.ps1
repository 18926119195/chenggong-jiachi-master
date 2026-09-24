$ErrorActionPreference = 'Stop'

$jsonData = ConvertFrom-Json ([System.IO.File]::ReadAllText('reasoning-output-Z1-Q4.json', [System.Text.Encoding]::UTF8))
$line23 = [string]$jsonData.thinkingChain
$line24 = [string]$jsonData.llmOutput

$sb = New-Object System.Text.StringBuilder
$sep = [string]::new([char]0x3D, 80)
$dash = [string]::new([char]0x2D, 60)

$LB = [string][char]0x3010  # 【
$RB = [string][char]0x3011  # 】

# Use [char] cast inside the pattern to avoid issues
$singlePat = [string]$LB + '(\d+)' + [string]$RB
$doublePat = [string]$LB + [string]$LB + '(\d+)' + [string]$RB + [string]$RB

# Use the static Regex.Match / Regex.Matches method directly
$test = 'hello ' + $LB + '123' + $RB + ' world'
$testMatches = [System.Text.RegularExpressions.Regex]::Matches($test, $singlePat)
Write-Host "Test pattern length: $($singlePat.Length)"
Write-Host "Test matches count: $($testMatches.Count)"

# Find all chunk positions in L23
$chunkPositions = @{}
$matches23 = [System.Text.RegularExpressions.Regex]::Matches($line23, $singlePat)
Write-Host "L23 single-bracket matches: $($matches23.Count)"

foreach ($m in $matches23) {
    $n = $m.Groups[1].Value
    if (-not $chunkPositions.ContainsKey($n)) {
        $chunkPositions[$n] = New-Object System.Collections.Generic.List[int]
    }
    $chunkPositions[$n].Add($m.Index)
}

# Extract L24 paths and chunks
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
$null = $sb.AppendLine('Z1-Q4: CHUNK-BASED POSITION MAPPING')
$null = $sb.AppendLine($sep)
$null = $sb.AppendLine('')
$null = $sb.AppendLine('L23 length: ' + $line23.Length)
$null = $sb.AppendLine('L24 length: ' + $line24.Length)
$null = $sb.AppendLine('Total unique chunks mentioned in L23: ' + $chunkPositions.Count)
$null = $sb.AppendLine('L24 has ' + $paths24.Count + ' paths')
$null = $sb.AppendLine('')

# List chunks in L23 reading order
$null = $sb.AppendLine('L23 chunks in reading order:')
$readingOrder = New-Object System.Collections.Generic.List[int]
foreach ($m in $matches23) {
    $readingOrder.Add([int]$m.Groups[1].Value)
}
$null = $sb.AppendLine('  [' + (($readingOrder | ForEach-Object { $_ }) -join ', ') + ']')
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

# Coverage summary
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

# Reading order comparison
$null = $sb.AppendLine('')
$null = $sb.AppendLine($sep)
$null = $sb.AppendLine('CHUNK READING ORDER IN L23 vs L24 CITATION ORDER')
$null = $sb.AppendLine($sep)

# Compute chunk ranges in L23
$null = $sb.AppendLine('L23 reading sequence:')
$null = $sb.AppendLine('  Position 0 -> no chunk mentioned yet (meta planning)')
$null = $sb.AppendLine('')
foreach ($c in $chunkPositions.Keys | Sort-Object { [int]$_ }) {
    $positions = $chunkPositions[$c]
    $posList = ($positions | ForEach-Object { $_ }) -join ', '
    $null = $sb.AppendLine('  Chunk ' + $c + ' at L23 pos [' + $posList + ']')
}

[System.IO.File]::WriteAllText('q4_chunk_mapping.txt', $sb.ToString(), [System.Text.Encoding]::UTF8)
Write-Host "Done. Output written to q4_chunk_mapping.txt"
