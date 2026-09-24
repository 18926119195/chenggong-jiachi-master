# 主流程数据集-2026-09-22 运行环境说明

## 时间戳
2026年9月22日 19:00 完成批量重跑

---

## 环境变量配置

`.env` 文件内容：
```
LLM_API_KEY=sk-d3f8b345eb1a4623a4d3da6ba3ce4936
LLM_MODEL=deepseek-flash
LLM_BASE_URL=https://api.deepseek.com
```

**关键参数**：
- 模型：`deepseek-flash`（DeepSeek-V4.1-Flash）
- Thinking 模式：已在所有脚本中硬编码关闭（`reasoning_effort: "none"`）
- 最大输出 tokens：32768（`llmClient.js` 默认值）
- 上下文窗口：1M tokens 输入，384K tokens 最大输出

---

## 目录结构

```
主流程数据集-2026-09-22/
├── .env                                  # 环境变量（API key 和模型配置）
├── README-运行环境.md                    # 本说明文档
│
├── test-questions.json                   # 15个测试问题定义
├── noun-blacklist.json                   # 名词黑名单
├── s0-hits.json                          # Stage 0 精确匹配结果
├── s1-nouns-with-offsets.json            # Stage 1 spaCy提取的名词
├── final-noun-index.json                 # 合并去重后的名词索引
│
├── recall-nouns-llm.js                   # 步骤1: 名词粗筛（LLM打分 0-10）
├── noun-recall-results.json              # 粗筛+精打分完整结果（15个问题）
│
├── build-prompt-with-traceback.js        # 步骤2a: 构建多路径Prompt
├── generate-multipath-prompt.js          # 步骤2b: 生成Prompt文本文件
├── candidate-texts-for-llm.json          # 候选文本集合
├── material-traceback-map.json           # 材料溯源映射
├── multipath-prompt-Z*-Q*.txt            # 15个问题的Prompt文件
│
├── run-reasoning.js                      # 步骤3: 推理阶段（生成回答）
├── reasoning-output-Z*-Q*.json           # 15个问题的推理结果
│
├── rerun-from-scoring.js                 # 批量重跑工具（从精打分开始）
│
├── src/core/llmClient.js                 # LLM调用核心模块
├── src/core/pureTextTable.js             # 文本表格工具
└── src/core/llm-snapshots/               # LLM调用快照目录
    ├── call-0001-request.json
    └── call-0001-response.json
```

---

## 完整流程命令

### 前置准备（已完成）
```powershell
# 从根目录复制粗筛结果（避免重复调用API）
Copy-Item "..\noun-recall-results.json" "noun-recall-results.json"

# 确保环境变量文件存在
Copy-Item "..\.env" ".env"
```

### 单步执行

#### 步骤1: 名词粗筛（已有结果，无需重跑）
```powershell
node recall-nouns-llm.js Z1-Q1
# 输出: noun-recall-results.json（包含粗筛分数）
```

#### 步骤2: 构建多路径Prompt（已完成）
```powershell
node build-prompt-with-traceback.js
# 输出: candidate-texts-for-llm.json, material-traceback-map.json

node generate-multipath-prompt.js Z1-Q1
# 输出: multipath-prompt-Z1-Q1.txt
```

#### 步骤3: 推理阶段（已完成15个问题）
```powershell
# 单个问题
node run-reasoning.js Z1-Q1

# 批量（15个问题）
$env:LLM_MODEL="deepseek-flash"; $env:LLM_API_KEY="sk-d3f8b345eb1a4623a4d3da6ba3ce4936"; $env:LLM_BASE_URL="https://api.deepseek.com"; node rerun-from-scoring.js
```

### 批量重跑（从精打分开始）
```powershell
# 使用根目录的粗筛结果，重新执行精打分和推理
$env:LLM_MODEL="deepseek-flash"
$env:LLM_API_KEY="sk-d3f8b345eb1a4623a4d3da6ba3ce4936"
$env:LLM_BASE_URL="https://api.deepseek.com"
node rerun-from-scoring.js
```

**执行时间**: 约 5-10 分钟（15个问题）

---

## 数据文件说明

### 输入数据

#### `test-questions.json`
15个测试问题，分4个zone：
- Z1: Q1~Q4（4个问题）
- Z2: Q1~Q4（4个问题）
- Z3: Q1~Q3（3个问题）
- Z4: Q1~Q4（4个问题）

#### `noun-recall-results.json`
包含每个问题的：
- `coarseRecall`: 粗筛结果（0-10分）
- `fineScored`: 精打分结果（0-100分）
- 每个名词的 `surfaces`、`offsets`、`source`

### 中间数据

