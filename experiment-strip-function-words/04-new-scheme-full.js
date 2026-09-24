/**
 * 实验4（新方案全量）：对 1471 条有产出的残文跑新方案（剔虚词）
 *
 * 对比基准：s1-nouns-with-offsets.json 里这 1471 条残文的原方案结果
 * 只跑新方案（剔虚词），对比同一批残文下的名词产量
 *
 * 并发策略：与主流程 s1-llm-fill.js 一致
 * - CONCURRENCY=5（5个并发）
 * - BATCH_SIZE=8（每批8条）
 * - MAX_PROMPT_TOKENS=2500（每批token上限）
 */

import fs from 'fs';
import { callLLM } from '../src/core/llmClient.js';

const STOPWORDS = new Set([
  'ou', 'et', 'de', 'des', 'le', 'la', 'les', 'un', 'une', 'du', 'au', 'aux',
  'qui', 'que', 'quoi', 'dont', 'où', 'quel', 'quelle', 'quels', 'quelles',
  'je', 'tu', 'il', 'elle', 'nous', 'vous', 'ils', 'elles', 'on',
  'me', 'te', 'se', 'lui', 'leur', 'leurs', 'moi', 'toi',
  'ce', 'cette', 'ces', 'cet', 'celui', 'celle', 'ceux', 'celles',
  'mon', 'ma', 'mes', 'ton', 'ta', 'tes', 'son', 'sa', 'ses',
  'notre', 'nos', 'votre', 'vos',
  'par', 'pour', 'dans', 'avec', 'sans', 'sous', 'sur', 'chez', 'vers', 'entre',
  'plus', 'moins', 'bien', 'mal', 'tout', 'très', 'pas', 'non', 'même', 'aussi',
  'encore', 'déjà', 'toujours', 'jamais', 'ici', 'là',
  'est', 'sont', 'être', 'avoir', 'a', 'ont', 'fait', 'font', 'dit', 'disent',
  'peut', 'peuvent', 'doit', 'doivent', 'va', 'vont', 'était', 'étaient',
  'mais', 'donc', 'or', 'ni', 'car', 'ainsi', 'alors', 'comme', 'puis',
  'cependant', 'pourtant', 'néanmoins', 'toutefois', 'lorsque', 'quand',
  'si', 'comment', 'pourquoi', 'partir',
  'cela', 'ceci', 'ça', 'rien', 'personne', 'quelque', 'quelques', "quelqu'un",
  'chaque', 'chacun', 'chacune', 'certains', 'certaines', 'certain', 'certaine',
  'autre', 'autres', 'tel', 'telle', 'tels', 'telles', 'seul', 'seule', 'seuls', 'seules',
  "d'un", "d'une", "d'autres", "d'autre", "qu'", "qu'il", "qu'elle",
  "l'autre", "l'un", "l'une", 'lui-même', 'elle-même', 'eux-mêmes',
  'possible', 'possibles', 'nécessaire', 'nécessaires', 'seconde', 'second',
  'etc', 'avant', 'après', 'depuis', 'pendant', 'durant',
  'of', 'the', 'a', 'an', 'and', 'or', 'to', 'in', 'on', 'at', 'by', 'for', 'with',
  'he', 'she', 'it', 'we', 'they', 'his', 'her', 'its', 'our', 'their',
  'is', 'are', 'was', 'were', 'be', 'been', 'have', 'has', 'had',
]);

function isFunctionWord(token) {
  const stripped = token.replace(/^[\p{P}\s]+|[\p{P}\s]+$/gu, '').toLowerCase();
  if (stripped.length === 0) return false;
  return STOPWORDS.has(stripped);
}

function stripFunctionWords(text) {
  const tokens = text.split(/(\s+|[,;:!?\.\(\)\[\]"«»'"])/);
  const kept = [];
  for (const tok of tokens) {
    if (/^\s+$/.test(tok)) {
      if (kept.length > 0 && !/^\s+$/.test(kept[kept.length - 1])) kept.push(' ');
    } else if (/^[,;:!?\.\(\)\[\]"«»'"]+$/.test(tok)) {
      continue;
    } else if (isFunctionWord(tok)) {
      continue;
    } else if (tok.length > 0) {
      kept.push(tok);
    }
  }
  return kept.join('').replace(/\s+/g, ' ').trim();
}

function buildBatchPrompt(truncations) {
  const sections = truncations.map((trunc, idx) => {
    return `【【${idx + 1}】】\n${trunc.text}`;
  }).join('\n');

  return `你是一个精确的语言学名词提取器。请从以下文本截断中提取**所有名词性成分**（名词、专有名词、名词短语）。

**要求**：
- 只提取名词及名词短语
- 不要提取纯动词、形容词、副词、连接词
- 保持原文形式（含重音符号、大小写）
- 用【【N】】引用截断编号

**输出格式**：
【【1】】名词1, 名词2
【【2】】名词3
（无名词时直接跳过该行，不要写 NONE 或留空）

**待处理截断**：

${sections}`;
}

