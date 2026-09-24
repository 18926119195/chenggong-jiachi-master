param([string]$InputFile, [string]$OutputDir = "")

$ErrorActionPreference = 'Stop'

# Load JSON
$raw = [System.IO.File]::ReadAllText($InputFile, [System.Text.Encoding]::UTF8)
$data = $raw | ConvertFrom-Json
$l23 = [string]$data.thinkingChain
$l24 = [string]$data.llmOutput
$l23Len = $l23.Length
$l24Len = $l24.Length

# Char codes (use only ASCII literals for code, char() for data)
$LB  = [char]0x3010   # left bracket
$RB  = [char]0x3011   # right bracket
$NL  = [char]10       # newline
$LU  = [char]0x8DEF   # lu char
$JING = [char]0x5F84  # jing char
$CN_NUMS = ([char]0x4E00) + ([char]0x4E8C) + ([char]0x4E09) + ([char]0x56DB) + ([char]0x4E94) + ([char]0x516D) + ([char]0x4E03) + ([char]0x516B) + ([char]0x4E5D) + ([char]0x5341)
$LBB = $LB + $LB
$RBB = $RB + $RB
$LBC = $LB            # for markdown output
$RBC = $RB            # for markdown output

# Step 1: find all single-bracket mentions in L23
$l23Mentions = @{}
$pos = 0
while ($pos -lt $l23Len) {
    $lbIdx = $l23.IndexOf($LB, $pos)
    if ($lbIdx -lt 0) { break }
    $endIdx = $l23.IndexOf($RB, $lbIdx + 1)
    if ($endIdx -lt 0) { break }
    $inner = $l23.Substring($lbIdx + 1, $endIdx - $lbIdx - 1)
    if ($inner -match '^\d+$') {
        if (-not $l23Mentions.ContainsKey($inner)) {
            $l23Mentions[$inner] = New-Object System.Collections.Generic.List[int]
        }
        $l23Mentions[$inner].Add($lbIdx)
    }
    $pos = $lbIdx + 1
}

# Step 2: find L24 paths and double-bracket chunks
$paths = New-Object System.Collections.Generic.List[Hashtable]

# Build line starts
$lineStarts = New-Object System.Collections.Generic.List[int]
$lineStarts.Add(0)
for ($i = 0; $i -lt $l24Len; $i++) {
    if ($l24[$i] -eq $NL) { $lineStarts.Add($i + 1) }
}

