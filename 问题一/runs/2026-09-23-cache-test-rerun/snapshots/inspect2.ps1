$ErrorActionPreference = 'Continue'
$utf8 = New-Object System.Text.UTF8Encoding $false
Set-Location 'Z1-Q1'
$raw = [System.IO.File]::ReadAllText('call-0001-response.json', $utf8)
Write-Host "Bytes:"
[byte[]]$bytes = [System.Text.Encoding]::UTF8.GetBytes($raw)
$bytes | Select-Object -First 50 | ForEach-Object { Write-Host ("  " + ('{0:X2}' -f $_)) }
Write-Host ""
Write-Host "First 50 chars:"
Write-Host $raw.Substring(0, [Math]::Min(50, $raw.Length))
