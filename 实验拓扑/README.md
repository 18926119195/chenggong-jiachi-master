# 拓扑链窗口对比实验

本文件夹用于拓扑链优化实验，对比不同 `TOPOLOGY_WINDOW` 参数下的召回效果。

## 实验脚本

### `compare-topology-window.js`
对比 TOPOLOGY_WINDOW=1 vs 2 的召回结果

**特点：**
- 不调用 API，基于已有的 `noun-recall-results.json` 打分数据
- 使用相同的高分词（score ≥ 80，前 80 个），只改变拓扑链窗口参数
- 统计去重后召回的 chunk 数量和总字符数
- 输出详细对比报告到 `window-comparison-report.json`

**用法：**
```bash
cd C:\Users\Administrator\Desktop\2026-09-21-master
node 实验拓扑/compare-topology-window.js
```

**输出：**
- `window-comparison-report.json`：详细对比报告
  - 每个问题的两种窗口下的召回结果
  - 召回的 chunk 列表（chunkKey、页码、字符数）
  - 字符数和 chunk 数的差异统计

## 数据结构

### 输入数据
- `noun-recall-results.json`：LLM 打分结果（来自 `recall-nouns-llm.js`）
- `final-noun-index.json`：终词表（名词索引，含所有出现位置）
- `docuverse_...json`：原文 chunk 数据

### 输出报告结构
```json
[
  {
    "questionId": "Z1-Q1",
    "question": "Pierre Janet和Freud对无意识的观点有何不同？",
    "highScoredNounCount": 10,
    "highScoredNouns": [...],
    "windowResults": {
      "window_1": {
        "windowSize": 1,
        "chainCount": 85,
        "mergedIntervalCount": 42,
        "recalledChunkCount": 38,
        "totalCharacters": 45230,
        "avgCharactersPerChunk": 1190,
        "recalledChunks": [...]
      },
      "window_2": {
        "windowSize": 2,
        "chainCount": 120,
        "mergedIntervalCount": 56,
        "recalledChunkCount": 48,
        "totalCharacters": 58760,
        "avgCharactersPerChunk": 1224,
        "recalledChunks": [...]
      }
    },
    "difference": {
      "characterDiff": 13530,
      "characterDiffPercent": 29.9,
      "chunkDiff": 10,
      "chunkDiffPercent": 26.3
    }
  }
]
```

## 人工评估流程

1. **运行实验脚本**，生成对比报告
2. **读取报告**，对每个问题查看：
   - 窗口=1 召回的 chunk 列表（`window_1.recalledChunks`）
   - 窗口=2 召回的 chunk 列表（`window_2.recalledChunks`）
3. **人工评估**：根据问题和预期答案，判断哪个窗口召回的内容更精准
   - 是否包含关键信息？
   - 是否引入过多噪音？
   - 字符数增加是否带来质量提升？
4. **记录结论**：窗口±1 vs ±2 哪个更好

## 实验参数

当前固定参数（与 `recall-nouns-llm.js` 保持一致）：
- `SCORE_THRESHOLD = 80`：分数阈值
- `TOP_N_NOUNS = 80`：用于构建拓扑链的高分词数量
- 对比窗口：1 vs 2（前后各取多少个名词）

## 后续扩展

如需对比更多窗口组合（如 1 vs 3 vs 5），修改 `compare-topology-window.js` 第 15 行：
```javascript
const WINDOWS_TO_COMPARE = [1, 2, 3, 5]; // 添加更多窗口值
```
