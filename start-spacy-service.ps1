# 启动 spaCy 服务的 PowerShell 脚本

$ErrorActionPreference = "Stop"

Write-Host "=" * 60 -ForegroundColor Cyan
Write-Host "启动 spaCy 名词抽取服务" -ForegroundColor Cyan
Write-Host "=" * 60 -ForegroundColor Cyan
Write-Host ""

# 检查 Python
try {
    $pythonVersion = python --version 2>&1
    Write-Host "✅ Python: $pythonVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ Python 未安装或未添加到 PATH" -ForegroundColor Red
    exit 1
}

# 检查 spacy-sidecar 目录
if (-not (Test-Path "spacy-sidecar\server.py")) {
    Write-Host "❌ 找不到 spacy-sidecar\server.py" -ForegroundColor Red
    Write-Host "   请确保在项目根目录运行此脚本" -ForegroundColor Red
    exit 1
}

# 检查依赖
Write-Host "检查 Python 依赖..." -ForegroundColor Yellow
$packages = @("flask", "flask-cors", "spacy")
$missingPackages = @()

foreach ($pkg in $packages) {
    $result = python -c "import $pkg" 2>&1
    if ($LASTEXITCODE -ne 0) {
        $missingPackages += $pkg
    }
}

if ($missingPackages.Count -gt 0) {
    Write-Host "⚠️  缺少以下依赖: $($missingPackages -join ', ')" -ForegroundColor Yellow
    Write-Host "正在安装..." -ForegroundColor Yellow
    pip install -r requirements.txt
}

# 检查 spaCy 模型
Write-Host "`n检查 spaCy 法语模型..." -ForegroundColor Yellow
$modelCheck = python -c "import spacy; spacy.load('fr_core_news_sm')" 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "⚠️  spaCy 模型未安装，正在下载..." -ForegroundColor Yellow
    python -m spacy download fr_core_news_sm
}

Write-Host "`n" + ("=" * 60) -ForegroundColor Cyan
Write-Host "🚀 启动服务..." -ForegroundColor Green
Write-Host ("=" * 60) -ForegroundColor Cyan
Write-Host ""
Write-Host "服务地址: http://localhost:5001" -ForegroundColor Cyan
Write-Host "健康检查: http://localhost:5001/health" -ForegroundColor Cyan
Write-Host ""
Write-Host "按 Ctrl+C 停止服务" -ForegroundColor Yellow
Write-Host ""

# 启动服务
Set-Location spacy-sidecar
python server.py
