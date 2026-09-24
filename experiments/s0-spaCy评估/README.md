# s0 阶段 spaCy 抽取质量评估实验报告

**实验日期**: 2026-09-22  
**实验目标**: 评估 spaCy 法语模型（fr_core_news_sm）的名词抽取效果，验证是否需要停用词过滤

---

## 实验概述

| 项目 | 数值 |
|------|------|
| 语料 | Cartographies schizoanalytiques (Félix Guattari) |
| 总 chunks | 1,447 |
| 总字符数 | 579,363 |
| 抽取名词/短语 | 45,406 |
| 失败 chunks | 0 |

---

## 核心发现

### 1. 覆盖率分析

| 指标 | 数值 | 占比 |
|------|------|------|
| 命中字符 | 306,353 | 52.88% |
| 剩余文字符 | 198,488 | 34.26% |
| 纯虚词（已过滤） | ~74,522 | 12.86% |

**结论**: spaCy 覆盖了约 **53%** 的文本，剩余约 **47%** 需要 s1 阶段 LLM 补缺。

### 2. POS 分布

| POS 类型 | 数量 | 占比 | 说明 |
|----------|------|------|------|
| NOUN | 22,505 | 49.6% | 普通名词 |
| NP | 20,935 | 46.1% | 名词短语 |
| PROPN | 1,966 | 4.3% | 专有名词 |

### 3. 词长分布

| 长度 | 数量 | 占比 |
|------|------|------|
| 1-3 字符 | 1,742 | 3.8% |
| 4-6 字符 | 11,075 | 24.4% |
| 7-10 字符 | 16,373 | 36.1% |
| 11+ 字符 | 16,216 | 35.7% |

---

## 关于停用词过滤的结论

### ❌ 不需要额外停用词过滤

**理由**:

1. **spaCy POS 过滤已足够**
   - spaCy 只抽取 `NOUN`、`PROPN`、`NP`（名词短语）
   - 介词（de, à, pour, avec...）和虚词（le, la, les, et, ou...）的 POS 是 `ADP`、`DET`、`CCONJ` 等，不会被抽取

2. **抽样验证：0% 误抽**
   - 检查 50 个样本名词，**0 个**包含 stop words
   - 所有样本都是合法名词：`Cartographies`, `Guattari`, `pensée`, `sujet`, `subjectivité`...

3. **当前主流程的虚词过滤（isAllFunctionWords）是兜底机制**
   - 用于过滤剩余文中的纯虚词片段
   - 避免把无意义的虚词序列送入 LLM

### 剩余文的真实成分

| 片段类型 | 示例 | 占比 | 处理方式 |
|----------|------|------|----------|
| 动词片段 | `tenait`, `opposaient`, `dépendent` | ~40% | 送 LLM 判断 |
| 名词片段 | `rouages corporels`, `parler` | ~25% | 送 LLM 补缺 |
| 混合片段 | `nous conduit à reconnaître` | ~35% | 送 LLM 判断 |

---

## 样本示例

### 高质量名词（spaCy 抽取）

```
Cartographies schizoanalytiques [NP]
Felix Guattari [NP]
pensée [NOUN]
sujet [NOUN]
subjectivité [NOUN]
philosophie [NOUN]
multitude [NOUN]
systèmes [NOUN]
```

### 剩余文片段（需 LLM 补缺）

```
tenait - 动词
opposaient - 动词
dépendent - 动词
des rouages corporels - 包含名词
Comment peut-on parler - 包含动词性成分
```

---

## 结论与建议

### ✅ 保持当前策略

1. **不修改** `spaCy server.py` 中的 POS 过滤逻辑
2. **不添加** `is_stop` 过滤
3. **保持** `isAllFunctionWords` 兜底机制

### ✅ s1 阶段必要

- 约 **47%** 的文本未被 spaCy 覆盖
- 剩余文中包含动词片段和名词片段
- LLM 补缺是提升覆盖率的关键

### 📊 最终覆盖率预估

| 阶段 | 覆盖率 |
|------|--------|
| s0 (spaCy) | 52.88% |
| s1 (LLM 补缺) | +~20-30% |
| **合计** | **~75-85%** |

---

## 输出文件

| 文件 | 说明 |
|------|------|
| `s0-evaluation-report.json` | 完整统计数据 |
| `run-evaluation.js` | 评估脚本 |
| `analyze-stopwords.js` | 深度分析脚本 |
| `README.md` | 本报告 |

---

*实验完成 ✅*
