$j = Get-Content 'reasoning-output-Z2-Q2.json' -Raw -Encoding UTF8 | ConvertFrom-Json
Write-Output ("thinkingChain type: " + $j.thinkingChain.GetType().FullName)
Write-Output ("llmOutput type: " + $j.llmOutput.GetType().FullName)
Write-Output ("llmOutput len: " + $j.llmOutput.Length)

# Check first line of llmOutput
$idx = $j.llmOutput.IndexOf([char]10)
$first = $j.llmOutput.Substring(0, [Math]::Min(60, [Math]::Max(0, $idx)))
Write-Output ("First line: " + $first)

# Count # characters at line starts
$count = 0
$pos = 0
$l24str = [string]$j.llmOutput
while ($pos -lt $l24str.Length) {
    $nextNL = $l24str.IndexOf([char]10, $pos)
    if ($nextNL -lt 0) { $nextNL = $l24str.Length }
    if ($nextNL -gt $pos -and $l24str[$pos] -eq '#') { $count++ }
    $pos = $nextNL + 1
}
Write-Output ("Lines starting with #: " + $count)
