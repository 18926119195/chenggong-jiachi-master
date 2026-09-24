# 启动 spaCy 名词抽取服务
# 此服务需要在单独的终端保持运行

$env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")

Write-Host "================================" -ForegroundColor Cyan
Write-Host "启动 spaCy 法语名词抽取服务" -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "服务地址: http://localhost:5001" -ForegroundColor Green
Write-Host "保持此终端运行，不要关闭" -ForegroundColor Yellow
Write-Host ""

Set-Location "C:\Users\Administrator\Desktop\2026-09-21-master"
python spacy-sidecar/server.py