function parseBatchLLMOutput(text) {
  const lines = text.split(/\r?\n/);
  const result = {};
  for (const line of lines) {
    const m = line.match(/【【(\d+)】】\s*(.+)/);
    if (!m) continue;
    const idx = parseInt(m[1], 10) - 1;
    const nouns = m[2].split(',').map(n => n.trim()).filter(Boolean);
    result[idx] = nouns;
  }
  return result;
}

const CHARS_PER_TOKEN = 3.5;
const MAX_PROMPT_TOKENS = 2500;
const CONCURRENCY = 5;
const BATCH_SIZE = 8;

function estimatePromptTokens(text) {
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

function splitIntoBatches(items) {
  const batches = [];
  let currentBatch = [];
  let currentTokens = 0;

  for (const item of items) {
    const itemTokens = estimatePromptTokens(buildBatchPrompt([item]));
    if (currentBatch.length > 0 &&
        (currentTokens + itemTokens > MAX_PROMPT_TOKENS || currentBatch.length >= BATCH_SIZE)) {
      batches.push({ items: currentBatch, tokens: currentTokens });
      currentBatch = [];
      currentTokens = 0;
    }
    currentBatch.push(item);
    currentTokens += itemTokens;
  }
  if (currentBatch.length > 0) {
    batches.push({ items: currentBatch, tokens: currentTokens });
  }
  return batches;
}

// ---------- 加载数据 ----------
const s0report = JSON.parse(fs.readFileSync(
  'C:\\Users\\Administrator\\Desktop\\2026-09-21-master\\s0-quality-report.json', 'utf-8'));

const s1data = JSON.parse(fs.readFileSync(
  'C:\\Users\\Administrator\\Desktop\\2026-09-21-master\\s1-nouns-with-offsets.json', 'utf-8'));

// 建立残文索引：chunkKey-start → 残文
const residualMap = new Map();
for (const r of s0report.residuals) {
  residualMap.set(`${r.chunkKey}-${r.start}`, r);
}

// 建立原方案输出索引：truncId → [noun surfaces]
const origOutput = new Map();
for (const noun of s1data.nouns) {
  for (const tid of noun.sourceTruncIds || []) {
    if (!origOutput.has(tid)) origOutput.set(tid, []);
    origOutput.get(tid).push(noun.surface);
  }
}

// 找出在 s1 里有过产出的 1471 条残文
const prolificResiduals = [];
const seen = new Set();
for (const [tid, nouns] of origOutput) {
  if (seen.has(tid)) continue;
  seen.add(tid);
  const residual = residualMap.get(tid);
  if (!residual) continue;
  prolificResiduals.push({ residual, tid, origNouns: nouns });
}

console.log(`========== 实验4（新方案全量 1471 条）==========\n`);
console.log(`原方案有产出的残文数: ${prolificResiduals.length}`);

// 构建新方案输入（剔虚词）
const strippedItems = [];
for (const item of prolificResiduals) {
  const cleaned = stripFunctionWords(item.residual.text);
  if (cleaned.length > 0) {
    strippedItems.push({
      tid: item.tid,
      origResidual: item.residual,
      origNouns: item.origNouns,
      cleanedText: cleaned,
    });
  } else {
    // 剔完为空：归为"无效"，新方案无输出
    strippedItems.push({
      tid: item.tid,
      origResidual: item.residual,
      origNouns: item.origNouns,
      cleanedText: '',
      invalid: true,
    });
  }
}

const validItems = strippedItems.filter(i => !i.invalid);
console.log(`有效残文（剔后非空）: ${validItems.length}`);
console.log(`无效残文（剔后为空）: ${strippedItems.length - validItems.length}`);
console.log(`预计批次数: ${Math.ceil(validItems.length / BATCH_SIZE)}`);
console.log(`预计 LLM 并发组数: ~${Math.ceil(Math.ceil(validItems.length / BATCH_SIZE) / CONCURRENCY)}`);

// 分批
const batches = splitIntoBatches(validItems);
console.log(`\n--- 开始 LLM 调用（${batches.length} 批次，并发${CONCURRENCY}）---\n`);

const startTime = Date.now();
let totalPromptTokens = 0;
let totalCompletionTokens = 0;
const newResults = new Map(); // tid → [noun surfaces]

async function runBatches() {
  for (let i = 0; i < batches.length; i += CONCURRENCY) {
    const group = batches.slice(i, i + CONCURRENCY);
    const promises = group.map(async (batch) => {
      const prompt = buildBatchPrompt(batch.items.map(it => ({ text: it.cleanedText })));
      const res = await callLLM(prompt, { temperature: 0 });
      if (!res) {
        console.error(`  Batch ${i} 调用失败`);
        return null;
      }
      totalPromptTokens += res.usage.prompt_tokens;
      totalCompletionTokens += res.usage.completion_tokens;
      const parsed = parseBatchLLMOutput(res.text);
      for (let j = 0; j < batch.items.length; j++) {
        newResults.set(batch.items[j].tid, parsed[j] || []);
      }
      return res;
    });

    const results = await Promise.all(promises);
    const done = Math.min(i + CONCURRENCY, batches.length);
    process.stdout.write(`  进度: ${done}/${batches.length} 批次完成 (${validItems.length} 条残文)\r`);

    // 批次间小延迟
    if (i + CONCURRENCY < batches.length) {
      await new Promise(r => setTimeout(r, 200));
    }
  }
}

await runBatches();
const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
console.log(`\n\n--- LLM 调用完成（耗时 ${elapsed}s）---`);
console.log(`总 token: prompt=${totalPromptTokens}, completion=${totalCompletionTokens}, total=${totalPromptTokens + totalCompletionTokens}`);

// ========== 对比统计 ==========
let origTotal = 0, newTotal = 0;
let origStopword = 0, newStopword = 0;
const origStopwordSet = new Set();
const newStopwordSet = new Set();
const origRealSet = new Set();
const newRealSet = new Set();
const bothSet = new Set();
const onlyOrigSet = new Set();
const onlyNewSet = new Set();

for (const item of strippedItems) {
  const orig = item.origNouns || [];
  const newer = item.invalid ? [] : (newResults.get(item.tid) || []);

  origTotal += orig.length;
  newTotal += newer.length;

  for (const n of orig) {
    const lower = n.toLowerCase();
    if (STOPWORDS.has(lower)) {
      origStopword++;
      origStopwordSet.add(lower);
    } else {
      origRealSet.add(lower);
    }
  }
  for (const n of newer) {
    const lower = n.toLowerCase();
    if (STOPWORDS.has(lower)) {
      newStopword++;
      newStopwordSet.add(lower);
    } else {
      newRealSet.add(lower);
    }
  }
}

// 真名词差异
for (const n of origRealSet) {
  if (newRealSet.has(n)) bothSet.add(n);
  else onlyOrigSet.add(n);
}
for (const n of newRealSet) {
  if (!origRealSet.has(n)) onlyNewSet.add(n);
}

console.log(`\n========== 同一批 ${prolificResiduals.length} 条残文的对比结果 ==========\n`);
console.log(`| 指标           | 原方案（真实） | 新方案（剔虚词） |`);
console.log(`|----------------|---------------|-----------------|`);
console.log(`| 总提取         | ${origTotal}             | ${newTotal}             |`);
console.log(`| 虚词污染       | ${origStopword}             | ${newStopword}             |`);
console.log(`| 真名词唯一数   | ${origRealSet.size}            | ${newRealSet.size}            |`);
console.log(`| 双方都识别     | ${bothSet.size}            |                 |`);
console.log(`| 原独有/新缺失  | ${onlyOrigSet.size}            |                 |`);
console.log(`| 新独有/原缺失  | ${onlyNewSet.size}            |                 |`);
console.log(`| 无效残文       | —             | ${strippedItems.length - validItems.length}             |`);

console.log(`\n--- 漏出的虚词 ---`);
if (origStopwordSet.size > 0) console.log(`  原方案: [${[...origStopwordSet].join(', ')}]`);
if (newStopwordSet.size > 0) console.log(`  新方案: [${[...newStopwordSet].join(', ')}]`);

console.log(`\n--- 原独有真名词（前20个）---`);
console.log(`  [${[...onlyOrigSet].slice(0, 20).join(', ')}]`);
console.log(`\n--- 新独有真名词（前20个）---`);
console.log(`  [${[...onlyNewSet].slice(0, 20).join(', ')}]`);

// 持久化
fs.writeFileSync(
  'C:\\Users\\Administrator\\Desktop\\2026-09-21-master\\experiment-strip-function-words\\04-new-scheme-full.json',
  JSON.stringify({
    totalResiduals: prolificResiduals.length,
    validResiduals: validItems.length,
    invalidResiduals: strippedItems.length - validItems.length,
    elapsedSeconds: parseFloat(elapsed),
    tokens: { prompt: totalPromptTokens, completion: totalCompletionTokens, total: totalPromptTokens + totalCompletionTokens },
    comparison: {
      orig: { total: origTotal, stopwords: origStopword, realNounUnique: origRealSet.size, stopwordTypes: [...origStopwordSet] },
      new: { total: newTotal, stopwords: newStopword, realNounUnique: newRealSet.size, stopwordTypes: [...newStopwordSet] },
    },
    diff: {
      both: [...bothSet],
      onlyOrig: [...onlyOrigSet],
      onlyNew: [...onlyNewSet],
    },
  }, null, 2),
);

console.log(`\n✓ 结果已保存: experiment-strip-function-words/04-new-scheme-full.json`);