#### `candidate-texts-for-llm.json`
15个问题的候选文本集合，每个问题包含：
- `questionId`: Z*-Q*
- `questionText`: 问题原文
- `candidates`: 候选材料数组
  - `nounKey`: 名词键（如 "schizoanalyse"）
  - `surface`: 表层形式
  - `contexts`: 上下文片段数组（每个150字符，包含前后文）

#### `material-traceback-map.json`
材料溯源映射，记录每个候选材料的：
- `nounKey`: 名词键
- `surface`: 表层形式
- `source`: 来源（s0-exact / s1-spacy）
- `offsets`: 在原文中的偏移量

### 输出数据

#### `reasoning-output-Z*-Q*.json`
每个问题的推理结果，包含：
- `questionId`: 问题ID
- `questionText`: 问题原文
- `answer`: LLM生成的回答
- `usage`: Token用量统计
  - `prompt_tokens`: 输入tokens
  - `completion_tokens`: 输出tokens
  - `total_tokens`: 总tokens
  - **无 `reasoning_tokens`**（确认thinking已关闭）
- `promptSnapshot`: Prompt快照
- `materialSources`: 溯源信息（使用了哪些名词和上下文）

---

## 验证 Thinking 状态

### 快速检查（从根目录执行）
```powershell
node check-reasoning-thinking.cjs
```

输出示例：
```
总推理文件数: 15
无thinking: 15
有thinking: 0
```

### 手动检查单个文件
```powershell
Get-Content reasoning-output-Z1-Q1.json | ConvertFrom-Json | Select-Object -ExpandProperty usage
```

**预期输出**（无 `reasoning_tokens` 字段）：
```json
{
  "prompt_tokens": 45678,
  "completion_tokens": 1234,
  "total_tokens": 46912
}
```

---

## Token 用量统计

### 15个问题总用量（2026-09-22批次）
- **粗筛阶段**: 0次调用（使用根目录已有结果）
- **精打分阶段**: 15次调用
- **推理阶段**: 15次调用
- **总调用次数**: 30次

### 单个问题平均用量
- Prompt tokens: ~40,000~60,000
- Completion tokens: ~800~2,000
- 推理耗时: 2.9~9.2秒

---

## 明天继续工作的入口

### 场景1: 重新生成某个问题的回答
```powershell
cd "C:\Users\Administrator\Desktop\2026-09-21-master\主流程数据集-2026-09-22"
node run-reasoning.js Z1-Q1
```

### 场景2: 修改Prompt后批量重跑推理
```powershell
# 1. 修改 build-prompt-with-traceback.js 或 generate-multipath-prompt.js
# 2. 重新生成Prompt
node build-prompt-with-traceback.js
foreach ($q in @("Z1-Q1","Z1-Q2","Z1-Q3","Z1-Q4","Z2-Q1","Z2-Q2","Z2-Q3","Z2-Q4","Z3-Q1","Z3-Q2","Z3-Q3","Z4-Q1","Z4-Q2","Z4-Q3","Z4-Q4")) {
    node generate-multipath-prompt.js $q
}

# 3. 批量重跑推理
$env:LLM_MODEL="deepseek-flash"; $env:LLM_API_KEY="sk-d3f8b345eb1a4623a4d3da6ba3ce4936"; node rerun-from-scoring.js
```

### 场景3: 调整精打分阈值后重跑
```powershell
# 修改 recall-nouns-llm.js 的精打分逻辑
# 然后执行完整批量重跑
node rerun-from-scoring.js
```

---

## 注意事项

1. **环境变量**: 所有脚本依赖 `.env` 文件，确保它存在且包含正确的 API key
2. **Thinking 状态**: 所有脚本已硬编码 `reasoning_effort: "none"` 以关闭 thinking
3. **粗筛结果**: `noun-recall-results.json` 包含全部15个问题的粗筛数据，避免重复调用API
4. **快照目录**: `src/core/llm-snapshots/` 记录最后一批LLM调用的详细信息
5. **独立运行**: 此目录所有依赖已完整，可独立于根目录运行

---

## 文件完整性检查

运行以下命令确认所有关键文件都存在：
```powershell
@(
    ".env",
    "test-questions.json",
    "noun-recall-results.json",
    "candidate-texts-for-llm.json",
    "material-traceback-map.json",
    "recall-nouns-llm.js",
    "build-prompt-with-traceback.js",
    "generate-multipath-prompt.js",
    "run-reasoning.js",
    "rerun-from-scoring.js",
    "src\core\llmClient.js"
) | ForEach-Object {
    if (Test-Path $_) { "✓ $_" } else { "✗ $_ (缺失)" }
}
```

预期输出：全部文件显示 `✓`
