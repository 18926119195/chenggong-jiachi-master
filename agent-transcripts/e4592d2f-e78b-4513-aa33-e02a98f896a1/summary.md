# 项目环境搭建与完整部署

**会话时间**：2026-09-21 09:58 - 18:14  
**记录ID**：e4592d2f-e78b-4513-aa33-e02a98f896a1  
**轮次**：749 行（最长记录）

## 核心议题

从零开始理解项目结构，配置 Node.js 和 Python 环境，解决依赖问题，完成拓扑链召回引擎优化、多轮推理脚本开发，最终将所有变更推送到 GitHub 私有仓库。

## 主要成果

### 1. 环境搭建与依赖安装

**Node.js 部分**：
- 检查并确认 Node.js 版本（v18+）
- 安装项目依赖：`npm install`
- 关键依赖：`dotenv`、`axios`、`pdf-parse`

**Python 部分**（spaCy Sidecar）：
- 检查 Python 版本（3.8+）
- 创建虚拟环境（`python -m venv .venv`）
- 安装依赖：`pip install -r spacy-sidecar/requirements.txt`
- 下载法语模型：`python -m spacy download fr_core_news_md`

**环境变量配置**（`.env`）：
```
DEEPSEEK_API_KEY=sk-...
DEEPSEEK_BASE_URL=https://api.deepseek.com
SPACY_SIDECAR_URL=http://localhost:5000
```

### 2. 代码功能开发与优化

**核心脚本开发**：

**A. `recall-nouns-llm.js` - 拓扑链召回引擎优化**
- 修复跨 chunk 边界问题：`offsets` 现在自带 `chunkKey` + 局部 `start/end`
- 实现拓扑链区间合并：相邻的 `chunkKey` 相同且间距 ≤120 字符的链会被合并
- 新增五字段输出：`chunkKey`、`page`、`chainStart`、`chainEnd`、`text`
- 通过 Set 去重 `chunkKey`，避免 35.2% 重复率

**B. `reasoning-multi-path.js` - 多轮推理 LLM 脚本**
- 读取 `noun-recall-results.json` 中的召回材料
- 将材料编码为机器符码 `【【N】】`（N 为材料编号）
- 构建多路径推理 Prompt，要求 LLM 输出 2-4 条独立推理路径
- 自动解析推理输出中的 `【【N】】` 引用
- 将引用映射回溯源信息（`chunkKey`、页码、区间）
- 输出结构化结果到 `reasoning-output-Z{zone}-Q{id}.json`

**推理 Prompt 格式**：
```
问题：{question}

材料：

【【1】】(命中: 3)
{原文块1}

【【2】】(命中: 5)
{原文块2}

---

要求：输出2-4条独立推理路径，每条路径包含多个步骤，每步可引用一个或多个材料【【N】】。

格式：

# 路径一：[标题]

步骤1：使用【【X】】，提取...
步骤2：综合【【Y】】【【Z】】，对比...

结论：[此路径结论]
```

### 3. 数据清理与文档生成

**数据集更新**：
- 删除旧数据集 `noun-recall-results.OLD.json.bak`（3.79 MB，字段不完整）
- 保留最新数据集 `noun-recall-results.json`（2.85 MB，25 个问题，字段完整）
- 删除临时测试文件（`output.txt`、`check_*.py`）

**生成的文档**：
- `CHANGELOG-2026-09-21.md`：详细记录 16:22 - 18:10 的所有变更
- `RECALL_REPORT.md`：召回结果统计报告
- `虚词检查分析报告.md`：虚词过滤验证结果

### 4. Git 版本控制与推送

**仓库初始化**：
```bash
git init
git remote add origin https://github.com/18926119195/2026-09-21.git
```

**提交记录**：
- 初始提交：`4665d5d` - 项目基础文件
- 功能提交：`05452e1` - "feat: 拓扑链召回引擎优化 + 多轮推理 LLM 脚本"

