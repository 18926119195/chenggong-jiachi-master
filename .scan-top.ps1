$root = "C:\Users\Administrator\Desktop\chenggong-jiachi-master"
$today = [datetime]'2026-09-24'
# Top-level only, exclude node_modules / agent-transcripts / terminals
$files = Get-ChildItem -Path $root -File -ErrorAction SilentlyContinue |
    Where-Object { $_.LastWriteTime -ge $today } |
    Select-Object FullName, LastWriteTime, Length |
    Sort-Object LastWriteTime -Descending
$files | Format-Table -AutoSize | Out-String -Width 200
$files | Export-Csv -Path "$root\.today-top.csv" -NoTypeInformation -Encoding UTF8
Write-Host "Top-level count: $($files.Count)"