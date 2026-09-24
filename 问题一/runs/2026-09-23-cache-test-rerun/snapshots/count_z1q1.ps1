$ErrorActionPreference = 'SilentlyContinue'
Set-Location 'Z1-Q1'
$total = 0
$none = 0
$score = 0
$valid = 0
$unknown = @()
for ($i = 1; $i -le 47; $i++) {
    $num = '{0:D4}' -f $i
    $f = "call-$num-response.json"
    if (-not (Test-Path $f)) { continue }
    $total++
    $j = Get-Content $f -Raw | ConvertFrom-Json
    $t = $j.response.text
    $first2 = if ($t.Length -gt 2) { $t.Substring(0,2) } else { $t }
    if ($t -eq 'NONE') {
        $none++
    } elseif ($t -match '^【【\d') {
        if ($t -match '】\s*\d') {
            $score++
        } else {
            $valid++
        }
    } else {
        $unknown += "$num starts-with:'$first2'"
    }
}
Write-Host "Z1-Q1 Total=$total NONE=$none Score=$score Valid=$valid"
Write-Host "Unknown/Other: $($unknown.Count)"
$unknown | ForEach-Object { Write-Host ("  " + $_) }
