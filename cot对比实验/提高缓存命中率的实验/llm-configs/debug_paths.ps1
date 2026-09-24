$raw = [System.IO.File]::ReadAllText("reasoning-output-Z2-Q2.json", [System.Text.Encoding]::UTF8)
$data = $raw | ConvertFrom-Json
$l24 = [string]$data.llmOutput
Write-Host "L24 length: $($l24.Length)"
Write-Host "First 300 chars of L24:"
Write-Host $l24.Substring(0, [Math]::Min(300, $l24.Length))
Write-Host ""
Write-Host "Looking for # character:"
$firstHash = $l24.IndexOf("#")
Write-Host "First # at: $firstHash"
if ($firstHash -ge 0) {
    $window = $l24.Substring($firstHash, [Math]::Min(50, $l24.Length - $firstHash))
    Write-Host "Window: $window"
    Write-Host "Matches 路徑: $($window -match '路徑')"
    Write-Host "Matches 路径: $($window -match '路径')"
    Write-Host "Matches path: $($window -match '#\s*路径')"
}