# Detect path headers
for ($li = 0; $li -lt $lineStarts.Count; $li++) {
    $ls = $lineStarts[$li]
    if ($ls -ge $l24Len) { continue }
    if ($l24[$ls] -ne '#') { continue }

    # Get line content
    $nextNL = $l24Len
    for ($ni = $ls + 1; $ni -lt $l24Len; $ni++) {
        if ($l24[$ni] -eq $NL) { $nextNL = $ni; break }
    }
    $line = $l24.Substring($ls, $nextNL - $ls)

    # Check for required chars
    $hasLu = $false; $hasJing = $false
    for ($ci = 0; $ci -lt $line.Length; $ci++) {
        if ($line[$ci] -eq $LU) { $hasLu = $true }
        if ($line[$ci] -eq $JING) { $hasJing = $true }
    }
    if (-not ($hasLu -and $hasJing)) { continue }

    # Extract path number
    $pathNum = "?"
    for ($ni = 0; $ni -lt $CN_NUMS.Length; $ni++) {
        $cn = $CN_NUMS[$ni]
        for ($ci = 0; $ci -lt $line.Length; $ci++) {
            if ($line[$ci] -eq $cn -and $ci -gt 1) { $pathNum = [string]$cn; $ni = $CN_NUMS.Length; break }
        }
    }

    # Block ends at next path header or end of string
    $blockEnd = $l24Len
    for ($nextLi = $li + 1; $nextLi -lt $lineStarts.Count; $nextLi++) {
        $nextLs = $lineStarts[$nextLi]
        if ($nextLs -ge $l24Len) { continue }
        if ($l24[$nextLs] -ne '#') { continue }
        $nextLineEnd = $l24Len
        for ($ni = $nextLs + 1; $ni -lt $l24Len; $ni++) {
            if ($l24[$ni] -eq $NL) { $nextLineEnd = $ni; break }
        }
        $nextLine = $l24.Substring($nextLs, $nextLineEnd - $nextLs)
        $nextHasLu = $false; $nextHasJing = $false
        for ($ci = 0; $ci -lt $nextLine.Length; $ci++) {
            if ($nextLine[$ci] -eq $LU) { $nextHasLu = $true }
            if ($nextLine[$ci] -eq $JING) { $nextHasJing = $true }
        }
        if ($nextHasLu -and $nextHasJing) { $blockEnd = $nextLs; break }
    }
    $block = $l24.Substring($ls, $blockEnd - $ls)
    $title = $line.Trim()

    # Extract double-bracket chunks
    $chunks = New-Object System.Collections.Generic.List[string]
    $seen = @{}
    $cs = 0
    while ($cs -lt $block.Length) {
        $lbbIdx = $block.IndexOf($LBB, $cs)
        if ($lbbIdx -lt 0) { break }
        $rbbIdx = $block.IndexOf($RBB, $lbbIdx + 2)
        if ($rbbIdx -lt 0) { break }
        $inner = $block.Substring($lbbIdx + 2, $rbbIdx - $lbbIdx - 2)
        if ($inner -match '^\d+$' -and -not $seen.ContainsKey($inner)) {
            $seen[$inner] = $true
            $chunks.Add($inner)
        }
        $cs = $rbbIdx + 2
    }

    $paths.Add(@{ num = $pathNum; title = $title; chunks = $chunks.ToArray(); block = $block })
}

# Step 3: Classify reasoning (ASCII-only keywords)
function Get-ReasoningType($text) {
    $scores = @{"A"=0;"B"=0;"C"=0;"D"=0}
    if ($text -match "Aha")     { $scores["A"] += 3 }
    if ($text -match "aha")     { $scores["A"] += 3 }
    if ($text -match "direct")  { $scores["A"] += 2 }
    if ($text -match "found")   { $scores["A"] += 2 }
    if ($text -match "indeed")  { $scores["A"] += 2 }
    if ($text -match "Path")    { $scores["B"] += 3 }
    if ($text -match "path")    { $scores["B"] += 3 }
    if ($text -match "Use ")    { $scores["B"] += 2 }
    if ($text -match "xuanqu")  { $scores["B"] += 2 }
    if ($text -match "Step")    { $scores["C"] += 4 }
    if ($text -match "step")    { $scores["C"] += 4 }
    if ($text -match "draft")   { $scores["C"] += 3 }
    if ($text -match "extract") { $scores["C"] += 2 }
    if ($text -match "judge")   { $scores["C"] += 2 }
    if ($text -match "conclude"){ $scores["C"] += 2 }
    if ($text -match "compare") { $scores["C"] += 1 }
    if ($text -match "accurate"){ $scores["C"] += 1 }
    $maxVal = ($scores.Values | Measure-Object -Maximum).Maximum
    if ($maxVal -eq 0) { return "D" }
    foreach ($k in @("A","B","C","D")) { if ($scores[$k] -eq $maxVal) { return $k } }
    return "D"
}

