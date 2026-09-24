$jsonData = ConvertFrom-Json ([System.IO.File]::ReadAllText('reasoning-output-Z1-Q4.json', [System.Text.Encoding]::UTF8))
$line24 = $jsonData.llmOutput
$line23 = $jsonData.thinkingChain

$cnStr = ([string][char]0x4E00) + ([string][char]0x4E8C) + ([string][char]0x4E09) + ([string][char]0x56DB) + ([string][char]0x4E94) + ([string][char]0x516D) + ([string][char]0x4E03) + ([string][char]0x516B) + ([string][char]0x4E5D) + ([string][char]0x5341)
$lu = [string][char]0x8DEF
$jing = [string][char]0x5F84
$pathPat = '#\s*' + $lu + $jing + '[' + $cnStr + ']'
$pathRe = [regex]($pathPat)

$LB = [char]0x3010
$RB = [char]0x3011

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

function Extract-Path-Info([string]$text) {
    $matches = $pathRe.Matches($text)
    $arr = New-Object 'System.Collections.Generic.List[object]'
    for ($i = 0; $i -lt $matches.Count; $i++) {
        $start = $matches[$i].Index
        $end = if ($i+1 -lt $matches.Count) { $matches[$i+1].Index } else { $text.Length }
        $block = $text.Substring($start, $end - $start)
        $newlineIdx = $block.IndexOf("`n")
        if ($newlineIdx -gt 0) { $title = $block.Substring(0, $newlineIdx) }
        else { $title = $block.Substring(0, [Math]::Min(150, $block.Length)) }

        $cn = $matches[$i].Value.Substring($matches[$i].Value.Length - 1, 1)

        $chunkRe = [regex]($LB + $LB + '(\d+)' + $RB + $RB)
        $chunks = @()
        foreach ($cm in $chunkRe.Matches($block)) { $chunks += $cm.Groups[1].Value }
        $uniqueChunks = ($chunks | Sort-Object -Unique)

        $obj = New-Object PSObject -Property @{
            arab = Get-Arab $cn
            title = $title
            chunks = ($uniqueChunks -join ',')
            blockLen = $block.Length
        }
        $arr.Add($obj)
    }
    return $arr
}

$paths23 = Extract-Path-Info $line23
$paths24 = Extract-Path-Info $line24

$sb = New-Object System.Text.StringBuilder
$sep = [string]::new([char]0x3D, 100)
$dash = [string]::new([char]0x2D, 100)

$null = $sb.AppendLine($sep)
$null = $sb.AppendLine('Z1-Q4: PATH TITLES COMPARISON')
$null = $sb.AppendLine($sep)
$null = $sb.AppendLine('')
$null = $sb.AppendLine('L23 length: ' + $line23.Length)
$null = $sb.AppendLine('L24 length: ' + $line24.Length)
$null = $sb.AppendLine('L23 path count: ' + $paths23.Count)
$null = $sb.AppendLine('L24 path count: ' + $paths24.Count)

$null = $sb.AppendLine('')
$null = $sb.AppendLine($sep)
$null = $sb.AppendLine('L23 PATH HEADERS (in order of position)')
$null = $sb.AppendLine($sep)

$i = 0
foreach ($p in $paths23) {
    $i++
    $null = $sb.AppendLine('')
    $null = $sb.AppendLine('[L23 #' + $i + ' / P' + $p.arab + '] (len=' + $p.blockLen + ')')
    $null = $sb.AppendLine('    title: ' + $p.title)
    $null = $sb.AppendLine('    chunks: [' + $p.chunks + ']')
}

$null = $sb.AppendLine('')
$null = $sb.AppendLine($sep)
$null = $sb.AppendLine('L24 PATH HEADERS (final output)')
$null = $sb.AppendLine($sep)

$i = 0
foreach ($p in $paths24) {
    $i++
    $null = $sb.AppendLine('')
    $null = $sb.AppendLine('[L24 #' + $i + ' / P' + $p.arab + ']')
    $null = $sb.AppendLine('    title: ' + $p.title)
    $null = $sb.AppendLine('    chunks: [' + $p.chunks + ']')
}

$null = $sb.AppendLine('')
$null = $sb.AppendLine($sep)
$null = $sb.AppendLine('SEQUENTIAL 1:1 MAPPING TEST')
$null = $sb.AppendLine($sep)
$null = $sb.AppendLine('')

# Skip L23 #1 if it's the giant planning block (blockLen > 5000)
# Use only "title sketch" L23 blocks (those that are short)
$titleSk = @()
foreach ($p in $paths23) {
    if ($p.blockLen -lt 3000) { $titleSk += $p }
}

$null = $sb.AppendLine('L23 "title sketch" paths (blockLen<3000): ' + $titleSk.Count)
$null = $sb.AppendLine('L24 final paths: ' + $paths24.Count)
$null = $sb.AppendLine('')

if ($titleSk.Count -eq $paths24.Count) {
    $null = $sb.AppendLine('Counts match! Comparing sequential 1:1:')
    $null = $sb.AppendLine('')
    $allMatch = $true
    for ($j = 0; $j -lt [Math]::Min($titleSk.Count, $paths24.Count); $j++) {
        $p24 = $paths24[$j]
        $p23 = $titleSk[$j]
        $arab24 = $p24.arab
        $arab23 = $p23.arab
        $matched = ($arab24 -eq $arab23)
        if (-not $matched) { $allMatch = $false }
        $status = if ($matched) { '[OK]' } else { '[XX]' }
        $null = $sb.AppendLine('  L24 P' + $arab24 + ' <-> L23 P' + $arab23 + ' ' + $status)
        $null = $sb.AppendLine('    L24: ' + $p24.title)
        $null = $sb.AppendLine('    L23: ' + $p23.title)
        $null = $sb.AppendLine('')
    }
    $null = $sb.AppendLine('OVERALL: ' + ($(if ($allMatch) { 'PERFECT 1:1 SEQUENTIAL MATCH [OK]' } else { 'MISMATCH [XX]' })))
} else {
    $null = $sb.AppendLine('Counts do not match - cannot do simple sequential mapping')
}

[System.IO.File]::WriteAllText('z1q4_comparison.txt', $sb.ToString(), [System.Text.Encoding]::UTF8)
