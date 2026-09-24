$ErrorActionPreference = 'Stop'

$jsonData = ConvertFrom-Json ([System.IO.File]::ReadAllText('reasoning-output-Z1-Q4.json', [System.Text.Encoding]::UTF8))
$line23 = [string]$jsonData.thinkingChain
$line24 = [string]$jsonData.llmOutput

$sb = New-Object System.Text.StringBuilder
$sep = [string]::new([char]0x3D, 80)
$dash = [string]::new([char]0x2D, 60)
$sub = [string]::new([char]0x2E, 50)

$LB = [string][char]0x3010
$RB = [string][char]0x3011
$singlePat = [string]$LB + '(\d+)' + [string]$RB
$doublePat = [string]$LB + [string]$LB + '(\d+)' + [string]$RB + [string]$RB

# Find all chunk positions in L23 (single bracket)
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
$null = $sb.AppendLine('Z1-Q4: PER-CHUNK THINKING EXTRACTION')
$null = $sb.AppendLine('For each (L24 path, chunk) pair, find the L23 commentary')
$null = $sb.AppendLine('that explains WHY this chunk belongs to this path.')
$null = $sb.AppendLine($sep)

# For each (path, chunk) pair, find the matching L23 commentary
# Strategy: find positions in L23 where the chunk is mentioned,
# then look for the discussion immediately after each mention

function Find-Chunk-Commentary([string]$chunkId, [int]$maxContexts = 4) {
    # Returns a list of (position, commentary_text) tuples
    if (-not $chunkPositions.ContainsKey($chunkId)) { return @() }
    $positions = $chunkPositions[$chunkId]
    $contexts = New-Object 'System.Collections.Generic.List[object]'

    # Find the chunk mention and the discussion right after it
    foreach ($pos in $positions) {
        # The mention is like "- 【1060】" or "【1060】" - find it
        $mentionEnd = $pos + 7  # 【 + 4 digits + 】 = 7 chars
        # Look forward from mentionEnd for commentary
        # Commentary typically: the chunk's quoted text + Chinese commentary/interpretation
        $lookEnd = [Math]::Min($line23.Length, $mentionEnd + 500)

        # Extract the chunk mention line
        $lineStart = $pos
        while ($lineStart -gt 0 -and $line23[$lineStart - 1] -ne "`n") {
            $lineStart--
        }
        $mentionLineEnd = $mentionEnd
        while ($mentionLineEnd -lt $line23.Length -and $line23[$mentionLineEnd] -ne "`n") {
            $mentionLineEnd++
        }
        $mentionLine = $line23.Substring($lineStart, $mentionLineEnd - $lineStart)

        # Extract commentary - the next 1-3 lines after the chunk mention
        $commentary = ''
        $nlCount = 0
        $cursor = $mentionLineEnd
        while ($cursor -lt $line23.Length -and $nlCount -lt 3) {
            $nl = $line23.IndexOf("`n", $cursor)
            if ($nl -lt 0 -or $nl -ge $lookEnd) { break }
            $line = $line23.Substring($cursor, $nl - $cursor)
            $commentary += $line + "`n"
            $cursor = $nl + 1
            $nlCount++
        }

        if ($commentary.Trim().Length -gt 10) {
            $contexts.Add(@{ pos = $pos; mention = $mentionLine; commentary = $commentary.Trim() })
        }
        if ($contexts.Count -ge $maxContexts) { break }
    }
    return $contexts
}

foreach ($p in $paths24) {
    $null = $sb.AppendLine('')
    $null = $sb.AppendLine($dash)
    $null = $sb.AppendLine('PATH: ' + $p.title)
    $null = $sb.AppendLine('Cited chunks: [' + ($p.chunks -join ', ') + ']')
    $null = $sb.AppendLine($dash)

    foreach ($c in $p.chunks) {
        $null = $sb.AppendLine('')
        $null = $sb.AppendLine('  ' + $sub)
        $null = $sb.AppendLine('  CHUNK ' + $c + ' IN PATH "' + $p.title + '"')
        $null = $sb.AppendLine('  ' + $sub)

        $contexts = Find-Chunk-Commentary $c 4

        if ($contexts.Count -eq 0) {
            $null = $sb.AppendLine('  [No commentary found in L23 for this chunk]')
        } else {
            $idx = 0
            foreach ($ctx in $contexts) {
                $idx++
                $null = $sb.AppendLine('  --- Context #' + $idx + ' (L23 pos=' + $ctx.pos + ') ---')
                $null = $sb.AppendLine('  Mention: ' + $ctx.mention)
                $null = $sb.AppendLine('  Reasoning (L23 commentary after this chunk mention):')
                foreach ($line in ($ctx.commentary -split "`n")) {
                    $null = $sb.AppendLine('    | ' + $line)
                }
                $null = $sb.AppendLine('')
            }
        }
    }
}

[System.IO.File]::WriteAllText('z1q4_per_chunk_reasoning.txt', $sb.ToString(), [System.Text.Encoding]::UTF8)
Write-Host "Done. Output written to z1q4_per_chunk_reasoning.txt"