# Step 4: get mention line + subsequent reasoning
function Get-MentionAndReasoning($pos) {
    $lineStart = $pos
    while ($lineStart -gt 0 -and $l23[$lineStart - 1] -ne $NL) { $lineStart-- }
    $mentionEnd = $pos + 7
    while ($mentionEnd -lt $l23Len -and $l23[$mentionEnd] -ne $NL) { $mentionEnd++ }
    $mentionLine = $l23.Substring($lineStart, $mentionEnd - $lineStart).Trim()
    $nlCount = 0; $cursor = $mentionEnd; $commentary = ""
    while ($cursor -lt $l23Len -and $nlCount -lt 4) {
        $nextNL = $l23Len
        for ($ni = $cursor + 1; $ni -lt $l23Len; $ni++) {
            if ($l23[$ni] -eq $NL) { $nextNL = $ni; break }
        }
        if ($nextNL -eq $l23Len) { break }
        $lineContent = $l23.Substring($cursor, $nextNL - $cursor)
        if ($commentary.Length + $lineContent.Length -gt 500) { break }
        $commentary += $lineContent.Trim() + " "
        $cursor = $nextNL + 1; $nlCount++
    }
    $clean = $commentary.Trim() -replace '\s+', ' '
    return @{
        quote = $mentionLine -replace '\s+', ' '
        reasoning = $clean
        type = Get-ReasoningType $clean
    }
}

# Step 5: select best evidence
function Select-BestEvidence($cid, $pathNum) {
    if (-not $l23Mentions.ContainsKey($cid)) { return $null }
    $allPos = $l23Mentions[$cid]
    if ($pathNum -le 3) { $zoneEnd = [Math]::Floor($l23Len * 0.35) }
    elseif ($pathNum -le 5) { $zoneEnd = [Math]::Floor($l23Len * 0.65) }
    else { $zoneEnd = $l23Len }
    $inZone = @($allPos | Where-Object { $_ -lt $zoneEnd })
    $candidates = if ($inZone.Count -gt 0) { $inZone } else { $allPos }
    $bestScore = -1; $best = $null
    foreach ($pos in $candidates) {
        $ws = [Math]::Max(0, $pos - 20)
        $wl = [Math]::Min($l23Len - $ws, 400)
        $ctx = $l23.Substring($ws, $wl)
        $typ = Get-ReasoningType $ctx
        $score = if ($typ -eq "A") { 10 } elseif ($typ -eq "B") { 7 } elseif ($typ -eq "C") { 5 } else { 1 }
        if ($pathNum -le 3 -and $typ -eq "A") { $score += 20 }
        if ($pathNum -ge 6 -and $typ -eq "C") { $score += 20 }
        if ($score -gt $bestScore) {
            $bestScore = $score
            $mr = Get-MentionAndReasoning $pos
            $best = @{ pos = $pos; type = $mr.type; quote = $mr.quote; reasoning = $mr.reasoning }
        }
    }
    return $best
}

# Step 6: build traces
$traces = New-Object System.Collections.Generic.List[Hashtable]
$stats = @{ total=0; found=0; missing=@(); dist=@{"A"=0;"B"=0;"C"=0;"D"=0} }

foreach ($p in $paths) {
    $pnumInt = $CN_NUMS.IndexOf($p.num) + 1
    if ($pnumInt -eq 0) { $pnumInt = 5 }
    $chunkList = New-Object System.Collections.Generic.List[Hashtable]
    foreach ($cid in $p.chunks) {
        $stats.total++
        $ev = Select-BestEvidence $cid $pnumInt
        if ($null -eq $ev) {
            $stats.missing += $cid
            $chunkList.Add(@{ chunkId = $cid; found = $false })
        } else {
            $stats.found++
            $stats.dist[$ev.type]++
            $chunkList.Add(@{
                chunkId = $cid; found = $true; pos = $ev.pos
                type = $ev.type; quote = $ev.quote; reasoning = $ev.reasoning
            })
        }
    }
    $traces.Add(@{ pathNum = $p.num; title = $p.title; chunks = $chunkList.ToArray() })
}

