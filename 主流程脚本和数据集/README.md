# 主流程脚本和数据集

本文件夹包含运行完整流程的脚本和生成的数据文件。

## 环境要求

已安装完毕（2026-09-22）：
- ✅ Python 3.11.9
- ✅ Node.js v24.19.0
- ✅ npm 依赖包（dotenv）
- ✅ Python 依赖包（flask, flask-cors, spacy 3.7.2）
- ✅ spaCy 法语模型（fr_core_news_sm 3.7.0）

## 运行流程

### 第一步：启动 spaCy 服务（必须）

在**单独的 PowerShell 终端**运行：
```powershell
.\启动spacy服务.ps1
```

**保持此终端运行，不要关闭！**

### 第二步：运行阶段1 - spaCy 名词抽取

在**新的 PowerShell 终端**运行：
```powershell
.\运行主流程-阶段1-spaCy抽取.ps1
```

**输出文件：**
- `s0-hits.json` - spaCy 抽取的名词及位置信息
- `s0-quality-report.json` - 质量报告（覆盖率统计）

### 第三步：配置 API Key（必须）

在项目根目录创建 `.env` 文件：
```
LLM_API_KEY=sk-your-deepseek-api-key-here
```

将 `sk-your-deepseek-api-key-here` 替换为你的真实 DeepSeek API Key。

### 第四步：运行阶段2 - LLM 补缺漏词

```powershell
.\运行主流程-阶段2-LLM补缺.ps1
```

**输出文件：**
- `s1-nouns-with-offsets.json` - LLM 补缺的名词及位置信息

### 第五步：运行阶段3 - 合并去重生成终词表

```powershell
.\运行主流程-阶段3-合并去重.ps1
```

**输出文件：**
- `final-noun-index.json` ✅ **最终名词索引/终词表**

## 数据说明

### 纯文表（Pure Text Table）
纯文表在 `src/core/pureTextTable.js` 中实时生成，是从 docuverse.json 提取的纯文本序列，用于：
- 计算名词覆盖率
- 定位名词在原文中的位置
- 提取未被 spaCy 覆盖的"剩余文"供 LLM 补缺

### 终词表（Final Noun Index）
`final-noun-index.json` 包含：
- 所有从文档中提取的名词（spaCy + LLM 补缺）
- 每个名词在原文中的精确位置（chunkKey, start, end）
- 去重后的规范化表面形式

这是后续名词召回和多路径推理的基础数据。

## 源文件

- 输入：`C:\Users\Administrator\Desktop\docuverse_cartographies_squizoanalythiques_Fe_lix_Guattari_1789114122714.docuverse.json`
- 作者：Félix Guattari
- 标题：Cartographies schizoanalytiques

## 常见问题

**Q: 阶段1失败，提示连接错误？**
A: 确保 spaCy 服务已启动（运行 `启动spacy服务.ps1` 并保持终端不关闭）

**Q: 阶段2失败，提示 API Key 错误？**
A: 检查项目根目录的 `.env` 文件，确保 `LLM_API_KEY` 配置正确

**Q: 如何获取 DeepSeek API Key？**
A: 访问 https://platform.deepseek.com/ 注册并获取 API Key

**Q: 可以跳过阶段2吗？**
A: 可以，但终词表的质量会降低。spaCy 有一定的漏检率，LLM 补缺可以显著提升名词覆盖率。

## 文件夹结构

```
主流程脚本和数据集/
├── README.md                          # 本说明文件
├── 启动spacy服务.ps1                  # spaCy 服务启动脚本
├── 运行主流程-阶段1-spaCy抽取.ps1     # 阶段1执行脚本
├── 运行主流程-阶段2-LLM补缺.ps1       # 阶段2执行脚本
├── 运行主流程-阶段3-合并去重.ps1      # 阶段3执行脚本
└── （数据文件在项目根目录生成）
```

运行后，数据文件会保存在项目根目录：
- `C:\Users\Administrator\Desktop\2026-09-21-master\s0-hits.json`
- `C:\Users\Administrator\Desktop\2026-09-21-master\s0-quality-report.json`
- `C:\Users\Administrator\Desktop\2026-09-21-master\s1-nouns-with-offsets.json`
- `C:\Users\Administrator\Desktop\2026-09-21-master\final-noun-index.json`

## 进度

- [x] 环境安装（Python, Node.js, 依赖包）
- [x] 创建运行脚本
- [ ] 运行阶段1（需要先启动 spaCy 服务）
- [ ] 配置 API Key
- [ ] 运行阶段2
- [ ] 运行阶段3
- [ ] 生成终词表

---

创建时间：2026-09-22 10:12
