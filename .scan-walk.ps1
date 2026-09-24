$root = "C:\Users\Administrator\Desktop\chenggong-jiachi-master"
$today = [datetime]'2026-09-24'
$excludeDirs = @('node_modules', '.git', 'agent-transcripts', 'terminals', 'canvases', 'mcps', 'agent-tools', 'chats', '.today-files.csv')

$results = New-Object System.Collections.Generic.List[object]
function Walk($d) {
    Get-ChildItem -Path $d -File -ErrorAction SilentlyContinue | ForEach-Object {
        if ($_.LastWriteTime -ge $today) {
            $results.Add([PSCustomObject]@{
                FullName = $_.FullName
                LastWriteTime = $_.LastWriteTime
                Length = $_.Length
            })
        }
    }
    Get-ChildItem -Path $d -Directory -ErrorAction SilentlyContinue | ForEach-Object {
        if ($excludeDirs -notcontains $_.Name) {
            Walk $_.FullName
        }
    }
}
Walk $root
$results | Sort-Object LastWriteTime -Descending | Format-Table -AutoSize | Out-String -Width 200
$results | Sort-Object LastWriteTime -Descending | Export-Csv -Path "$root\.today-walk.csv" -NoTypeInformation -Encoding UTF8
Write-Host "Walk count: $($results.Count)"