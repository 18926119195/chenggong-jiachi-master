$content = [System.IO.File]::ReadAllText('reasoning-output-Z1-Q3.json', [System.Text.Encoding]::UTF8)
$lines = $content -split "`n"
$line24 = $lines[23]
$line23 = $lines[22]

$LB = [char]0x3010
$RB = [char]0x3011

$sb = New-Object System.Text.StringBuilder
$null = $sb.AppendLine('L24 length: ' + $line24.Length)
$null = $sb.AppendLine('L23 length: ' + $line23.Length)

# Build chinese number chars
$cn1 = [string][char]0x4E00
$cn2 = [string][char]0x4E8C
$cn3 = [string][char]0x4E09
$cn4 = [string][char]0x56DB
$cn5 = [string][char]0x4E94
$cn6 = [string][char]0x516D
$cn7 = [string][char]0x4E03
$cn8 = [string][char]0x516B
$cn9 = [string][char]0x4E5D
$cn10 = [string][char]0x5341
$lu = [string][char]0x8DEF
$jing = [string][char]0x5F84
$colon = [string][char]0xFF1A

# L24: find each #\u8def\u5f84N:\u3011 header
$ZHNUMS = @{}
$ZHNUMS[$cn1]='1'; $ZHNUMS[$cn2]='2'; $ZHNUMS[$cn3]='3'; $ZHNUMS[$cn4]='4'
$ZHNUMS[$cn5]='5'; $ZHNUMS[$cn6]='6'; $ZHNUMS[$cn7]='7'; $ZHNUMS[$cn8]='8'
$ZHNUMS[$cn9]='9'; $ZHNUMS[$cn10]='10'

# Build the pattern
$cnChars = $cn1 + $cn2 + $cn3 + $cn4 + $cn5 + $cn6 + $cn7 + $cn8 + $cn9 + $cn10
$pat = '#\s*' + $lu + $jing + '([' + $cnChars + '])' + $colon
$r24 = [regex]$pat
$h24 = @()
foreach ($m in $r24.Matches($line24)) {
    $h24 += @{n=$m.Groups[1].Value; p=$m.Index}
}
$h24 = @($h24 | Sort-Object p)
$null = $sb.AppendLine('')
$null = $sb.AppendLine('L24 paths found: ' + $h24.Count)
for ($i = 0; $i -lt $h24.Count; $i++) {
    $start = $h24[$i].p
    $end = if ($i+1 -lt $h24.Count) { $h24[$i+1].p } else { $line24.Length }
    $h24[$i].start = $start
    $h24[$i].end = $end
    $h24[$i].block = $line24.Substring($start, $end - $start)
    $arab = $ZHNUMS[$h24[$i].n]
    $null = $sb.AppendLine('  Path P' + $arab + ' @ ' + $start + '..' + $end + ' length=' + ($end - $start))
}

# Find L24 path chunks
$null = $sb.AppendLine('')
$null = $sb.AppendLine('CHUNKS cited per L24 path:')
foreach ($p in $h24) {
    $arab = $ZHNUMS[$p.n]
    $cn = New-Object System.Text.RegularExpressions.Regex($LB + $LB + '(\d+)' + $RB + $RB)
    $chunks = @()
    foreach ($cm in $cn.Matches($p.block)) { $chunks += $cm.Groups[1].Value }
    $null = $sb.AppendLine('  P' + $arab + ': [' + ($chunks -join ', ') + ']')
}

# Same for L23
$r23 = [regex]$pat
$h23 = @()
foreach ($m in $r23.Matches($line23)) {
    $h23 += @{n=$m.Groups[1].Value; p=$m.Index}
}
$h23 = @($h23 | Sort-Object p)
for ($i = 0; $i -lt $h23.Count; $i++) {
    $start = $h23[$i].p
    $end = if ($i+1 -lt $h23.Count) { $h23[$i+1].p } else { $line23.Length }
    $h23[$i].start = $start
    $h23[$i].end = $end
    $h23[$i].block = $line23.Substring($start, [Math]::Min(200, $end - $start))
}
$null = $sb.AppendLine('')
$null = $sb.AppendLine('L23 paths found: ' + $h23.Count)
foreach ($p in $h23) {
    $arab = $ZHNUMS[$p.n]
    $snip = $p.block.Substring(0, [Math]::Min(150, $p.block.Length))
    $null = $sb.AppendLine('  Path P' + $arab + ' @ ' + $p.p + ': ' + $snip)
}

# Similarity check
function Get-Sim([string]$a, [string]$b) {
    $ca = @(); foreach ($c in $a.ToCharArray()) { $ca += $c }
    $cb = @(); foreach ($c in $b.ToCharArray()) { $cb += $c }
    $shared = 0
    foreach ($x in $ca) { if ($cb -contains $x) { $shared++ } }
    if ($ca.Count + $cb.Count -eq 0) { return 0 }
    return [Math]::Round($shared * 2.0 / ($ca.Count + $cb.Count), 3)
}

# For each L24 path, find best L23 match
$null = $sb.AppendLine('')
$null = $sb.AppendLine('=' * 60)
$null = $sb.AppendLine('MAPPING L24 -> L23 by title similarity:')
$null = $sb.AppendLine('=' * 60)

foreach ($p24 in $h24) {
    $arab24 = $ZHNUMS[$p24.n]
    # Title = full block content
    $bestScore = 0; $best = $null
    foreach ($p in $h23) {
        $sc = Get-Sim $p24.block $p.block
        if ($sc -gt $bestScore) { $bestScore=$sc; $best=$p }
    }
    if ($best) {
        $arab23 = $ZHNUMS[$best.n]
        $null = $sb.AppendLine('  P' + $arab24 + ' -> P' + $arab23 + ' (score=' + $bestScore + ')')
    }
}

[System.IO.File]::WriteAllText('debug_v2.txt', $sb.ToString(), [System.Text.Encoding]::UTF8)
