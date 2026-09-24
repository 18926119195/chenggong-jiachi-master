# 运行主流程 - 阶段1: spaCy 名词抽取（s0）
# 输出到新数据集文件夹，不覆盖原有数据

$env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")

$PROJECT_ROOT = "C:\Users\Administrator\Desktop\2026-09-21-master"
$NEW_DATA_DIR = "C:\Users\Administrator\Desktop\2026-09-21-master\主流程数据集-2026-09-22"
$DOCUVERSE_PATH = "C:\Users\Administrator\Desktop\docuverse_cartographies_squizoanalythiques_Fe_lix_Guattari_1789114122714.docuverse.json"

Write-Host "================================" -ForegroundColor Cyan
Write-Host "主流程 - 阶段1: spaCy 名词抽取（独立数据集）" -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "输出目录: $NEW_DATA_DIR" -ForegroundColor Green
Write-Host "源文件: $DOCUVERSE_PATH" -ForegroundColor Gray
Write-Host ""

# 切换到新数据集目录，这样 s0-hits.json 和 s0-quality-report.json 会输出到这里
Set-Location $NEW_DATA_DIR
Write-Host "正在执行 spaCy 名词抽取..." -ForegroundColor Yellow

node "$PROJECT_ROOT\validate-s0-quality.js" "$DOCUVERSE_PATH"

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
    Write-Host "  运行 运行主流程-阶段2-LLM补缺.ps1" -ForegroundColor White
} else {
    Write-Host ""
    Write-Host "❌ 执行失败，请检查错误信息" -ForegroundColor Red
    Write-Host ""
    Write-Host "常见问题:" -ForegroundColor Yellow
    Write-Host "  - spaCy 服务未启动？请先运行 启动spacy服务.ps1" -ForegroundColor White
}

Write-Host ""
