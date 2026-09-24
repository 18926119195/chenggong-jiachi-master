# CoT 对比实验

**实验目标**：对比"有无名词召回拓扑链预筛选"对最终推理质量的影响，同时考察 Chain-of-Thought（CoT）的效果。

**实验日期**：2026-09-22

---

## 实验设计

### 核心差异

| | 实验组一（CoT 直推） | 实验组二（主流程） |
|---|---|---|
| 材料来源 | 纯文表全部 chunk | 经 noun recall + 拓扑链筛选后的高相关 chunk |
| 材料数量 | 全量（约 1000+ chunks，可配置） | 少量（通常 10-30 个） |
| reasoning_effort | `high`（开思维链，对齐官网） | `none`（关思维链） |
| LLM 调用次数 | 1 次（最终推理） | 多次（粗筛 + 精打 + 最终推理） |

### 控制变量

| 变量 | 实验组一 | 实验组二 |
|------|---------|---------|
| 纯文表文本内容 | ✅ 完全一致 | ✅ 完全一致 |
| chunkKey → 机器符号【【n】】| ✅ | ✅ |
| 多路径推理 Prompt 模板 | ✅ 完全一致 | ✅ 完全一致 |
| 引用规范 / 推理策略指令 | ✅ 完全一致 | ✅ 完全一致 |

---

## 实验组一（CoT 直推）流程

```
纯文表（全部 chunk）
    ↓ build-prompt-cot.js（chunkKey →【【n】】）
candidate-texts-for-llm-cot.json
    ↓ generate-multipath-prompt-cot.js（取前 MAX_CHUNKS 个，默认 100）
multipath-prompt-cot-<questionId>.txt
    ↓ run-reasoning-cot.js（reasoning_effort=high）
reasoning-output-cot-<questionId>.json
```

**注意**：受 DeepSeek API 上下文窗口限制（128K tokens），实验组一实际使用前 100 个 chunks（约 6.9% 全量材料），而非完整 1446 chunks。

### 全量材料测试（可选）

如需测试全量 1446 chunks 效果，可上传到 DeepSeek 官网聊天：

```powershell
# 生成带机器符号的全量材料文件
python cot对比实验\generate-full-chunks-with-symbols.py

# 输出文件：full-chunks-with-symbols-Z1-Q1.txt (约 610 KB)
# 上传到 https://chat.deepseek.com 进行人工测试
```

详见 [`全量材料生成说明.md`](./全量材料生成说明.md)

## 实验组二（主流程）

直接复用根目录已有文件，不重新运行：

| 文件 | 说明 |
|------|------|
| `noun-recall-results.json` | 主流程名词召回结果 |
| `candidate-texts-for-llm.json` | 主流程推理输入（拓扑链筛选后） |
| `material-traceback-map.json` | 主流程溯源映射 |
| `multipath-prompt-<questionId>.txt` | 主流程多路径推理 Prompt |
| `reasoning-output-<questionId>.json` | 主流程推理输出 |

---

## 运行步骤

### 实验组一（CoT 直推）

```powershell
# 一键执行（默认取前 100 个 chunk）
node cot对比实验\run-full-cot-pipeline.js

# 单问题
node cot对比实验\run-full-cot-pipeline.js Z1-Q1

# 调整材料数量（取前 50 个 chunk）
COT_MAX_CHUNKS=50 node cot对比实验\run-full-cot-pipeline.js Z1-Q1
```

或分步执行：

```powershell
# 1. 构建推理输入（纯文表全量）
node cot对比实验\build-prompt-cot.js

# 2. 生成 Prompt
node cot对比实验\generate-multipath-prompt-cot.js Z1-Q1

# 3. 执行推理（CoT 开启）
node cot对比实验\run-reasoning-cot.js Z1-Q1
```

### 实验组二（主流程）

无需重新运行，直接使用根目录已有结果：

```powershell
# 查看主流程推理输出
cat reasoning-output-Z1-Q1.json
```

### 对比分析

```powershell
# 对比两组结果
node cot对比实验\compare-results.js
```

---

## 文件说明

| 文件 | 说明 |
|------|------|
| `build-prompt-cot.js` | 从纯文表构建推理输入（不经 noun recall） |
| `generate-multipath-prompt-cot.js` | 生成 CoT 版多路径推理 Prompt（MAX_CHUNKS 可配置，默认 100） |
| `run-reasoning-cot.js` | 运行 CoT 版推理（reasoning_effort=medium） |
| `run-full-cot-pipeline.js` | 一键执行实验组一完整流程 |
| `compare-results.js` | 对比实验组一与实验组二的推理结果 |
| `check-puretext-table.js` | 检查纯文表与主流程纯文表一致性 |
| `src-cot/llmClient-cot.js` | CoT 专用 LLM 客户端（reasoning_effort=medium） |
| `candidate-texts-for-llm-cot.json` | 实验组一推理输入（全量 1446 chunks） |
| `multipath-prompt-cot-Z1-Q1.txt` | 实验组一多路径推理 Prompt（前 100 chunks） |
| `reasoning-output-cot-Z1-Q1.json` | 实验组一推理输出 |
| `generate-full-chunks-with-symbols.py` | 生成全量材料文件（用于官网测试） |
| `full-chunks-with-symbols-Z1-Q1.txt` | 全量 1446 chunks 带机器符号（约 610 KB） |
| `全量材料生成说明.md` | 全量材料测试流程说明 |

---

## 关键差异总结

实验组一与主流程的唯一区别：

1. **材料规模不同**：
   - 实验组一：前 100 chunks（约 6.9% 全量材料，受 API 上下文限制）
   - 实验组二：拓扑链筛选后 10-30 chunks（高相关材料）
   
2. **CoT 开关不同**：`medium` vs `none`

3. **全量材料测试**：可通过官网聊天上传 1446 chunks 完整材料进行补充验证（不作为严格对比组）

---

*实验设计 ✅*
