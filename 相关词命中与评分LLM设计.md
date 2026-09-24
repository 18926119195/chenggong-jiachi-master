# 相关词命中与评分 LLM Prompt 设计

## 背景

现在已完成：
- **s0 (spaCy) + s1 (LLM)** 合并去重：19,308 个名词，39,460 个位置
- 每个名词保留了全部出现位置（chunkKey + start/end + page）

下一步目标：
1. **相关词命中**：用户输入一个查询词（如 "machine"），找出语料中所有与之相关的名词
2. **评分排序**：对命中的名词按相关度打分，排序后返回 top-K

---

## 一、相关词命中 LLM Prompt

### 设计思路

**输入**：
- 用户查询词（query）
- 候选名词列表（从 `final-noun-index.json` 中提取所有 19,308 个名词的 `surface`）

**输出**：
- 与查询词相关的名词列表（JSON 数组）

**策略**：
- 批量调用（每次送 500-1000 个候选词，避免 token 超限）
- LLM 返回 JSON 格式：`["词1", "词2", ...]`
- 相关性定义：语义相关、主题相关、共现关系、上下位关系等

### Prompt 模板

```markdown
# 任务：相关词命中

你是一个专业的语义分析助手。用户正在研究法语学术文本《Cartographies schizoanalytiques》（Félix Guattari 著）。

## 查询词
{query}

## 候选名词列表
以下是从该文本中提取的名词（按出现频次降序）：

{candidate_nouns}

## 你的任务
从候选名词列表中，找出所有与查询词**语义相关、主题相关或在文本中有共现关系**的名词。

### 相关性判断标准
1. **语义相关**：同义词、近义词、反义词（如 "machine" 与 "dispositif"、"appareil"）
2. **上下位关系**：上位词、下位词、整体-部分（如 "machine" 与 "machine abstraite"、"machine désirante"）
3. **主题相关**：在同一概念域内（如 "machine" 与 "agencement"、"assemblage"、"flux"）
4. **共现关系**：在文本中频繁一起出现的概念（如 "machine" 与 "désir"、"territorialisation"）
5. **术语组合**：包含查询词的复合名词（如查询 "machine"，匹配 "machine abstraite"、"machine de guerre"）

### 输出格式
返回一个 JSON 数组，只包含相关名词的表面形式（surface），不要返回解释或得分。

```json
["词1", "词2", "词3", ...]
```

### 注意事项
- 只返回候选列表中存在的名词（不要编造）
- 如果某个名词与查询词完全无关，不要包含
- 如果查询词本身在候选列表中，也要包含它
- 不要返回虚词、介词、冠词（de, la, le, en 等）
- 优先返回高频词（列表前部的词更重要）

开始输出 JSON 数组：
```

### 使用示例

**输入**：
```javascript
const query = "machine";
const candidates = [
  "flux", "Univers", "référence", "fonction", "Agencements", 
  "subjectivité", "processus", "Phylum", "machine abstraite",
  "machine de guerre", "dispositif", "agencement", "désir",
  // ... 省略其余候选词
];
```

**LLM 输出**（预期）：
```json
[
  "machine abstraite",
  "machine de guerre",
  "dispositif",
  "agencement",
  "Agencements",
  "assemblage",
  "flux",
  "désir",
  "Phylum",
  "processus",
  "territorialisation",
  "déterritorialisation"
]
```

### 批量处理策略

由于候选词有 19,308 个，需要分批处理：

```javascript
const BATCH_SIZE = 500; // 每批 500 个候选词
const allRelated = new Set();

for (let i = 0; i < candidates.length; i += BATCH_SIZE) {
  const batch = candidates.slice(i, i + BATCH_SIZE);
  const prompt = buildPrompt(query, batch);
  const result = await callLLM(prompt);
  const related = JSON.parse(result);
  related.forEach(word => allRelated.add(word));
}
```

**优化**：可以先用出现频次过滤，只把 top 5000-10000 高频词送给 LLM，降低成本。

---

## 二、评分 LLM Prompt

### 设计思路

**输入**：
- 用户查询词（query）
- 相关词列表（从上一步获得，通常 50-500 个词）
- 每个词的上下文片段（从 `final-noun-index.json` 的 `offsets` 提取前 3-5 处出现的文本）

