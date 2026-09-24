# 运行主流程 - 阶段3: 合并 s0 和 s1，生成最终名词表
# 输出到新数据集文件夹，不覆盖原有数据

$env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")

$PROJECT_ROOT = "C:\Users\Administrator\Desktop\2026-09-21-master"
$NEW_DATA_DIR = "C:\Users\Administrator\Desktop\2026-09-21-master\主流程数据集-2026-09-22"

Write-Host "================================" -ForegroundColor Cyan
Write-Host "主流程 - 阶段3: 合并去重生成终词表（独立数据集）" -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "输出目录: $NEW_DATA_DIR" -ForegroundColor Green
Write-Host ""

# 切换到新数据集目录
Set-Location $NEW_DATA_DIR

# 检查前置文件
if (!(Test-Path "s0-hits.json")) {
    Write-Host "❌ 未找到 s0-hits.json，请先运行阶段1" -ForegroundColor Red
    exit 1
}

if (!(Test-Path "s1-nouns-with-offsets.json")) {
    Write-Host "❌ 未找到 s1-nouns-with-offsets.json，请先运行阶段2" -ForegroundColor Red
    exit 1
}

Write-Host "正在合并 s0 和 s1，去重生成终词表..." -ForegroundColor Yellow
Write-Host ""

node "$PROJECT_ROOT\merge-s0-s1.js"

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "================================" -ForegroundColor Green
    Write-Host "✅ 阶段3完成 - 终词表已生成！" -ForegroundColor Green
    Write-Host "================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "生成的文件:" -ForegroundColor Cyan
    Write-Host "  - final-noun-index.json ✅ (最终名词索引/终词表)" -ForegroundColor White
    Write-Host ""
    Write-Host "数据集路径: $NEW_DATA_DIR" -ForegroundColor Green
} else {
    Write-Host ""
    Write-Host "❌ 执行失败，请检查错误信息" -ForegroundColor Red
}

Write-Host ""
