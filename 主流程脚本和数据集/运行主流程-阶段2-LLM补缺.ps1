# 运行主流程 - 阶段2: LLM 补缺漏词（s1）
# 前提：
#   1. 已完成阶段1（生成了 s0-hits.json）
#   2. 已配置 .env 文件中的 LLM_API_KEY

$env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")

Write-Host "================================" -ForegroundColor Cyan
Write-Host "主流程 - 阶段2: LLM 补缺漏词" -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan
Write-Host ""

Set-Location "C:\Users\Administrator\Desktop\2026-09-21-master"

# 检查是否有 s0 输出
if (!(Test-Path "s0-hits.json")) {
    Write-Host "❌ 未找到 s0-hits.json，请先运行阶段1" -ForegroundColor Red
    Write-Host ""
    Write-Host "按任意键退出..." -ForegroundColor Gray
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
    exit 1
}

# 检查 .env 文件
if (!(Test-Path ".env")) {
    Write-Host "❌ 未找到 .env 文件" -ForegroundColor Red
    Write-Host ""
    Write-Host "请创建 .env 文件并添加以下内容:" -ForegroundColor Yellow
    Write-Host "LLM_API_KEY=sk-your-deepseek-api-key-here" -ForegroundColor White
    Write-Host ""
    Write-Host "按任意键退出..." -ForegroundColor Gray
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
    exit 1
}

Write-Host "正在执行 LLM 补缺..." -ForegroundColor Yellow
Write-Host "（此过程需要调用 DeepSeek API，可能需要几分钟）" -ForegroundColor Gray
Write-Host ""

node s1-llm-fill.js

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "================================" -ForegroundColor Green
    Write-Host "✅ 阶段2完成" -ForegroundColor Green
    Write-Host "================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "生成的文件:" -ForegroundColor Cyan
    Write-Host "  - s1-nouns-with-offsets.json (LLM 补缺的名词及位置)" -ForegroundColor White
    Write-Host ""
    Write-Host "下一步:" -ForegroundColor Cyan
    Write-Host "  运行 运行主流程-阶段3-合并去重.ps1" -ForegroundColor White
} else {
    Write-Host ""
    Write-Host "❌ 执行失败，请检查错误信息" -ForegroundColor Red
    Write-Host ""
    Write-Host "常见问题:" -ForegroundColor Yellow
    Write-Host "  - API Key 是否正确配置在 .env 文件？" -ForegroundColor White
    Write-Host "  - 网络连接是否正常（需要访问 DeepSeek API）？" -ForegroundColor White
}

Write-Host ""
Write-Host "按任意键退出..." -ForegroundColor Gray
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
