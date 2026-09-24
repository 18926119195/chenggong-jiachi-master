# 变更日志 2026-09-21 (16:22 → 18:10)

## 核心功能增强

### 1. 拓扑链召回引擎优化 (`recall-nouns-llm.js`)

**背景**：
- 原版本每个高分词独立召回，导致重复区间、碎片化严重
- `recalledTexts` 缺少溯源字段（页码、区间边界）

**本轮改进**：
- **拓扑链合并**：对同 `chunkKey` 内的所有召回区间按起点排序，重叠/相邻区间自动合并
- **五字段输出**：每条 `recalledTexts` 现在包含完整溯源信息
  ```json
  {
    "chunkKey": "h1._Ngh7XI...",
    "page": 30,
    "chainStart": 50,
    "chainEnd": 92,
    "text": "..."
  }
  ```
- **去重策略**：
  - 合并前：基于原始 LLM 输出的 `{chunkKey, start, end}` 三元组去重
  - 合并后：按 `{chunkKey, chainStart, chainEnd}` 三元组全局去重
- **新增字段**：
  - `mergedTopologyIntervals`：记录每个 `chunkKey` 的合并区间数组
  - `highScoredNouns`：保留触发召回的高分词列表（含词、得分、命中数）

**测试数据集**：
- 15 个问题全部重新跑完（18:05:54 完成）
- 召回材料数：5 至 428 不等（Z4-Q1 最多）
- 文件大小：2.85 MB（比旧版 8.79 MB 小，因为去重更彻底）

---

### 2. 多轮推理 LLM 脚本 (`reasoning-multi-path.js`)

**功能**：
基于拓扑链合并后的召回材料，驱动 LLM 进行多路径推理

**机器符码协议**（与现有脚本一致）：
- `【【N】】` 表示 `recalledTexts[N-1]`（1-based 编号）
- 每个问题独立编号，不跨问题复用
- LLM 输出中引用 `【【3】】【【5】】` 等会被自动解析并映射回 `chunkKey`/页码/区间

**Prompt 结构**：
```
问题：{question}

材料：

【【1】】
{recalledTexts[0].text}

【【2】】
{recalledTexts[1].text}

...

---

要求：输出 2-4 条独立推理路径，每条路径包含多个步骤，每步可引用一个或多个材料【【N】】。

格式：

# 路径一：[标题]

步骤1：使用【【X】】，提取...
步骤2：综合【【Y】】【【Z】】，对比...

结论：[此路径结论]

**引用规范**：
- 单个材料：使用【【N】】，提取...，判断...
- 多个材料：综合【【N】】【【M】】，对比/交叉验证/综合提取...

**推理策略**：
- 对比论证：对比不同材料中的矛盾或差异
- 交叉验证：从多个材料中找到互相支撑的证据
- 综合支撑：从多处提取一致的特征或模式
```

**输出解析**：
- 提取路径标题、步骤、结论
- 每步骤中提取所有 `【【N】】` 引用，映射回 `chunkKey`/`page`/`chainStart`/`chainEnd`
- 保存到 `reasoning-results.json`（包含原始 LLM 输出、token 统计、耗时）

**用法**：
```bash
# 处理所有问题
node reasoning-multi-path.js

# 指定问题
node reasoning-multi-path.js Z1-Q1 Z1-Q2

# 自定义输出路径
OUTPUT_PATH=reasoning-custom.json node reasoning-multi-path.js
```

---

## 辅助修改

### 3. `s1-llm-fill.js` / `llmClient.js` 微调
- 日志格式统一
- 错误处理增强

### 4. 实验脚本更新
- `实验对比定位算法以及是否兜底s1的api/s1-llm-fill-group1.js`
- `实验对比定位算法以及是否兜底s1的api/s1-llm-fill-group2.js`
- 与主流程脚本同步 LLM client 调用逻辑

---

## 数据文件清理

**删除**：
- `noun-recall-results.OLD.json.bak`（旧版数据集，字段不完整）
- `output.txt`、`check_function_words.py`、`check_fw.py`（临时测试文件）

**保留**：
- `noun-recall-results.json`（最新完整数据集，2.85 MB）
- `final-noun-index.json`（输入词表，13 MB，未修改）

---

## 新增文档

- `RECALL_REPORT.md`：本轮召回结果报告（15 个问题的统计摘要）
- `虚词检查分析报告.md`：虚词过滤验证结果
- 本文件：`CHANGELOG-2026-09-21.md`

---

## 下一步计划

1. DeepSeek API 充值后运行 `reasoning-multi-path.js`，验证多路径推理输出质量
2. 基于 `reasoning-results.json` 构建高亮溯源 UI（从 `citedChunks` 字段获取页码和区间）
3. 评估拓扑链合并对召回质量的影响（是否减少冗余、是否遗漏关键上下文）