**输出**：
- 每个词的相关度评分（0.0-1.0 或 1-10 分）
- 排序后的名词列表

**策略**：
- 给 LLM 提供**真实上下文**，而不是仅凭名词表面形式打分
- 上下文帮助 LLM 理解该词在文本中的实际语义（消歧义）
- 批量评分（每次 20-50 个词 + 上下文），返回 JSON 格式

### Prompt 模板

```markdown
# 任务：相关词评分

你是一个专业的语义分析助手。用户正在研究法语学术文本《Cartographies schizoanalytiques》（Félix Guattari 著）。

## 查询词
{query}

## 待评分名词列表
以下是与查询词可能相关的名词，每个名词后面提供了它在文本中的 2-3 处真实出现上下文（前后各 50 字符）。

{scored_candidates_with_context}

示例格式：
```
1. dispositif (出现 85 次)
   上下文 1: "...le dispositif machinique permet de..."
   上下文 2: "...entre le dispositif et l'agencement..."
   
2. agencement (出现 123 次)
   上下文 1: "...les Agencements collectifs d'énonciation..."
   上下文 2: "...un agencement de désir qui traverse..."
```

## 你的任务
根据上下文和名词语义，为每个名词打分（1-10 分），评估它与查询词"{query}"的相关度。

### 评分标准（1-10 分）
- **9-10 分**：核心相关（同义词、直接上下位关系、术语变体）
- **7-8 分**：强相关（主题紧密、频繁共现、概念域重叠）
- **5-6 分**：中等相关（有关联但不在核心概念域，偶尔共现）
- **3-4 分**：弱相关（间接关联、边缘概念）
- **1-2 分**：几乎无关（误判或仅有表面相似）

### 评分依据
1. **上下文语义**：该词在文本中的实际用法是否与查询词相关
2. **共现频率**：两词是否在同一段落/句子中频繁出现（通过上下文推断）
3. **概念距离**：在 Guattari 的理论框架中，两个概念的距离
4. **术语关系**：是否存在术语组合关系（如 "machine" → "machine abstraite"）

### 输出格式
返回一个 JSON 数组，每个元素包含名词、得分和简短理由（10 字以内）。

```json
[
  {"noun": "machine abstraite", "score": 10, "reason": "术语变体"},
  {"noun": "dispositif", "score": 8, "reason": "近义概念"},
  {"noun": "agencement", "score": 7, "reason": "核心共现"},
  ...
]
```

### 注意事项
- 严格基于提供的上下文打分，不要凭空推测
- 如果上下文显示该词与查询词无关，给低分（1-3 分）
- 如果名词是查询词的复合形式（包含查询词），通常给高分（8-10 分）
- 理由用法语或英语，简洁明了

开始输出 JSON 数组：
```

### 使用示例

**输入**：
```javascript
const query = "machine";
const relatedNouns = [
  { surface: "machine abstraite", occurrences: 45 },
  { surface: "dispositif", occurrences: 85 },
  { surface: "agencement", occurrences: 123 },
  // ...
];

// 为每个词提取 2-3 处上下文（从 final-noun-index.json 的 offsets 定位到纯文表）
const contextsMap = await extractContexts(relatedNouns, pureTextTable);

const prompt = buildScoringPrompt(query, relatedNouns, contextsMap);
```

**LLM 输出**（预期）：
```json
[
  {"noun": "machine abstraite", "score": 10, "reason": "术语变体"},
  {"noun": "machine de guerre", "score": 10, "reason": "术语变体"},
  {"noun": "dispositif", "score": 8, "reason": "近义概念"},
  {"noun": "agencement", "score": 7, "reason": "核心共现"},
  {"noun": "Agencements", "score": 7, "reason": "同上"},
  {"noun": "flux", "score": 6, "reason": "主题相关"},
  {"noun": "désir", "score": 6, "reason": "频繁共现"},
  {"noun": "Phylum", "score": 5, "reason": "间接关联"}
]
```

---

## 三、实现流程建议

### 完整 Pipeline

