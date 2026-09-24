$env:Path = "C:\Program Files\nodejs;C:\Users\Administrator\AppData\Local\Programs\Python\Python312;C:\Users\Administrator\AppData\Local\Programs\Python\Python312\Scripts;" + $env:Path

Write-Host "===== Project Environment Test =====" -ForegroundColor Cyan

Write-Host "`n[1] Testing spaCy service..." -ForegroundColor Yellow
try {
    $health = Invoke-RestMethod -Uri http://localhost:5001/health -Method Get
    Write-Host "OK - spaCy service running, model: $($health.model), loaded: $($health.loaded)" -ForegroundColor Green
} catch {
    Write-Host "FAIL - spaCy service not reachable: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`n[2] Testing DeepSeek LLM API..." -ForegroundColor Yellow
node --input-type=module -e "import { callLLM } from './src/core/llmClient.js'; const resp = await callLLM('用一句话回答:1+1等于几?', { maxTokens: 50 }); console.log('OK - LLM response:', resp.text);"

Write-Host "`n[3] Testing Node.js version..." -ForegroundColor Yellow
node --version

Write-Host "`n[4] Testing Python version..." -ForegroundColor Yellow
python --version

Write-Host "`n===== Test Complete =====" -ForegroundColor Cyan
