# 运行主流程 - 阶段2: LLM 补缺漏词（s1）
# 输出到新数据集文件夹，不覆盖原有数据

$env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")

$PROJECT_ROOT = "C:\Users\Administrator\Desktop\2026-09-21-master"
$NEW_DATA_DIR = "C:\Users\Administrator\Desktop\2026-09-21-master\主流程数据集-2026-09-22"

Write-Host "================================" -ForegroundColor Cyan
Write-Host "主流程 - 阶段2: LLM 补缺漏词（独立数据集）" -ForegroundColor Cyan
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

# 设置环境变量，指定输入文件路径（从新数据集目录读取）
# s1-llm-fill.js 默认从 process.cwd() 读取 s0-hits.json 和 s0-quality-report.json
# 因为 cwd 已切换到新目录，会自动读取新目录的文件
Write-Host "正在执行 LLM 补缺..." -ForegroundColor Yellow
Write-Host "（此过程需要调用 DeepSeek API，可能需要几分钟）" -ForegroundColor Gray
Write-Host ""

node "$PROJECT_ROOT\s1-llm-fill.js"

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
}

Write-Host ""
