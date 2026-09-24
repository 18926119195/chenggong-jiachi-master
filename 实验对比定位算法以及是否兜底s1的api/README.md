# 实验：对比定位算法以及是否兜底 s1 的 API

## 实验目的

验证是否需要为 s1 阶段的 non-high confidence 截断重新设计算法2/3兜底机制，或者重跑 API。

## 实验方法

1. **提取 s1 输出的 non-high 条目**（`extract-s1-nonhigh.js`）
   - 从 `s1-nouns-with-offsets.json` 中筛选出所有 `confidence !== 'high'` 的偏移量
   - 生成 383 条 non-high 条目

2. **追溯到原始 API 输入输出**（`batch-judge-groupB1.js` 等）
   - 从 `s1-drift-review/batch-*` 文件中解析：
     - `batch.prompt`：找到【【N】】标记后的截断文本（`promptTruncText`）
     - `batch.llmRawOutput`：找到【【N】】后的 LLM 原始输出（`llmOutputText`）
   - **核心**：直接解析 LLM 原始输出，不依赖 `parsedNouns` 做字符串匹配

3. **人工判断截断内容**（`final-human-judgment.js`）
   - 基于法语词性规则，判断 `promptTruncText` 中是否含有**应该被提取的名词**
   - 使用名词词库、非名词词库、词性规则进行自动化判断
   - 输出每条的判断结果：`有漏提取` / `无漏提取`

## 实验结果

### 总体统计

- **总数**：383 条 non-high 条目
- **无漏提取**：370 条（96.6%）—— prompt 输入截断中只有虚词、形容词、动词，没有名词
- **有漏提取**：13 条（3.4%）—— prompt 输入截断中含有明确的名词

### 有漏提取的批次分布

只有 **5 个批次**涉及真正的漏提取：

| 批次 | 漏提取条目数 |
|------|------------|
| 3    | 2          |
| 11   | 3          |
| 12   | 5          |
| 19   | 2          |
| 35   | 1          |

### 漏提取的名词示例

- `processus`、`créateurs`、`paramètre`
- `narcissisme`、`entités`、`devenir`
- `forme`、`temps`、`système`

## 结论

### ❌ 不需要算法定位2/3兜底

96.6% 的 non-high 条目都是正常的——**截断里根本就没有名词**，LLM 没有漏提取。

这些截断包含的内容：
- 虚词、代词、介词（`qui`, `que`, `de`, `le`, `la`）
- 形容词（`ancien`, `machinique`, `barbare`）
- 动词（`cherché`, `appréhender`, `finir`）
- 被截断的词头词尾（`pré-`, `-tion`）

### ❌ 不需要对这些 non-high 重跑 API

绝大多数都是正确的空结果，重跑不会提高召回率。

### ✅ 只有 13 条（3.4%）真的有漏提取

如果要修正，只需要重跑这 **5 个批次**（3, 11, 12, 19, 35），而不是全部 non-high。

## 生成的文件

### 数据文件

- `s1-nonhigh-offsets.json` - 383 条 non-high 偏移量原始数据
- `s1-nonhigh-with-batch-info.json` - 附加批次信息的 non-high 数据
- `s1-nonhigh-with-llm-raw.json` - 附加 API 原始输入输出的数据
- `s1-nonhigh-need-manual-final.json` - 待人工判断的数据
- `s1-nonhigh-human-judgment-final.json` - 人工判断完成的数据
- `s1-batches-with-missing-nouns.json` - 按批次统计的漏提取清单

### 报告文件

- `s1-nonhigh-summary.md` - 初步统计报告
- `s1-nonhigh-need-review-final.md` - 13 条可能漏提取的详细清单
- `s1-nonhigh-final-summary.md` - 完整判断总结

### 脚本文件

- `extract-s1-nonhigh.js` - 提取 non-high 偏移量
- `add-batch-info.js` - 附加批次信息
- `batch-judge-groupB1.js` - 解析批次原始输入输出（group B1）
- `batch-judge-remaining.js` - 解析剩余批次
- `final-human-judgment.js` - 人工判断截断内容

## 对正式流程的影响

### 清理内容

已从正式流程代码中删除：

1. **算法2/3 定位兜底逻辑**
   - 移除 ±N 字符扩窗搜索
   - 移除全 chunk 兜底搜索
   - 只保留在截断原始区间 `[truncStart, truncEnd)` 内的精确匹配

2. **Confidence 字段**
   - 移除 `offset.confidence` 字段（原值恒为 'high'）
   - 移除 `confidenceStats` 统计
   - 移除相关注释说明

3. **术语更新**
   - "三层兜底" → "三层解析策略"
   - "Tier 1/2/3" → "策略 1/2/3"
   - "兜底补缺" → "补缺"

### 保留内容

正式流程 `s1-llm-fill.js` 保持：

- 批量合并多截断到单个 LLM 请求
- 并行批处理（5并发）
- 三层解析策略（JSON、行式【【N】】、扫描【【N】】）
- 名词质量过滤规则
- s0 防污染去重
- 精确偏移量定位（仅在截断原始区间内）

## 实验时间

2026-09-21

## 实验者备注

本实验证明了当前 s1 流程的 precision-first 策略是正确的：宁可少提取，也不要误匹配到其他上下文的同名词。96.6% 的 non-high 都是截断里根本没有名词的正常情况，无需兜底算法。
