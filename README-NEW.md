# ni-zuibang-2026-09-20 项目

这是一个基于名词表的多路径推理系统，用于从法语学术文献（Félix Guattari 的 *Cartographies schizoanalytiques*）中召回相关材料并生成推理答案。

## 🚀 快速开始

### 前置要求
- Node.js v18+ ([下载](https://nodejs.org/))
- Python 3.8+ ([下载](https://www.python.org/))
- DeepSeek API Key ([注册](https://platform.deepseek.com/))

### 一键配置

**Windows:**
```powershell
.\setup-windows.ps1
```

**Linux/macOS:**
```bash
chmod +x setup-linux.sh
./setup-linux.sh
```

### 配置 API Key

1. 编辑 `.env` 文件（已自动创建）
2. 填入你的 DeepSeek API Key：
   ```env
   LLM_API_KEY=sk-your-actual-key-here
   ```

### 验证环境

```bash
npm run test:env
```

### 运行项目

```bash
# 终端1：启动 spaCy 服务
python spacy-sidecar/server.py

# 终端2：运行完整流程
npm run pipeline Z1-Q1
```

## 📚 详细文档

| 文档 | 说明 |
|------|------|
| [QUICKSTART.md](QUICKSTART.md) | 快速开始指南 |
| [DEPLOYMENT.md](DEPLOYMENT.md) | 完整部署文档（348行） |
| [DEPLOYMENT_CHECKLIST.md](DEPLOYMENT_CHECKLIST.md) | 部署清单和验证 |
| [README-DEPLOYMENT-SUMMARY.md](README-DEPLOYMENT-SUMMARY.md) | 部署总结 |
| [PROGRESS.md](PROGRESS.md) | 开发进度日志 |

## 🎯 项目架构

本项目分为 7 个阶段：

### 阶段 0-3：生成名词表（已预生成，可跳过）
```
原始文档 (docuverse.json)
  ↓ validate-s0-quality.js (spaCy 抽取)
s0-hits.json
  ↓ s1-llm-fill.js (LLM 补缺)
s1-nouns-with-offsets.json
  ↓ merge-s0-s1.js (合并去重)
final-noun-index.json (终词表)
```

### 阶段 4-7：名词召回 → 多路径推理（主流程）
```
final-noun-index.json
  ↓ recall-nouns-llm.js (粗筛+精打分)
noun-recall-results.json
  ↓ build-prompt-with-traceback.js (构建推理输入)
candidate-texts-for-llm.json + material-traceback-map.json
  ↓ generate-multipath-prompt.js (生成推理 Prompt)
multipath-prompt-Z1-Q1.txt
  ↓ run-reasoning.js (执行推理)
reasoning-output-Z1-Q1.json (最终答案)
```

## 🛠️ 技术栈

- **Node.js** (ES Modules) - 主流程脚本
- **Python + Flask** - spaCy 名词抽取 HTTP 服务
- **spaCy** (fr_core_news_sm) - 法语 NLP 处理
- **DeepSeek API** - LLM 推理（OpenAI 兼容接口）

## 📦 npm Scripts

```bash
npm run setup        # 环境检查和配置
npm run test:env     # 验证环境
npm run pipeline     # 运行完整流程 (阶段4-7)
```

## 📁 项目结构

```
ni-zuibang-2026-09-20-main/
├── 📘 文档
│   ├── README.md                       # 本文件
│   ├── QUICKSTART.md                   # 快速开始
│   ├── DEPLOYMENT.md                   # 完整部署指南
│   ├── DEPLOYMENT_CHECKLIST.md         # 部署清单
│   └── README-DEPLOYMENT-SUMMARY.md    # 部署总结
│
├── 🔧 配置与脚本
│   ├── package.json                    # Node.js 配置
│   ├── requirements.txt                # Python 依赖
│   ├── .env.example                    # 环境变量模板
│   ├── setup-windows.ps1               # Windows 自动配置
│   ├── setup-linux.sh                  # Linux 自动配置
│   ├── setup-check.js                  # 环境检查
│   ├── test-environment.js             # 环境测试
│   └── start-spacy-service.ps1         # spaCy 服务启动
│
├── 🐍 Python 服务
│   └── spacy-sidecar/
│       └── server.py                   # spaCy HTTP 服务
│
├── 🎯 主流程脚本 (阶段0-7)
│   ├── validate-s0-quality.js          # 阶段1：spaCy 抽取
│   ├── s1-llm-fill.js                  # 阶段2：LLM 补缺
│   ├── merge-s0-s1.js                  # 阶段3：合并词表
│   ├── recall-nouns-llm.js             # 阶段4：名词召回
│   ├── build-prompt-with-traceback.js  # 阶段5：构建输入
│   ├── generate-multipath-prompt.js    # 阶段6：生成 Prompt
│   ├── run-reasoning.js                # 阶段7：执行推理
│   ├── generate-noun-index.js          # 阶段0-3 一键封装
│   └── run-full-pipeline.js            # 阶段4-7 一键封装
│
├── 📦 核心模块
│   └── src/core/
│       ├── llmClient.js                # LLM 客户端
│       └── pureTextTable.js            # 文本表格处理
│
└── 📊 数据文件
    ├── test-questions.json             # 测试问题集
    └── final-noun-index.json           # 预生成名词表
```

## 🐛 常见问题

### "node 不是内部或外部命令"
Node.js 未安装或未添加到 PATH。
- 解决：访问 https://nodejs.org/ 安装，勾选 "Add to PATH"

### "python 不是内部或外部命令"
Python 未安装或未添加到 PATH。
- 解决：访问 https://www.python.org/ 安装，勾选 "Add Python to PATH"

### "ECONNREFUSED localhost:5001"
spaCy 服务未启动。
- 解决：在另一个终端运行 `python spacy-sidecar/server.py`

### "LLM API 调用失败 (401)"
API Key 无效或未配置。
- 解决：检查 `.env` 文件中的 `LLM_API_KEY`

更多问题解决：见 [DEPLOYMENT.md](DEPLOYMENT.md) 第六章

## 📊 输出文件

运行完成后会生成：

- `noun-recall-results.json` - 名词召回结果
- `candidate-texts-for-llm.json` - LLM 输入材料
- `material-traceback-map.json` - 材料溯源映射
- `multipath-prompt-Z1-Q1.txt` - 推理 Prompt
- `reasoning-output-Z1-Q1.json` - 最终推理答案

## 🔍 验证成功标志

运行 `npm run test:env` 应看到：

```
✅ 所有测试通过！环境配置正确

下一步：运行完整流程
  node run-full-pipeline.js Z1-Q1
```

## 📖 使用示例

### 运行单个问题
```bash
npm run pipeline Z1-Q1
```

### 运行所有问题
```bash
npm run pipeline
```

### 从头生成名词表（需要 docuverse.json）
```bash
node generate-noun-index.js <docuverse.json路径>
```

## 🎓 项目背景

本项目用于处理法语学术文献，特别是 Félix Guattari 的 *Cartographies schizoanalytiques*。系统通过以下步骤工作：

1. **名词抽取**：使用 spaCy 从文档中抽取所有名词，建立索引
2. **补缺**：使用 LLM 补充 spaCy 可能漏掉的专业术语
3. **召回**：根据问题召回相关名词和对应的文本片段
4. **推理**：使用多路径推理生成最终答案

## 📄 许可证

Private - 仅供内部使用

## 🙋 技术支持

遇到问题？请查看：
1. [QUICKSTART.md](QUICKSTART.md) - 快速开始
2. [DEPLOYMENT.md](DEPLOYMENT.md) - 完整文档
3. [DEPLOYMENT_CHECKLIST.md](DEPLOYMENT_CHECKLIST.md) - 清单验证

---

**版本**: 0.2.0  
**最后更新**: 2026-09-21  
**支持平台**: Windows 10/11, Linux, macOS
