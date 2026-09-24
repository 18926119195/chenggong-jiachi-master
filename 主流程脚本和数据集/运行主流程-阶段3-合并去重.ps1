# 运行主流程 - 阶段3: 合并 s0 和 s1，生成最终名词表
# 前提：已完成阶段1和阶段2（生成了 s0-hits.json 和 s1-nouns-with-offsets.json）

$env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")

Write-Host "================================" -ForegroundColor Cyan
Write-Host "主流程 - 阶段3: 合并去重生成终词表" -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan
Write-Host ""

Set-Location "C:\Users\Administrator\Desktop\2026-09-21-master"

# 检查前置文件
if (!(Test-Path "s0-hits.json")) {
    Write-Host "❌ 未找到 s0-hits.json，请先运行阶段1" -ForegroundColor Red
    Write-Host ""
    Write-Host "按任意键退出..." -ForegroundColor Gray
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
    exit 1
}

if (!(Test-Path "s1-nouns-with-offsets.json")) {
    Write-Host "❌ 未找到 s1-nouns-with-offsets.json，请先运行阶段2" -ForegroundColor Red
    Write-Host ""
    Write-Host "按任意键退出..." -ForegroundColor Gray
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
    exit 1
}

Write-Host "正在合并 s0 和 s1，去重生成终词表..." -ForegroundColor Yellow
Write-Host ""

node merge-s0-s1.js

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "================================" -ForegroundColor Green
    Write-Host "✅ 阶段3完成 - 终词表已生成！" -ForegroundColor Green
    Write-Host "================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "生成的文件:" -ForegroundColor Cyan
    Write-Host "  - final-noun-index.json ✅ (最终名词索引/终词表)" -ForegroundColor White
    Write-Host ""
    Write-Host "纯文表和终词表生成完毕！" -ForegroundColor Green
    Write-Host ""
    Write-Host "下一步（可选）:" -ForegroundColor Cyan
    Write-Host "  如需进行名词召回和推理，可运行:" -ForegroundColor White
    Write-Host "  node recall-nouns-llm.js <问题ID>" -ForegroundColor White
    Write-Host "  node run-full-pipeline.js <问题ID>" -ForegroundColor White
} else {
    Write-Host ""
    Write-Host "❌ 执行失败，请检查错误信息" -ForegroundColor Red
}

Write-Host ""
Write-Host "按任意键退出..." -ForegroundColor Gray
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
