# 运行主流程 - 阶段1: spaCy 名词抽取（s0）
# 依赖：spaCy 服务必须已启动（运行 启动spacy服务.ps1）

$env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")

Write-Host "================================" -ForegroundColor Cyan
Write-Host "主流程 - 阶段1: spaCy 名词抽取" -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan
Write-Host ""

$docuversePath = "C:\Users\Administrator\Desktop\docuverse_cartographies_squizoanalythiques_Fe_lix_Guattari_1789114122714.docuverse.json"

Set-Location "C:\Users\Administrator\Desktop\2026-09-21-master"

Write-Host "源文件: $docuversePath" -ForegroundColor Green
Write-Host ""
Write-Host "正在执行 spaCy 名词抽取..." -ForegroundColor Yellow

node validate-s0-quality.js $docuversePath

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "================================" -ForegroundColor Green
    Write-Host "✅ 阶段1完成" -ForegroundColor Green
    Write-Host "================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "生成的文件:" -ForegroundColor Cyan
    Write-Host "  - s0-hits.json (spaCy 抽取的名词及位置)" -ForegroundColor White
    Write-Host "  - s0-quality-report.json (质量报告：覆盖率统计)" -ForegroundColor White
    Write-Host ""
    Write-Host "下一步:" -ForegroundColor Cyan
    Write-Host "  1. 配置 .env 文件，添加 LLM_API_KEY=sk-xxxxxxx" -ForegroundColor White
    Write-Host "  2. 运行 运行主流程-阶段2-LLM补缺.ps1" -ForegroundColor White
} else {
    Write-Host ""
    Write-Host "❌ 执行失败，请检查错误信息" -ForegroundColor Red
    Write-Host ""
    Write-Host "常见问题:" -ForegroundColor Yellow
    Write-Host "  - spaCy 服务未启动？请先运行 启动spacy服务.ps1" -ForegroundColor White
    Write-Host "  - 源文件路径是否正确？" -ForegroundColor White
}

Write-Host ""
Write-Host "按任意键退出..." -ForegroundColor Gray
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
