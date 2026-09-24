# 快速开始指南

## 前置要求

在开始之前，请确保系统已安装：
- **Node.js** v18+ ([下载](https://nodejs.org/))
- **Python** 3.8+ ([下载](https://www.python.org/))

## 一键自动配置

### Windows

```powershell
# 在 PowerShell 中运行
.\setup-windows.ps1
```

### Linux/macOS

```bash
# 在终端中运行
chmod +x setup-linux.sh
./setup-linux.sh
```

## 手动配置（可选）

如果自动脚本无法运行，可以手动执行以下步骤：

### 1. 安装依赖

```bash
# Node.js 依赖
npm install

# Python 依赖
pip install -r requirements.txt

# 下载 spaCy 法语模型
python -m spacy download fr_core_news_sm
```

### 2. 配置 API Key

```bash
# 复制环境变量模板
cp .env.example .env  # Linux/macOS
Copy-Item .env.example .env  # Windows PowerShell
```

编辑 `.env` 文件，填入你的 DeepSeek API Key：
```env
LLM_API_KEY=sk-your-actual-api-key-here
```

**获取 API Key**: https://platform.deepseek.com/

### 3. 验证环境

```bash
node test-environment.js
```

## 运行项目

### 启动 spaCy 服务（终端1）

```bash
# Windows
cd spacy-sidecar
python server.py

# Linux/macOS
cd spacy-sidecar
python3 server.py
```

或使用快捷脚本：

```powershell
# Windows
.\start-spacy-service.ps1
```

### 运行完整流程（终端2）

```bash
# 运行单个问题
node run-full-pipeline.js Z1-Q1

# 运行所有问题
node run-full-pipeline.js
```

## 输出文件

执行完成后，会生成以下文件：

- `noun-recall-results.json` - 名词召回结果
- `candidate-texts-for-llm.json` - LLM 推理输入材料
- `material-traceback-map.json` - 材料溯源映射
- `multipath-prompt-Z1-Q1.txt` - 生成的推理 Prompt
- `reasoning-output-Z1-Q1.json` - 最终推理答案

## 项目架构

```
完整流程分为 7 个阶段：

阶段 0-3：生成名词表（已预生成，可跳过）
├── validate-s0-quality.js    # spaCy 名词抽取
├── s1-llm-fill.js             # LLM 补缺漏词
└── merge-s0-s1.js             # 合并去重 → final-noun-index.json

阶段 4-7：名词召回 → 多路径推理（主流程）
├── recall-nouns-llm.js        # 名词召回（粗筛+精打分）
├── build-prompt-with-traceback.js  # 构建推理输入
├── generate-multipath-prompt.js    # 生成推理 Prompt
└── run-reasoning.js           # 执行推理，输出答案
```

## 常见问题

### "node 不是内部或外部命令"
- 未安装 Node.js，或未添加到 PATH
- 解决：重新安装并勾选 "Add to PATH"，重启终端

### "python 不是内部或外部命令"
- 未安装 Python，或未添加到 PATH
- 解决：重新安装并勾选 "Add Python to PATH"

### "spaCy 服务连接失败"
- spaCy 服务未启动
- 解决：在另一个终端运行 `python spacy-sidecar/server.py`

### "LLM API 调用失败 (401)"
- API Key 无效或未配置
- 解决：检查 `.env` 文件中的 `LLM_API_KEY`

## 更多信息

详细部署指南：`DEPLOYMENT.md`

## 技术栈

- **Node.js**: 主流程脚本（ES Modules）
- **Python**: spaCy 名词抽取服务
- **spaCy**: 法语 NLP 处理（fr_core_news_sm 模型）
- **DeepSeek API**: LLM 推理（兼容 OpenAI 接口）

---

**项目说明**: 本项目是一个基于名词表的多路径推理系统，用于从法语学术文献中召回相关材料并生成推理答案。
