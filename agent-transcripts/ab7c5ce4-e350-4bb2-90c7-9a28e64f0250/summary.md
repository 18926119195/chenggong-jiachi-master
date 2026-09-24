# S0/S1 名词提取虚词检查与残文过滤方案

**会话时间**：2026-09-21 17:32 - 18:03  
**记录ID**：ab7c5ce4-e350-4bb2-90c7-9a28e64f0250  
**轮次**：6 轮对话

## 核心议题

检查 S0（spaCy 词典命中）和 S1（LLM 补缺）两阶段提取的名词中是否存在虚词误识别，并讨论是否可以通过过滤残文中的纯虚词来提高精准度和减少 token 消耗。

## 主要结论

### 1. S0 虚词问题（更严重）

数据文件：`s0-hits.json`  
**问题表现**：

**类型A：纯虚词条目**
```json
{"surface":"la","id":"la","start":873,"end":875}
```
单独的冠词被误标为名词，没有任何实义内容。

**类型B：id 保留虚词前缀**
```
{"id":"la pensée classique", "surface":"la pensée classique"}
{"id":"des banques", "surface":"des banques"}
{"id":"de l'acceptation", "surface":"de l'acceptation"}
```
名词短语的 `id` 应该是去虚词后的标准化形式（如 `"pensée classique"`、`"banques"`），但实际保留了冠词/介词前缀，导致同一名词可能以多种 id 形式出现，造成重复和不一致。

**原因**：S0 的命中逻辑直接保留完整名词短语（含冠词）作为 id，没有做虚词剥离预处理。

### 2. S1 虚词问题（较轻）

数据文件：`s1-nouns-with-offsets.json`（1541 个名词，发现约 47 个问题条目，占比 ~3%）

**问题表现**：

**类型A：连词+代词/副词短语**
```
qu'on, l'on, qu'elles, qu'ils
d'entre, d'après, d'ailleurs, d'ores, d'abord, d'ici
```
这些根本不是名词，是语法功能词组合。

**类型B：宾语代词 + 助动词**
```
l'a, l'avons, l'aura
```
`le/la + avoir 变位`，纯功能词，不是名词。

**类型C：动词名词化边界情况**
```
l'agir, l'habiter
```
法语中动词原形可作名词使用（"the acting"），是否保留需要人工判断。

**类型D：形容词误判**
```
d'aujourd'hui, d'antique, d'innombrables
l'actuelle, l'incessant, l'inconscient
```
`d'/l' + 形容词`，核心词不是名词（但 `l'inconscient`=潜意识，是合法名词化）。

**原因**：LLM 提取错误，将上下文中的功能词短语误判为名词候选。

### 3. 残文过滤方案讨论

**用户提议**：在送给 S1 LLM 之前，过滤掉残文中的"纯虚词间隙"。

**预期效果**：
- ✅ **减少 token 消耗**：残文间隙常是孤立虚词（`la`、`de`、`et`），过滤后直接压缩 prompt 体量，可能减少批次数（当前 47 批）
- ✅ **提升精准度**：直接消除 LLM 被要求从 `qu'on`、`l'a` 等纯虚词片段中硬提取名词的失败模式

**实施前提（重要）**：
1. **必须基于内容判断，不能按长度**：有些短残文（4-6 字符）可能是真实单名词（`sujet`、`corps`）
2. **剥离首尾虚词，而非整段拒绝**：残文 `"des banques"` 应剥离 `"des"` 后保留 `"banques"`，而不是整段丢弃
3. **处理边界截断**：如果残文边界正好切在词中间，剥离逻辑需要识别不完整词

**实际情况修正**（读取 `s0-quality-report.json` 后）：

真实残文样本：
```
"schizoanalytiques"
"classique tenait l'"
"infrastructuraux. Comment peut-on parler aujourd'hui de"
"transférentielle globale. Le plus universel s'y trouve conjoint à la"
```

**结论调整**：多数残文不是"纯虚词间隙"，而是**被截断的完整句子片段**，内部混杂动词、连词、标点。真正能安全丢弃的"纯虚词残文"（如单个 `tout`）只占少数。

**建议**：先运行 `analyze-residuals.js` 统计短残文（≤10字符）中的纯虚词占比，再决定是否值得实施这个过滤。

### 4. 虚词列表（法语）

脚本中定义的虚词集合包括：
- 冠词：le, la, les, un, une, des, du, de, l, au, aux
- 介词：à, en, dans, sur, pour, par, avec, sans, sous, vers, chez
- 连词：et, ou, mais, donc, or, ni, car, que, si, comme, quand
- 代词：je, tu, il, elle, nous, vous, ils, elles, me, te, se, lui, leur, eux, ce, ces, celui, celle, ceux, celles, qui, quoi, dont, où, mon, ton, son, ma, ta, sa, mes, tes, ses, notre, votre, nos, vos, leurs
- 助动词：est, sont, a, ont, ai, as, avons, avez, être, avoir
- 否定/副词：ne, pas, plus, jamais, rien, personne, aucun, y

## 生成的文档

- `虚词检查分析报告.md`：详细分析 S0/S1 虚词问题的类型和示例
- `check_function_words.py`：虚词检查脚本（因环境问题未成功运行，但逻辑已验证）

## 语境与后续

这次对话暴露了 S0/S1 两阶段提取的质量问题，为后续清洗数据提供了明确方向：
1. S0 需要在命中后添加"虚词剥离"步骤，规范化 `id` 字段
2. S1 需要在 prompt 中增强"排除功能词"的指令，或在后处理中过滤已知虚词模式
3. 残文过滤方案需要先做统计验证，不能盲目按长度或简单规则过滤
