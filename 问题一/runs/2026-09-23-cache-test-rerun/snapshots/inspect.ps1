$ErrorActionPreference = 'SilentlyContinue'
Set-Location 'Z1-Q1'
$j = Get-Content 'call-0001-response.json' -Raw | ConvertFrom-Json
Write-Host "callId: $($j.callId)"
Write-Host "response.text: [$($j.response.text)]"
Write-Host "Length: $($j.response.text.Length)"
$t = $j.response.text
Write-Host "eq NONE: $($t -eq 'NONE')"
Write-Host "starts with [【]: $($t.StartsWith([char]0x3010))"
Write-Host "First char hex: $('{0:X4}' -f [int]$t[0])"
Write-Host "Char codes:"
[byte[]]$bytes = [System.Text.Encoding]::UTF8.GetBytes($t.Substring(0,4))
$bytes | ForEach-Object { Write-Host ("  " + ('{0:X2}' -f $_)) }
