$root = "C:\Users\Administrator\Desktop\chenggong-jiachi-master"
$today = [datetime]'2026-09-24'
Get-ChildItem -Path $root -Recurse -File -ErrorAction SilentlyContinue |
    Where-Object { $_.LastWriteTime -ge $today } |
    Select-Object FullName, LastWriteTime, Length |
    Sort-Object LastWriteTime -Descending |
    Export-Csv -Path "$root\.today-files.csv" -NoTypeInformation -Encoding UTF8
Write-Host "Done. Count:"
(Get-Content "$root\.today-files.csv").Count - 1