```javascript
// 1. 加载名词索引
const nounIndex = JSON.parse(fs.readFileSync('final-noun-index.json', 'utf-8'));
const allNouns = nounIndex.nouns; // 19,308 个

// 2. 相关词命中（批量调用 LLM）
const query = "machine"; // 用户输入
const relatedNouns = await findRelatedNouns(query, allNouns);
// 返回 50-500 个相关名词

// 3. 提取上下文
const contextsMap = await extractContexts(relatedNouns, pureTextTable);
// 为每个相关词提取 2-3 处真实上下文

// 4. 评分排序（批量调用 LLM）
const scoredNouns = await scoreNouns(query, relatedNouns, contextsMap);
// 返回带评分的名词列表

// 5. 排序输出
scoredNouns.sort((a, b) => b.score - a.score);
console.log('Top 20 相关名词:');
scoredNouns.slice(0, 20).forEach((item, i) => {
  console.log(`${i + 1}. ${item.noun} (${item.score}/10) - ${item.reason}`);
});
```

### 上下文提取函数

```javascript
async function extractContexts(relatedNouns, pureTextTable) {
  const contextsMap = new Map();
  const chunkMap = new Map(pureTextTable.entries.map(e => [e.chunkKey, e.text]));
  
  for (const nounEntry of relatedNouns) {
    const contexts = [];
    const offsets = nounEntry.offsets.slice(0, 3); // 只取前 3 处
    
    for (const off of offsets) {
      const chunkText = chunkMap.get(off.chunkKey);
      if (!chunkText) continue;
      
      const start = Math.max(0, off.start - 50);
      const end = Math.min(chunkText.length, off.end + 50);
      const snippet = chunkText.slice(start, end);
      contexts.push(snippet);
    }
    
    contextsMap.set(nounEntry.surface, contexts);
  }
  
  return contextsMap;
}
```

---

## 四、模型与参数建议

### 相关词命中阶段
- **模型**：`deepseek-chat` 或 `gpt-4o-mini`（需要语义理解，但不需要深度推理）
- **temperature**：`0.3`（稍微保守，避免幻觉编造名词）
- **max_tokens**：`2000`（返回 JSON 数组，通常 500-1000 tokens 足够）

### 评分阶段
- **模型**：`deepseek-chat` 或 `gpt-4o`（需要结合上下文做细粒度判断）
- **temperature**：`0.1`（非常保守，确保评分稳定可复现）
- **max_tokens**：`3000`（返回带理由的 JSON，每个词 ~30 tokens）

---

## 五、成本与性能优化

### 1. 候选词预筛选
在送给 LLM 之前，用规则预筛选：
- 只保留 top 5000 高频词（出现次数 ≥ 3）
- 过滤明显无关的词（用简单的字符串匹配/编辑距离）

### 2. 分层评分
- **第一轮**：粗筛（不带上下文，只用名词表面形式），快速过滤到 top 200
- **第二轮**：精排（带上下文），对 top 200 做细粒度评分

### 3. 缓存机制
- 对高频查询词（如 "machine"、"désir"、"flux"）缓存相关词和评分结果
- 避免重复调用 LLM

---

## 六、输出格式示例

用户查询：`"machine"`

最终输出：

```json
{
  "query": "machine",
  "totalRelated": 87,
  "topResults": [
    {
      "rank": 1,
      "noun": "machine abstraite",
      "score": 10.0,
      "reason": "术语变体",
      "occurrences": 45,
      "sampleContext": "...le concept de machine abstraite permet de..."
    },
    {
      "rank": 2,
      "noun": "machine de guerre",
      "score": 10.0,
      "reason": "术语变体",
      "occurrences": 38,
      "sampleContext": "...la machine de guerre nomade s'oppose à..."
    },
    {
      "rank": 3,
      "noun": "dispositif",
      "score": 8.5,
      "reason": "近义概念",
      "occurrences": 85,
      "sampleContext": "...entre le dispositif et l'agencement machinique..."
    },
    // ... 更多结果
  ]
}
```

---

## 总结

✅ **相关词命中**：批量调用 LLM，从 19,308 个名词中筛选出与查询词相关的 50-500 个候选词

✅ **评分排序**：结合真实上下文，对候选词打分（1-10 分），按相关度排序

✅ **上下文增强**：从 `final-noun-index.json` 的 `offsets` 定位到纯文表，提取真实语境，避免歧义

✅ **性能优化**：预筛选、分层评分、缓存机制，降低 LLM 调用成本

现在可以基于 `final-noun-index.json` 开始实现这两个 LLM 流程。
