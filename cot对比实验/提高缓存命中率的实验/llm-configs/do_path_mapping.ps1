$content = [System.IO.File]::ReadAllText('reasoning-output-Z1-Q3.json', [System.Text.Encoding]::UTF8)
$lines = $content -split "`n"
$line23 = $lines[22]
$line24 = $lines[23]

$cLB = [char]0x3010  # [
$cRB = [char]0x3011  # ]
$cHua = [char]0x300A  # 《
$cHua2 = [char]0x300B # 》
$c1 = [char]0x4E00; $c2 = [char]0x4E8C; $c3 = [char]0x4E09; $c4 = [char]0x56DB
$c5 = [char]0x4E94; $c6 = [char]0x516D; $c7 = [char]0x4E03; $c8 = [char]0x516B
$c9 = [char]0x4E5D; $c10 = [char]0x5341
$cColon = [char]0xFF1A
$cSlash = [char]0x002F

$zhToArab = @{}
$zhToArab[$c1]='1'; $zhToArab[$c2]='2'; $zhToArab[$c3]='3'; $zhToArab[$c4]='4'
$zhToArab[$c5]='5'; $zhToArab[$c6]='6'; $zhToArab[$c7]='7'; $zhToArab[$c8]='8'
$zhToArab[$c9]='9'; $zhToArab[$c10]='10'

# L24 path pattern
$pat24 = '(?s)#\s*路径([' + $c1 + $c2 + $c3 + $c4 + $c5 + $c6 + $c7 + $c8 + $c9 + $c10 + '])' + $cColon + '(.+?)(?=\n---+|\n#\s*路径|\Z)'
$r24 = New-Object System.Text.RegularExpressions.Regex($pat24)
$pathBlocks24 = @()
foreach ($m in $r24.Matches($line24)) {
    $title = $m.Groups[2].Value.Trim()
    $full = $m.Value
    $chunks = @()
    $cr = New-Object System.Text.RegularExpressions.Regex('\[\[(\d+)\]\]')
    foreach ($cm in $cr.Matches($full)) { $chunks += $cm.Groups[1].Value }
    $pathBlocks24 += @{title=$title; full=$full; chunks=$chunks}
}

# L23 path pattern
$pat23 = '(?s)#\s*路径([' + $c1 + $c2 + $c3 + $c4 + $c5 + $c6 + $c7 + $c8 + $c9 + $c10 + '])' + $cColon
$r23 = New-Object System.Text.RegularExpressions.Regex($pat23)
$ph23 = @()
foreach ($m in $r23.Matches($line23)) {
    $ph23 += @{pathNum=$m.Groups[1].Value; pos=$m.Index}
}
$ph23 = @($ph23 | Sort-Object pos)
for ($i = 0; $i -lt $ph23.Count; $i++) {
    $s = $ph23[$i].pos
    $e = if ($i+1 -lt $ph23.Count) { $ph23[$i+1].pos } else { $line23.Length }
    $ph23[$i].start=$s; $ph23[$i].end=$e
    $ph23[$i].content=$line23.Substring($s, $e-$s)
}

function Get-Sim($a, $b) {
    $ca = $a.ToCharArray(); $cb = $b.ToCharArray()
    $shared = ($ca | Where-Object { $cb -contains $_ }).Count
    if ($ca.Count+$cb.Count -eq 0) { return 0 }
    return [Math]::Round($shared*2.0/($ca.Count+$cb.Count), 3)
}

$sep80 = [string]::new([char]0x3D, 80)
$dash80 = [string]::new([char]0x2D, 80)

$out = @()
$out += $sep80
$out += 'L24 -> L23 PATH MAPPING RESULT'
$out += $sep80

foreach ($p24 in $pathBlocks24) {
    $p24Title = $p24.title
    $p24Num = ''
    if ($p24Title -match '^(.)') { $p24Num = $zhToArab[$Matches[1]] }

    $out += ''
    $out += $sep80
    $out += 'L24 PATH: ' + $p24Num + ' | ' + $p24Title
    $out += 'CITED CHUNKS: [' + ($p24.chunks -join ', ') + ']'
    $out += $dash80

    $bestScore = 0; $best = $null
    foreach ($p in $ph23) {
        $sc = Get-Sim $p24Title $p.content
        if ($sc -gt $bestScore) { $bestScore=$sc; $best=$p }
    }

    if ($best) {
        $out += 'MAPPED TO L23 PATH: ' + $best.pathNum + ' (score=' + $bestScore + ')'
        $out += ''
        $out += '[L23 CONTENT SNIPPET]'
        $snip = $best.content
        if ($snip.Length -gt 2000) { $snip = $snip.Substring(0,2000) + '... [TRUNCATED]' }
        $out += $snip
        $out += ''
        $out += '[L23 CHUNK CONTEXTS]'
        foreach ($n in $p24.chunks) {
            $marker = $cLB + $n + $cRB
            $pos = $line23.IndexOf($marker)
            if ($pos -ge 0) {
                $cs = [Math]::Max(0, $pos-200)
                $ce = [Math]::Min($line23.Length, $pos+250)
                $ctx = $line23.Substring($cs, $ce-$cs) -replace "`n", ' ' -replace "`r", ''
                $out += ''
                $out += '  [' + $n + '] @ ' + $pos + ':'
                $out += '  ' + $ctx
            } else {
                $out += '  [' + $n + ']: NOT FOUND'
            }
        }
    } else {
        $out += 'NO MATCH'
    }
}

$out += ''
$out += $sep80
$out += 'SUMMARY TABLE'
$out += $sep80
$out += 'L24# | L24 Title                              | L23# | Score | Chunks'
$out += $dash80

foreach ($p24 in $pathBlocks24) {
    $p24Title = $p24.title
    $p24Num = ''
    if ($p24Title -match '^(.)') { $p24Num = $zhToArab[$Matches[1]] }
    $chunks = $p24.chunks -join ','

    $bestScore=0; $best=$null
    foreach ($p in $ph23) {
        $sc = Get-Sim $p24Title $p.content
        if ($sc -gt $bestScore) { $bestScore=$sc; $best=$p }
    }

    $l23Num = if ($best) { $best.pathNum } else { '?' }
    $sTitle = if ($p24Title.Length -gt 36) { $p24Title.Substring(0,36)+'...' } else { $p24Title }
    $line = [string]::Format('{0,-5}| {1,-37}| {2,-5}| {3,-6}| {4}', 'P'+$p24Num, $sTitle, 'P'+$l23Num, $bestScore, $chunks)
    $out += $line
}

[System.IO.File]::WriteAllLines('path_mapping_result.txt', $out, [System.Text.Encoding]::UTF8)
Write-Host 'Done.'
