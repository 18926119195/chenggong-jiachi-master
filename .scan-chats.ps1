$transcriptRoot = "C:\Users\Administrator\.cursor\projects\c-Users-Administrator-Desktop-chenggong-jiachi-master\agent-transcripts"
$chats = @()
Get-ChildItem -Path $transcriptRoot -Directory | ForEach-Object {
    $dir = $_
    Get-ChildItem -Path $dir.FullName -File -Filter '*.jsonl' | ForEach-Object {
        $script:chats += [PSCustomObject]@{
            chat_id = $_.BaseName
            folder  = $dir.Name
            path    = $_.FullName
            length  = $_.Length
            modified= $_.LastWriteTime
        }
    }
}
$chats | Sort-Object modified | Format-Table -AutoSize | Out-String -Width 200
$chats | Sort-Object modified | Export-Csv -Path "C:\Users\Administrator\Desktop\chenggong-jiachi-master\.chats.csv" -NoTypeInformation -Encoding UTF8
Write-Host "Chats: $($chats.Count)"