# Step 7: coverage
$allChunks = New-Object System.Collections.Generic.List[string]
foreach ($p in $paths) { foreach ($cid in $p.chunks) { $allChunks.Add($cid) } }
$uniqueL24 = $allChunks | Sort-Object -Unique
$foundInL23 = @($uniqueL24 | Where-Object { $l23Mentions.ContainsKey($_) })
$coverage = if ($uniqueL24.Count -gt 0) { [Math]::Round($foundInL23.Count / $uniqueL24.Count * 100, 1) } else { 0 }

# Output
$base = [System.IO.Path]::GetFileNameWithoutExtension($InputFile)
$outDir = [System.IO.Path]::GetDirectoryName($InputFile)
if ($outDir -eq "") { $outDir = "." }
if ($OutputDir -ne "") { $outDir = $OutputDir }

$labelMap = @{ "A"="A-Eureka"; "B"="B-Organize"; "C"="C-Draft"; "D"="D-Other" }

# JSON
$jsonObj = @{
    meta = @{
        sourceFile = $base + ".json"; l23Length = $l23Len; l24Length = $l24Len
        pathCount = $paths.Count; totalChunkRefs = $stats.total
        uniqueL24Chunks = $uniqueL24.Count; foundInL23 = $foundInL23.Count
        coverage = $coverage; typeDistribution = $stats.dist
    }
    traces = $traces.ToArray()
} | ConvertTo-Json -Depth 10 -Compress
$jsonPath = Join-Path $outDir ($base + "_trace.json")
[System.IO.File]::WriteAllText($jsonPath, $jsonObj, [System.Text.Encoding]::UTF8)

# Markdown
$md = "# $($base) -- L23 to L24 Mapping Report" + $NL + $NL
$md += "| Metric | Value |" + $NL
$md += "|:-------|------:|" + $NL
$md += "| L23 chars | $($l23Len) |" + $NL
$md += "| L24 chars | $($l24Len) |" + $NL
$md += "| Paths | $($paths.Count) |" + $NL
$md += "| Unique L24 chunks | $($uniqueL24.Count) |" + $NL
$md += "| Coverage | $($coverage)% |" + $NL
$md += "| Missing | $($stats.missing.Count) |" + $NL + $NL
$md += "## Type Distribution" + $NL
$md += "| Type | Count |" + $NL
$md += "|:-----|------:|" + $NL
foreach ($k in @("A","B","C","D")) { $md += "| $($labelMap[$k]) | $($stats.dist[$k]) |" + $NL }
$md += $NL

foreach ($t in $traces) {
    $md += "---" + $NL
    $md += "## Path $($t.pathNum): $($t.title)" + $NL + $NL
    foreach ($c in $t.chunks) {
        if (-not $c.found) {
            $md += "### **$LBC$($c.chunkId)$RBC**  MISSING from L23" + $NL + $NL
        } else {
            $lbl = $labelMap[$c.type]
            $md += "### **$LBC$($c.chunkId)$RBC**  [$lbl]  pos=$($c.pos)" + $NL + $NL
            $md += "**Quote:**" + $NL + "> $($c.quote)" + $NL + $NL
            $md += "**Reasoning:**" + $NL
            # Just output reasoning as single block
            $md += "> $($c.reasoning)" + $NL
        }
        $md += $NL
    }
}

$mdPath = Join-Path $outDir ($base + "_trace.md")
[System.IO.File]::WriteAllText($mdPath, $md, [System.Text.Encoding]::UTF8)

Write-Host "================================================================================"
Write-Host "DONE: $base"
Write-Host "JSON: $jsonPath"
Write-Host "MD:   $mdPath"
Write-Host "Coverage: $($coverage)% ($($foundInL23.Count)/$($uniqueL24.Count) unique chunks)"
Write-Host "Types: A=$($stats.dist['A'])  B=$($stats.dist['B'])  C=$($stats.dist['C'])  D=$($stats.dist['D'])"
if ($stats.missing.Count -gt 0) { Write-Host "Missing: [$($stats.missing -join ', ')]" }
Write-Host "================================================================================"
