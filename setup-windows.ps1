# Windows 环境自动配置脚本
# PowerShell 执行策略：Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser

$ErrorActionPreference = "Stop"

Write-Host "=" * 80 -ForegroundColor Cyan
Write-Host "自动环境配置脚本 - Windows" -ForegroundColor Cyan
Write-Host "=" * 80 -ForegroundColor Cyan
Write-Host ""

# 1. 检查 Node.js
Write-Host "1. 检查 Node.js..." -ForegroundColor Yellow
try {
    $nodeVersion = node --version 2>&1
    Write-Host "   ✅ Node.js 已安装: $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "   ❌ Node.js 未安装" -ForegroundColor Red
    Write-Host "   请访问 https://nodejs.org/ 下载并安装 LTS 版本" -ForegroundColor Red
    Write-Host "   安装后重启终端再运行此脚本" -ForegroundColor Red
    exit 1
}

# 2. 检查 Python
Write-Host "`n2. 检查 Python..." -ForegroundColor Yellow
try {
    $pythonVersion = python --version 2>&1
    Write-Host "   ✅ Python 已安装: $pythonVersion" -ForegroundColor Green
} catch {
    Write-Host "   ❌ Python 未安装" -ForegroundColor Red
    Write-Host "   请访问 https://www.python.org/downloads/ 下载并安装" -ForegroundColor Red
    Write-Host "   安装时务必勾选 'Add Python to PATH'" -ForegroundColor Red
    exit 1
}

# 3. 检查 pip
Write-Host "`n3. 检查 pip..." -ForegroundColor Yellow
try {
    $pipVersion = pip --version 2>&1
    Write-Host "   ✅ pip 已安装: $pipVersion" -ForegroundColor Green
} catch {
    Write-Host "   ❌ pip 未找到，尝试使用 python -m pip" -ForegroundColor Yellow
}

# 4. 安装 Node.js 依赖
Write-Host "`n4. 安装 Node.js 依赖..." -ForegroundColor Yellow
if (Test-Path "package.json") {
    npm install
    if ($LASTEXITCODE -eq 0) {
        Write-Host "   ✅ Node.js 依赖安装完成" -ForegroundColor Green
    } else {
        Write-Host "   ❌ npm install 失败" -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "   ⚠️  package.json 不存在，跳过" -ForegroundColor Yellow
}

# 5. 安装 Python 依赖
Write-Host "`n5. 安装 Python 依赖..." -ForegroundColor Yellow
if (Test-Path "requirements.txt") {
    pip install -r requirements.txt
    if ($LASTEXITCODE -eq 0) {
        Write-Host "   ✅ Python 依赖安装完成" -ForegroundColor Green
    } else {
        Write-Host "   ❌ pip install 失败" -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "   ⚠️  requirements.txt 不存在，跳过" -ForegroundColor Yellow
}

# 6. 下载 spaCy 法语模型
Write-Host "`n6. 下载 spaCy 法语模型..." -ForegroundColor Yellow
python -m spacy download fr_core_news_sm
if ($LASTEXITCODE -eq 0) {
    Write-Host "   ✅ spaCy 模型下载完成" -ForegroundColor Green
} else {
    Write-Host "   ⚠️  spaCy 模型下载失败或已存在" -ForegroundColor Yellow
}

# 7. 配置 .env 文件
Write-Host "`n7. 配置 .env 文件..." -ForegroundColor Yellow
if (-not (Test-Path ".env")) {
    if (Test-Path ".env.example") {
        Copy-Item ".env.example" ".env"
        Write-Host "   ✅ 已从 .env.example 创建 .env 文件" -ForegroundColor Green
        Write-Host "   ⚠️  请编辑 .env 文件，填入你的 LLM_API_KEY" -ForegroundColor Yellow
        Write-Host "      获取地址: https://platform.deepseek.com/" -ForegroundColor Cyan
    } else {
        Write-Host "   ⚠️  .env.example 不存在，无法自动创建 .env" -ForegroundColor Yellow
    }
} else {
    Write-Host "   ✅ .env 文件已存在" -ForegroundColor Green
}

# 8. 运行环境测试
Write-Host "`n8. 运行环境验证..." -ForegroundColor Yellow
Write-Host "   注意: 此步骤需要先启动 spaCy 服务" -ForegroundColor Cyan
Write-Host "   如果 spaCy 服务未启动，请先在另一个终端运行:" -ForegroundColor Cyan
Write-Host "   cd spacy-sidecar" -ForegroundColor Cyan
Write-Host "   python server.py" -ForegroundColor Cyan
Write-Host ""
$response = Read-Host "是否立即运行环境测试？(y/n)"

if ($response -eq "y" -or $response -eq "Y") {
    node test-environment.js
} else {
    Write-Host "   跳过环境测试" -ForegroundColor Yellow
}

# 完成
Write-Host "`n" + ("=" * 80) -ForegroundColor Cyan
Write-Host "✅ 环境配置完成！" -ForegroundColor Green
Write-Host ("=" * 80) -ForegroundColor Cyan
Write-Host "`n下一步操作:" -ForegroundColor Cyan
Write-Host "  1. 编辑 .env 文件，配置 LLM_API_KEY" -ForegroundColor White
Write-Host "  2. 启动 spaCy 服务（新终端）:" -ForegroundColor White
Write-Host "     cd spacy-sidecar" -ForegroundColor Gray
Write-Host "     python server.py" -ForegroundColor Gray
Write-Host "  3. 运行测试:" -ForegroundColor White
Write-Host "     node test-environment.js" -ForegroundColor Gray
Write-Host "  4. 运行完整流程:" -ForegroundColor White
Write-Host "     node run-full-pipeline.js Z1-Q1" -ForegroundColor Gray
Write-Host "`n详细文档: DEPLOYMENT.md" -ForegroundColor Cyan
Write-Host ""