**推送统计**：
- 10 个文件修改
- +62,669 行新增
- -203,303 行删除（主要是数据集去重压缩）
- 推送成功：`4665d5d..05452e1  master -> master`

## 关键技术点

### 拓扑链区间合并算法

**问题**：同一评分词可能在相邻位置多次出现，产生重叠或紧邻的召回区间。

**解决方案**（代码位置：`recall-nouns-llm.js:177-214`）：
1. 按 `chunkKey` 分组所有拓扑链
2. 对每组按 `chainStart` 升序排序
3. 遍历时判断：如果当前链与上一条链间距 ≤120 字符，合并为一条
4. 合并后的链：`chainStart` 取最小值，`chainEnd` 取最大值
5. 最终去重率：35.2% → 实际召回材料数减少约 1/3

### 材料引用溯源机制

**工作流**：
1. 召回时为每个 chunk 分配唯一 `materialId`（从 1 开始递增）
2. 构建 `tracebackMap`：
   ```json
   {
     "1": {
       "chunkKey": "p12_c003",
       "page": 12,
       "chainStart": 450,
       "chainEnd": 680,
       "hits": [
         {"noun": "schizophrénie", "score": 0.85, "nounId": "schizophrénie"},
         {"noun": "analyse", "score": 0.72, "nounId": "analyse"}
       ]
     }
   }
   ```
3. LLM 推理时引用 `【【1】】`
4. 解析输出时，将 `【【1】】` 映射回 `tracebackMap[1]`，得到页码和区间
5. 前端可据此高亮原文对应位置

## 遇到的问题与解决

### 问题1：Python 脚本无法在 PowerShell 中输出结果

**现象**：`python -c "..."` 或 `python check_fw.py` 运行后无输出。

**原因**：PowerShell 的输出重定向问题或脚本编码问题。

**解决**：改为写入文件后读取 `python script.py > output.txt; type output.txt`，或直接用 Node.js 处理 JSON 数据。

### 问题2：跨 chunk 边界导致拓扑链定位错误

**现象**：早期版本用全局 offset，需要二分查找 chunk 并换算局部位移，跨边界时会取到错误的邻居词。

**解决**：改为 `offsets` 自带 `chunkKey` + 局部 `start/end`，直接用 Map 查 chunk，不再跨边界。

### 问题3：召回材料重复率 35.2%

**现象**：多个高分名词命中同一个 chunk，导致同一材料被多次召回。

**解决**：用 `Set` 去重 `chunkKey`，只保留唯一的 chunk。

## 项目结构总结

```
ni-zuibang-2026-09-20-main/
├── src/
│   └── core/
│       └── llmClient.js          # LLM 调用封装（DeepSeek API）
├── spacy-sidecar/
│   ├── server.py                 # spaCy NER 服务（Flask）
│   └── requirements.txt          # Python 依赖
├── recall-nouns-llm.js           # 拓扑链召回引擎（核心）
├── reasoning-multi-path.js       # 多路径推理脚本（新增）
├── build-prompt-with-traceback.js # 材料溯源映射构建
├── generate-multipath-prompt.js  # Prompt 生成工具
├── noun-recall-results.json      # 召回结果（2.85 MB，25 题）
├── final-noun-index.json         # 名词索引（S0+S1 合并）
├── docuverse_*.json              # 原始语料（Docuverse 格式）
├── .env                          # 环境变量（API Key）
└── package.json                  # Node.js 依赖
```

## 下一步建议

1. **DeepSeek API 充值后**：运行 `node reasoning-multi-path.js` 验证多路径推理输出质量
2. **虚词清洗**：根据虚词检查报告，实施 S0/S1 清洗脚本
3. **残文过滤**：统计短残文中的纯虚词占比，决定是否实施过滤
4. **前端开发**：基于 `tracebackMap` 实现材料引用的原文高亮功能

## 语境与价值

这次会话是整个项目的"从 0 到 1"阶段，完成了环境搭建、核心引擎优化、推理脚本开发、数据清理、版本控制等全流程工作。为后续的精度优化、前端集成、生产部署奠定了完整基础。
