# 启动 spaCy 服务
# 必须在运行阶段1之前启动

$env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")

$PROJECT_ROOT = "C:\Users\Administrator\Desktop\2026-09-21-master"

Write-Host "================================" -ForegroundColor Cyan
Write-Host "启动 spaCy 服务" -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "此终端将保持运行状态，不要关闭！" -ForegroundColor Yellow
Write-Host "请在另一个终端运行阶段1脚本。" -ForegroundColor Yellow
Write-Host ""

Set-Location $PROJECT_ROOT
node "$PROJECT_ROOT\spacy-sidecar\server.py"
