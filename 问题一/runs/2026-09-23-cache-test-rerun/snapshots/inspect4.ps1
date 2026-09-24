chcp 65001 | Out-Null
$baseDir = 'C:\Users\Administrator\Desktop\chenggong-jiachi-master\问题一\runs\2026-09-23-cache-test-rerun\snapshots\Z1-Q1'
Set-Location -LiteralPath $baseDir
Write-Host "PWD: $PWD"
$f = 'call-0001-response.json'
if (Test-Path $f) {
    $j = Get-Content -LiteralPath $f -Raw | ConvertFrom-Json
    Write-Host "callId: $($j.callId)"
    Write-Host ("text len: " + $j.response.text.Length)
    Write-Host ("first 80: " + $j.response.text.Substring(0, [Math]::Min(80, $j.response.text.Length)))
} else {
    Write-Host "File not found"
    Get-ChildItem -Name | Select-Object -First 5
}
