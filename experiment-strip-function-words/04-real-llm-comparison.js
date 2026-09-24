/**
 * 实验4（重构版）：只跑新方案的 LLM，与原方案的真实数据对比
 *
 * 关键洞察：原方案数据已经在 s1-nouns-with-offsets.json 里（过去跑过的全量结果）
 * 所以本实验只需要：
 *   1. 从 12123 条残文里抽样 80 条
 *   2. 把抽样的残文剔虚词后送给 LLM（新方案）
 *   3. 通过 chunkKey + start 关联回原方案的 s1 数据（不需要重跑原方案）
 *   4. 对比同一批残文在两种方案下的 LLM 输出
 *
 * 输出：experiment-strip-function-words/04-real-llm-comparison.json
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

// 读取 s0-quality-report 里的所有残文
const s0report = JSON.parse(fs.readFileSync(
  'C:\\Users\\Administrator\\Desktop\\2026-09-21-master\\s0-quality-report.json',
  'utf-8',
));

const s1data = JSON.parse(fs.readFileSync(
  'C:\\Users\\Administrator\\Desktop\\2026-09-21-master\\s1-nouns-with-offsets.json',
  'utf-8',
));

console.log(`========== 实验4：真实 LLM 新方案 vs 原方案对比 ==========\n`);

// 建立索引：chunkKey + "-" + start → 残文
const residualIndex = new Map();
for (const r of s0report.residuals) {
  const id = `${r.chunkKey}-${r.start}`;
  residualIndex.set(id, r);
}

// 建立原方案索引：truncId → [noun1, noun2, ...]
const originalOutput = new Map();
for (const noun of s1data.nouns) {
  for (const truncId of noun.sourceTruncIds || []) {
    if (!originalOutput.has(truncId)) originalOutput.set(truncId, []);
    originalOutput.get(truncId).push(noun.surface);
  }
}

console.log(`s0 残文总数: ${s0report.residuals.length}`);
console.log(`s1 名词总数: ${s1data.nouns.length}`);
console.log(`原方案有输出的残文数: ${originalOutput.size}`);

// 抽样策略：
// 1. 原始残文 ≥ 10 字符（确保有意义）
// 2. 剔除虚词后 ≥ 5 字符（确保剔后还有内容）
// 3. 剔除比例 > 5%（确保确实剔除了虚词，避免选了"原本就没虚词"的样本）
// 4. 在原方案里有输出（确保能对照）
const candidates = [];
for (const r of s0report.residuals) {
  if (r.length < 10) continue;
  const cleaned = stripFunctionWords(r.text);
  if (cleaned.length < 5) continue;
  if (cleaned.length >= r.length * 0.95) continue;
  const truncId = `${r.chunkKey}-${r.start}`;
  if (!originalOutput.has(truncId)) continue; // 原方案下没提取出东西（避免对比没意义）
  candidates.push({ residual: r, cleanedText: cleaned, truncId });
}

console.log(`满足条件的可对比样本数: ${candidates.length}\n`);

// 抽样 80 条（用固定步长保证分散）
const SAMPLE_SIZE = 80;
const sample = [];
const step = Math.max(1, Math.floor(candidates.length / SAMPLE_SIZE));
for (let i = 0; i < SAMPLE_SIZE && i * step < candidates.length; i++) {
  sample.push(candidates[i * step]);
}

console.log(`抽样数: ${sample.length}\n`);

console.log('--- 抽样示例（前 8 条）---');
sample.slice(0, 8).forEach((s, i) => {
  const origNouns = originalOutput.get(s.truncId) || [];
  console.log(`  [${i + 1}] 原残文: "${s.residual.text}"`);
  console.log(`      剔虚词: "${s.cleanedText}"`);
  console.log(`      原方案LLM返回: [${origNouns.join(', ')}]`);
});

// 跑新方案
async function runNew() {
  console.log(`\n--- 调用 LLM（新方案：剔除虚词的 ${sample.length} 条残文）---`);

  const truncations = sample.map(s => ({ text: s.cleanedText }));
  const resB = await callLLM(buildBatchPrompt(truncations), { temperature: 0 });

  if (!resB) {
    console.error('LLM 调用失败');
    process.exit(1);
  }

  console.log(`  新方案: prompt=${resB.usage.prompt_tokens}, completion=${resB.usage.completion_tokens}, total=${resB.usage.total_tokens}`);

  const parsedB = parseBatchLLMOutput(resB.text);

  // 统计
  let totalOrig = 0, totalNew = 0;
  let stopwordOrig = 0, stopwordNew = 0;
  const stopwordOrigSet = new Set();
  const stopwordNewSet = new Set();
  const realOrigSet = new Set();
  const realNewSet = new Set();
  const perResidual = [];

  for (let i = 0; i < sample.length; i++) {
    const s = sample[i];
    const nounsOrig = originalOutput.get(s.truncId) || [];
    const nounsNew = parsedB[i] || [];
    totalOrig += nounsOrig.length;
    totalNew += nounsNew.length;
    const realOrig = [];
    const realNew = [];

    for (const n of nounsOrig) {
      const lower = n.toLowerCase();
      if (STOPWORDS.has(lower)) {
        stopwordOrig++;
        stopwordOrigSet.add(lower);
      } else {
        realOrig.push(n);
        realOrigSet.add(lower);
      }
    }
    for (const n of nounsNew) {
      const lower = n.toLowerCase();
      if (STOPWORDS.has(lower)) {
        stopwordNew++;
        stopwordNewSet.add(lower);
      } else {
        realNew.push(n);
        realNewSet.add(lower);
      }
    }

    perResidual.push({
      original: s.residual.text,
      cleaned: s.cleanedText,
      nounsOrig,
      nounsNew,
      realOrig,
      realNew,
    });
  }

  console.log(`\n========== 真实对比结果 ==========\n`);
  console.log(`同一批 ${sample.length} 条残文在两种方案下的 LLM 输出:`);
  console.log(`\n--- 原方案（真实数据）---`);
  console.log(`  总提取: ${totalOrig} 个`);
  console.log(`  其中虚词: ${stopwordOrig} 个 (${stopwordOrigSet.size} 种)`);
  console.log(`  真名词唯一: ${realOrigSet.size} 个`);
  console.log(`  被拦截的虚词示例: [${[...stopwordOrigSet].slice(0, 15).join(', ')}]`);

  console.log(`\n--- 新方案（剔除虚词，真实 LLM）---`);
  console.log(`  总提取: ${totalNew} 个`);
  console.log(`  其中虚词: ${stopwordNew} 个 (${stopwordNewSet.size} 种)`);
  console.log(`  真名词唯一: ${realNewSet.size} 个`);
  if (stopwordNewSet.size > 0) {
    console.log(`  漏出的虚词: [${[...stopwordNewSet].join(', ')}]`);
  }

  // 真名词差异
  const onlyOrig = [...realOrigSet].filter(n => !realNewSet.has(n));
  const onlyNew = [...realNewSet].filter(n => !realOrigSet.has(n));
  const both = [...realOrigSet].filter(n => realNewSet.has(n));

  console.log(`\n--- 真名词差异 ---`);
  console.log(`  双方都识别: ${both.length} 个`);
  console.log(`  原方案独有、新方案缺失: ${onlyOrig.length} 个`);
  console.log(`  新方案独有、原方案缺失: ${onlyNew.length} 个`);
  if (onlyOrig.length > 0) {
    console.log(`    原独有: [${onlyOrig.slice(0, 20).join(', ')}]`);
  }
  if (onlyNew.length > 0) {
    console.log(`    新独有: [${onlyNew.slice(0, 20).join(', ')}]`);
  }

  // 估算全量 token 节省
  console.log(`\n--- Token 节省估算（外推到全量）---`);
  const totalChars = candidates.reduce((sum, c) => sum + c.residual.length, 0);
  const cleanedChars = candidates.reduce((sum, c) => sum + c.cleanedText.length, 0);
  const avgRatio = cleanedChars / totalChars;
  console.log(`  候选样本 ${candidates.length} 条：字符 ${totalChars} → ${cleanedChars}（压缩 ${(100 * (1 - avgRatio)).toFixed(1)}%）`);
  console.log(`  新方案本次 prompt: ${resB.usage.prompt_tokens} tokens`);
  console.log(`  估算同 batch size 下原方案 prompt: ~${Math.round(resB.usage.prompt_tokens / avgRatio)} tokens`);

  // 持久化
  fs.writeFileSync(
    'C:\\Users\\Administrator\\Desktop\\2026-09-21-master\\experiment-strip-function-words\\04-real-llm-comparison.json',
    JSON.stringify({
      sampleSize: sample.length,
      newSchemeUsage: resB.usage,
      stats: {
        original: { total: totalOrig, stopwords: stopwordOrig, stopwordTypes: [...stopwordOrigSet], realNounUnique: realOrigSet.size },
        stripped: { total: totalNew, stopwords: stopwordNew, stopwordTypes: [...stopwordNewSet], realNounUnique: realNewSet.size },
      },
      diff: {
        both,
        onlyOrig,
        onlyNew,
      },
      avgCompressionRatio: avgRatio,
      perResidual,
      rawNew: resB.text,
    }, null, 2),
  );

  console.log(`\n✓ 实验4结果已保存到 experiment-strip-function-words/04-real-llm-comparison.json`);
}

runNew().catch(err => {
  console.error('运行出错:', err);
  process.exit(1);
});
