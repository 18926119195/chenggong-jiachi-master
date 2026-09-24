# rerun-cache-test.ps1
# Cache-hit-rate comparison rerun for Z1-Q1 and Z2-Q2

$ErrorActionPreference = "Stop"
$root = "C:\Users\Administrator\Desktop\zhongjiban-ultimate-master"
$srcDir = "$root\瀹屾暣鐨勮繍浣?
$runDir = "$root\闂涓€\runs\2026-09-23-cache-test-rerun"
$snapshotDir = "$runDir\snapshots"
$logDir = "$runDir\logs"

# Output paths via env vars (recall-nouns-llm.js & build-prompt-with-traceback.js read these)
$env:OUTPUT_PATH = "$runDir\noun-recall-results.json"
$env:CANDIDATE_TEXTS_PATH = "$runDir\candidate-texts-for-llm.json"
$env:TRACEBACK_MAP_PATH = "$runDir\material-traceback-map.json"
$env:LLM_SNAPSHOT_DIR = $snapshotDir
$env:LLM_CONCURRENCY = "8"

# Load .env (API key + base URL)
if (Test-Path "$root\.env") {
    Get-Content "$root\.env" | ForEach-Object {
        if ($_ -match '^\s*([^#][^=]*?)\s*=\s*(.*?)\s*$') {
            $name = $matches[1]; $val = $matches[2]
            if ($name -eq "LLM_API_KEY" -or $name -eq "DEEPSEEK_API_KEY" -or $name -eq "LLM_BASE_URL" -or $name -eq "LLM_MODEL") {
                Set-Item -Path "Env:\$name" -Value $val
            }
        }
    }
}

Set-Location $srcDir

$questions = @("Z1-Q1", "Z2-Q2")
$startAll = Get-Date

foreach ($q in $questions) {
    $logFile = "$logDir\rerun-$q.log"
    Write-Host ""
    Write-Host "==========================================" | Tee-Object -Append $logFile
    Write-Host "Start rerun: $q" | Tee-Object -Append $logFile
    Write-Host "==========================================" | Tee-Object -Append $logFile

    # Step 2: noun recall
    Write-Host "[$q] Step 2: noun recall..." | Tee-Object -Append $logFile
    node recall-nouns-llm.js $q 2>&1 | Tee-Object -Append $logFile | Out-Null

    # Step 3: build prompt input
    Write-Host "[$q] Step 3: build prompt input..." | Tee-Object -Append $logFile
    node build-prompt-with-traceback.js $q 2>&1 | Tee-Object -Append $logFile | Out-Null

    # Step 4: generate multipath prompt
    Write-Host "[$q] Step 4: generate multipath prompt..." | Tee-Object -Append $logFile
    node generate-multipath-prompt.js $q 2>&1 | Tee-Object -Append $logFile | Out-Null

    # Step 5: run reasoning
    Write-Host "[$q] Step 5: run reasoning..." | Tee-Object -Append $logFile
    node run-reasoning.js $q 2>&1 | Tee-Object -Append $logFile | Out-Null

    # Copy __dirname outputs to run dir (these scripts ignore env vars)
    Copy-Item "$srcDir\multipath-prompt-$q.txt" "$runDir\" -Force -ErrorAction SilentlyContinue
    Copy-Item "$srcDir\reasoning-output-$q.json" "$runDir\" -Force -ErrorAction SilentlyContinue

    Write-Host "[$q] Done." | Tee-Object -Append $logFile
}

$elapsedAll = (Get-Date) - $startAll
$summary = "$logDir\rerun-summary.txt"
Write-Host "" | Tee-Object -Append $summary
Write-Host "All done. Total elapsed: $($elapsedAll.ToString('hh\:mm\:ss'))" | Tee-Object -Append $summary
Write-Host "Output dir: $runDir" | Tee-Object -Append $summary
