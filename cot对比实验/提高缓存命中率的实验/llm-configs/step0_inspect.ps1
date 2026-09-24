$ErrorActionPreference = 'Stop'
$files = @('reasoning-output-Z2-Q2.json','reasoning-output-Z2-Q3.json','reasoning-output-Z2-Q4.json','reasoning-output-Z3-Q3.json','reasoning-output-Z4-Q3.json')
Write-Host "================================================================================"
Write-Host "FILE INSPECTION"
Write-Host "================================================================================"
foreach ($f in $files) {
    if (Test-Path $f) {
        $r = [System.IO.File]::ReadAllText($f, [System.Text.Encoding]::UTF8)
        $d = $r | ConvertFrom-Json
        $l23 = [string]$d.thinkingChain
        $l24 = [string]$d.llmOutput
        Write-Host ""
        Write-Host $f
        Write-Host ("  L23 chars: " + $l23.Length)
        Write-Host ("  L24 chars: " + $l24.Length)
    } else {
        Write-Host ("NOT FOUND: " + $f)
    }
}
