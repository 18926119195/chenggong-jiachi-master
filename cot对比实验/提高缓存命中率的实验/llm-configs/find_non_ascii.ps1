$content = Get-Content 'trace_mapper.ps1' -Encoding UTF8
$lineNum = 0
foreach ($line in $content) {
    $lineNum++
    if ($line -match '[^\x00-\x7F]') {
        Write-Host ("L$lineNum has non-ASCII: " + ($line.Substring(0, [Math]::Min(60, $line.Length))))
    }
}
