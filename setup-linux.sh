#!/bin/bash
# Linux/macOS 环境自动配置脚本

set -e

echo "================================================================================"
echo "自动环境配置脚本 - Linux/macOS"
echo "================================================================================"
echo ""

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# 1. 检查 Node.js
echo -e "${YELLOW}1. 检查 Node.js...${NC}"
if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version)
    echo -e "   ${GREEN}✅ Node.js 已安装: $NODE_VERSION${NC}"
else
    echo -e "   ${RED}❌ Node.js 未安装${NC}"
    echo -e "   ${RED}请访问 https://nodejs.org/ 或使用 nvm 安装${NC}"
    exit 1
fi

# 2. 检查 Python
echo -e "\n${YELLOW}2. 检查 Python...${NC}"
if command -v python3 &> /dev/null; then
    PYTHON_VERSION=$(python3 --version)
    echo -e "   ${GREEN}✅ Python 已安装: $PYTHON_VERSION${NC}"
    PYTHON_CMD="python3"
    PIP_CMD="pip3"
elif command -v python &> /dev/null; then
    PYTHON_VERSION=$(python --version)
    echo -e "   ${GREEN}✅ Python 已安装: $PYTHON_VERSION${NC}"
    PYTHON_CMD="python"
    PIP_CMD="pip"
else
    echo -e "   ${RED}❌ Python 未安装${NC}"
    echo -e "   ${RED}请使用包管理器安装 Python 3.8+${NC}"
    exit 1
fi

# 3. 检查 pip
echo -e "\n${YELLOW}3. 检查 pip...${NC}"
if command -v $PIP_CMD &> /dev/null; then
    PIP_VERSION=$($PIP_CMD --version)
    echo -e "   ${GREEN}✅ pip 已安装: $PIP_VERSION${NC}"
else
    echo -e "   ${RED}❌ pip 未找到${NC}"
    exit 1
fi

# 4. 安装 Node.js 依赖
echo -e "\n${YELLOW}4. 安装 Node.js 依赖...${NC}"
if [ -f "package.json" ]; then
    npm install
    echo -e "   ${GREEN}✅ Node.js 依赖安装完成${NC}"
else
    echo -e "   ${YELLOW}⚠️  package.json 不存在，跳过${NC}"
fi

# 5. 安装 Python 依赖
echo -e "\n${YELLOW}5. 安装 Python 依赖...${NC}"
if [ -f "requirements.txt" ]; then
    $PIP_CMD install -r requirements.txt
    echo -e "   ${GREEN}✅ Python 依赖安装完成${NC}"
else
    echo -e "   ${YELLOW}⚠️  requirements.txt 不存在，跳过${NC}"
fi

# 6. 下载 spaCy 法语模型
echo -e "\n${YELLOW}6. 下载 spaCy 法语模型...${NC}"
$PYTHON_CMD -m spacy download fr_core_news_sm || echo -e "   ${YELLOW}⚠️  spaCy 模型下载失败或已存在${NC}"
echo -e "   ${GREEN}✅ spaCy 模型配置完成${NC}"

# 7. 配置 .env 文件
echo -e "\n${YELLOW}7. 配置 .env 文件...${NC}"
if [ ! -f ".env" ]; then
    if [ -f ".env.example" ]; then
        cp .env.example .env
        echo -e "   ${GREEN}✅ 已从 .env.example 创建 .env 文件${NC}"
        echo -e "   ${YELLOW}⚠️  请编辑 .env 文件，填入你的 LLM_API_KEY${NC}"
        echo -e "      ${CYAN}获取地址: https://platform.deepseek.com/${NC}"
    else
        echo -e "   ${YELLOW}⚠️  .env.example 不存在，无法自动创建 .env${NC}"
    fi
else
    echo -e "   ${GREEN}✅ .env 文件已存在${NC}"
fi

# 8. 设置脚本权限
echo -e "\n${YELLOW}8. 设置脚本执行权限...${NC}"
chmod +x setup-linux.sh 2>/dev/null || true
chmod +x spacy-sidecar/server.py 2>/dev/null || true
echo -e "   ${GREEN}✅ 权限设置完成${NC}"

# 完成
echo -e "\n================================================================================"
echo -e "${GREEN}✅ 环境配置完成！${NC}"
echo -e "================================================================================"
echo -e "\n${CYAN}下一步操作:${NC}"
echo -e "  ${NC}1. 编辑 .env 文件，配置 LLM_API_KEY${NC}"
echo -e "  ${NC}2. 启动 spaCy 服务（新终端）:${NC}"
echo -e "     ${YELLOW}cd spacy-sidecar${NC}"
echo -e "     ${YELLOW}$PYTHON_CMD server.py${NC}"
echo -e "  ${NC}3. 运行测试:${NC}"
echo -e "     ${YELLOW}node test-environment.js${NC}"
echo -e "  ${NC}4. 运行完整流程:${NC}"
echo -e "     ${YELLOW}node run-full-pipeline.js Z1-Q1${NC}"
echo -e "\n${CYAN}详细文档: DEPLOYMENT.md${NC}"
echo ""
