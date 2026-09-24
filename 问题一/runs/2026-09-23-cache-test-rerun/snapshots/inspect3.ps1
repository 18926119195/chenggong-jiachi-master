$ErrorActionPreference = 'Continue'
$utf8 = New-Object System.Text.UTF8Encoding $false
$baseDir = 'C:\Users\Administrator\Desktop\chenggong-jiachi-master\问题一\runs\2026-09-23-cache-test-rerun\snapshots\Z1-Q1'
Set-Location $baseDir
Write-Host "PWD: $PWD"
Write-Host "Files in CWD:"
Get-ChildItem -Name | Select-Object -First 5
