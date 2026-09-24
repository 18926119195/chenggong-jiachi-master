/**
 * 串行测试脚本：Z3Q2 全流程 recall + reasoning 串行
 *
 * 目标：测试 recall 和 reasoning 在同一问题内串行执行，对 reasoning LLM 缓存命中率的影响
 *
 * 所有输出落到独立目录（serial-test-z3q2/），不动原有任何文件。
 * 快照目录设为独立子目录（serial-test-z3q2/snapshots/），不动原有 llm-snapshots。
 * LLM 配置（API_KEY/BASE_URL/MODEL）零修改，复用环境变量或 .env 默认值。
 *
 * 用法：node test-serial-z3q2.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

// ============ 路径配置 ============
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SOURCE_DIR = path.join(__dirname, '..', '完整的运作'); // 复用原项目的脚本和数据

// 用环境变量强制指定独立快照目录，避免污染原有 llm-snapshots/Z3-Q2/
// 注：必须在 import llmClient 之前设置（llmClient 在初始化时读取 SNAPSHOT_DIR）
process.env.LLM_SNAPSHOT_DIR = path.join(__dirname, 'snapshots');
if (!fs.existsSync(process.env.LLM_SNAPSHOT_DIR)) fs.mkdirSync(process.env.LLM_SNAPSHOT_DIR, { recursive: true });

const { callLLM, LLM_BASE_URL, LLM_MODEL } = await import(pathToFileURL(path.join(SOURCE_DIR, 'src', 'core', 'llmClient.js')).href);
const { atomSearchText, isRetrievableAtom } = await import(pathToFileURL(path.join(SOURCE_DIR, 'src', 'core', 'pureTextTable.js')).href);

// ============ 配置 ============
const QUESTION_ID = 'Z3-Q2';
const DOCUVERSE_PATH = process.env.DOCUVERSE_PATH || 'C:\\Users\\Administrator\\Desktop\\docuverse_cartographies_squizoanalythiques_Fe_lix_Guattari_1789114122714.docuverse.json';
const NOUN_INDEX_PATH = path.join(SOURCE_DIR, 'final-noun-index.json');
const QUESTIONS_PATH = path.join(SOURCE_DIR, 'test-questions.json');
const OUTPUT_RECALL = path.join(__dirname, 'serial-noun-recall-results.json');
const OUTPUT_LLM = path.join(__dirname, 'serial-candidate-texts-for-llm.json');
const OUTPUT_TRACEBACK = path.join(__dirname, 'serial-material-traceback-map.json');
const OUTPUT_PROMPT = path.join(__dirname, 'serial-multipath-prompt-Z3-Q2.txt');
const OUTPUT_REASONING = path.join(__dirname, 'serial-reasoning-output-Z3-Q2.json');

const CONCURRENCY = 1;
const TOPOLOGY_WINDOW = 2;
const SCORE_THRESHOLD = 80;
const TOP_N_NOUNS = 80;
const MAX_PROMPT_TOKENS = 2500;
const MAX_COARSE_OUTPUT_TOKENS = 32768;
const MAX_SCORE_OUTPUT_TOKENS = 32768;
const CHARS_PER_TOKEN = 3.5;

// ============ 数据加载 ============
console.log('='.repeat(80));
console.log('串行测试：Z3Q2 recall + reasoning');
console.log('='.repeat(80));
console.log(`LLM: ${LLM_BASE_URL} model=${LLM_MODEL} thinking=disabled`);

console.log('\n[1/4] 加载数据...');
const docuverse = JSON.parse(fs.readFileSync(DOCUVERSE_PATH, 'utf-8'));
const nounIndex = JSON.parse(fs.readFileSync(NOUN_INDEX_PATH, 'utf-8'));
const questions = JSON.parse(fs.readFileSync(QUESTIONS_PATH, 'utf-8'));

// 构建 chunk 表
const chunkEntries = [];
for (const chunk of docuverse.bookIndex.chunks) {
  if (!isRetrievableAtom(chunk)) continue;
  const text = atomSearchText(chunk).trim();
  if (!text || text.length < 8) continue;
  chunkEntries.push({ chunkKey: chunk.key, page: chunk.page, text });
}
const chunkByKey = new Map(chunkEntries.map((e) => [e.chunkKey, e]));

// 构建全局名词出现列表（阅读序）
const globalNounOccurrences = [];
for (const noun of nounIndex.nouns) {
  for (const { chunkKey, start, end, page } of noun.offsets) {
    globalNounOccurrences.push({ nounId: noun.id, nounSurface: noun.surface, chunkKey, start, end, page: page || 0 });
  }
}
globalNounOccurrences.sort((a, b) => {
  if (a.page !== b.page) return a.page - b.page;
  if (a.chunkKey !== b.chunkKey) return a.chunkKey.localeCompare(b.chunkKey);
  return a.start - b.start;
});

console.log(`  chunk 数: ${chunkEntries.length}, 名词数: ${nounIndex.nouns.length}`);

// 找到目标问题
const q = questions.find((x) => x.id === QUESTION_ID);
if (!q) { console.error(`未找到问题 ${QUESTION_ID}`); process.exit(1); }
console.log(`  问题: ${q.id} - ${q.question}`);

// ============ 辅助函数 ============
function estimatePromptTokens(text) {
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

function buildCoarsePrompt(question, batchWords) {
  const list = batchWords.map((w, i) => `【【${i + 1}】】${w}`).join('\n');
  return `问题: ${question}\n\n从下列名词中，选出所有对回答这个问题可能有帮助的词。只回答相关词的机器符号，例如：【【1】】【【5】】【【17】】\n如果没有任何相关词，回答：NONE\n\n词语列表：\n${list}\n\n相关词编号：`;
}

function buildScorePrompt(question, yesNounSurfaces) {
  const list = yesNounSurfaces.map((w, i) => `【【${i + 1}】】${w}`).join('\n');
  return `问题: ${question}\n\n以下是你选中的相关词，请按重要程度打分（1-100）：\n  1-30   弱相关：领域相关但非核心，仅提及\n  31-60  中等相关：对答案有一定贡献\n  61-80  强相关：重要概念，显著影响答案质量\n  81-100 核心概念：没有它就无法准确回答\n\n词语列表：\n${list}\n\n输出格式要求：\n- 只输出【【N】】分数，每行一个，不要任何解释或额外文字\n- 例如：【【1】】95\n- 不要使用思维链，不要推理过程，直接给出分数\n- 严格按格式，开始输出：`;
}

function splitCoarseBatches(nouns) {
  const batches = [];
  let currentBatch = [];
  let currentTokens = 0;
  let globalStartIdx = 0;
  for (const noun of nouns) {
    const line = `【【${currentBatch.length + 1}】】${noun.surface}\n`;
    const tokens = estimatePromptTokens(line);
    if (currentBatch.length > 0 && currentTokens + tokens > MAX_PROMPT_TOKENS) {
      batches.push({ startIdx: globalStartIdx, batchNouns: [...currentBatch] });
      globalStartIdx += currentBatch.length;
      currentBatch = [noun];
      currentTokens = estimatePromptTokens(`【【1】】${noun.surface}\n`);
    } else {
      currentBatch.push(noun);
      currentTokens += tokens;
    }
  }
  if (currentBatch.length > 0) batches.push({ startIdx: globalStartIdx, batchNouns: currentBatch });
  return batches;
}

function splitScoreBatches(entries) {
  const batches = [];
  let currentBatch = [];
  let currentTokens = 0;
  let globalStartIdx = 0;
  for (const entry of entries) {
    const line = `【【${currentBatch.length + 1}】】${entry.surface}\n`;
    const tokens = estimatePromptTokens(line);
    if (currentBatch.length > 0 && currentTokens + tokens > MAX_PROMPT_TOKENS) {
      batches.push({ startIdx: globalStartIdx, batchEntries: [...currentBatch] });
      globalStartIdx += currentBatch.length;
      currentBatch = [entry];
      currentTokens = estimatePromptTokens(`【【1】】${entry.surface}\n`);
    } else {
      currentBatch.push(entry);
      currentTokens += tokens;
    }
  }
  if (currentBatch.length > 0) batches.push({ startIdx: globalStartIdx, batchEntries: currentBatch });
  return batches;
}

function parseCoarseResult(rawText, batchSize) {
  if (!rawText || typeof rawText !== 'string') return [];
  const text = rawText.trim();
  if (/^none$/i.test(text)) return [];
  const indices = [];
  for (const m of text.matchAll(/【+(\d+)】+/g)) {
    const idx = parseInt(m[1], 10) - 1;
    if (idx >= 0 && idx < batchSize) indices.push(idx);
  }
  return [...new Set(indices)];
}

function parseScoreResult(rawText, batchSize) {
  if (!rawText || typeof rawText !== 'string') return [];
  const text = rawText.trim();
  const results = [];
  const refs = [...text.matchAll(/【【(\d+)】】/g)];
  for (let i = 0; i < refs.length; i++) {
    const idx = parseInt(refs[i][1], 10) - 1;
    if (idx < 0 || idx >= batchSize) continue;
    const start = refs[i].index + refs[i][0].length;
    const end = i + 1 < refs.length ? refs[i + 1].index : text.length;
    const segment = text.slice(start, end);
    const scoreMatch = segment.match(/\d{1,3}/);
    if (!scoreMatch) continue;
    const score = parseInt(scoreMatch[0], 10);
    if (score < 1 || score > 100) continue;
    results.push({ index: idx, score });
  }
  return results;
}

function buildTopologyChainsForNounV2(nounId) {
  const nounEntry = nounIndex.nouns.find((n) => n.id === nounId);
  if (!nounEntry) return [];
  const chains = [];
  for (const { chunkKey, start, end, page } of nounEntry.offsets) {
    let targetIdx = -1;
    for (let i = 0; i < globalNounOccurrences.length; i++) {
      const occ = globalNounOccurrences[i];
      if (occ.chunkKey === chunkKey && occ.start === start) {
        targetIdx = i;
        break;
      }
    }
    if (targetIdx === -1) continue;
    const beforeStart = Math.max(0, targetIdx - TOPOLOGY_WINDOW);
    const afterEnd = Math.min(globalNounOccurrences.length, targetIdx + 1 + TOPOLOGY_WINDOW);
    const neighborSet = new Set();
    for (let i = beforeStart; i < afterEnd; i++) {
      if (i !== targetIdx) neighborSet.add(globalNounOccurrences[i].nounSurface);
    }
    if (neighborSet.size === 0) continue;
    const chunkRanges = new Map();
    for (let i = beforeStart; i < afterEnd; i++) {
      const occ = globalNounOccurrences[i];
      if (!chunkRanges.has(occ.chunkKey)) {
        chunkRanges.set(occ.chunkKey, { minStart: occ.start, maxEnd: occ.end, page: occ.page });
      } else {
        const range = chunkRanges.get(occ.chunkKey);
        range.minStart = Math.min(range.minStart, occ.start);
        range.maxEnd = Math.max(range.maxEnd, occ.end);
      }
    }
    for (const [ck, range] of chunkRanges) {
      chains.push({ chunkKey: ck, page: range.page || 0, neighbors: [...neighborSet], chainStart: range.minStart, chainEnd: range.maxEnd });
    }
  }
  return chains;
}

function mergeTopologyIntervals(chains) {
  if (chains.length === 0) return [];
  const byChunk = new Map();
  for (const chain of chains) {
    if (!byChunk.has(chain.chunkKey)) byChunk.set(chain.chunkKey, []);
    byChunk.get(chain.chunkKey).push({ chainStart: chain.chainStart, chainEnd: chain.chainEnd, page: chain.page });
  }
  const merged = [];
  for (const [chunkKey, intervals] of byChunk) {
    intervals.sort((a, b) => a.chainStart - b.chainStart);
    let curStart = intervals[0].chainStart, curEnd = intervals[0].chainEnd, curPage = intervals[0].page;
    for (let i = 1; i < intervals.length; i++) {
      const { chainStart, chainEnd, page } = intervals[i];
      if (chainStart <= curEnd) { curEnd = Math.max(curEnd, chainEnd); }
      else { merged.push({ chunkKey, chainStart: curStart, chainEnd: curEnd, page: curPage }); curStart = chainStart; curEnd = chainEnd; curPage = page; }
    }
    merged.push({ chunkKey, chainStart: curStart, chainEnd: curEnd, page: curPage });
  }
  return merged;
}

function recallByIntervals(intervals) {
  const results = [];
  for (const { chunkKey, chainStart, chainEnd, page } of intervals) {
    const entry = chunkByKey.get(chunkKey);
    if (!entry) continue;
    const text = entry.text.slice(chainStart, chainEnd);
    results.push({ chunkKey, page: page || entry.page, chainStart, chainEnd, text });
  }
  return results;
}

// ============ 阶段1：串行 Recall（Z3Q2） ============
console.log('\n[2/4] 阶段1：串行 Recall（Z3Q2）...');
const tRecall = Date.now();

const coarseBatches = splitCoarseBatches(nounIndex.nouns);
const coarseYes = new Map();
let coarsePromptTokens = 0, coarseCompletionTokens = 0, coarseFailedBatches = 0, coarseTruncated = 0;

let batchIdx = 0;
await Promise.all(
  Array.from({ length: CONCURRENCY }, async () => {
    while (true) {
      const myIdx = batchIdx++;
      if (myIdx >= coarseBatches.length) break;
      const b = coarseBatches[myIdx];
      const surfaces = b.batchNouns.map((n) => n.surface);
      const prompt = buildCoarsePrompt(q.question, surfaces);
      const res = await callLLM(prompt, { maxTokens: MAX_COARSE_OUTPUT_TOKENS, questionId: QUESTION_ID });
      if (res?.usage) {
        coarsePromptTokens += res.usage.prompt_tokens || 0;
        coarseCompletionTokens += res.usage.completion_tokens || 0;
      }
      if (res?.truncated) coarseTruncated++;
      if (!res) coarseFailedBatches++;
      const yesIndices = parseCoarseResult(res?.text || '', b.batchNouns.length);
      for (const localIdx of yesIndices) coarseYes.set(b.startIdx + localIdx, true);
      process.stdout.write(`\r  粗筛: ${coarseYes.size} YES / ${nounIndex.nouns.length}, 批次 ${myIdx + 1}/${coarseBatches.length}          `);
    }
  })
);

console.log(`\n  粗筛完成: ${coarseYes.size} 个相关词, tokens: prompt=${coarsePromptTokens} completion=${coarseCompletionTokens}`);

// 精打
const yesEntries = [...coarseYes.keys()].map((globalIdx) => nounIndex.nouns[globalIdx]);
const scored = new Map();
let scorePromptTokens = 0, scoreCompletionTokens = 0;

if (yesEntries.length > 0) {
  const scoreBatches = splitScoreBatches(yesEntries);
  let scoreBatchIdx = 0, scoreTruncated = 0;
  await Promise.all(
    Array.from({ length: CONCURRENCY }, async () => {
      while (true) {
        const myIdx = scoreBatchIdx++;
        if (myIdx >= scoreBatches.length) break;
        const b = scoreBatches[myIdx];
        const surfaces = b.batchEntries.map((e) => e.surface);
        const prompt = buildScorePrompt(q.question, surfaces);
        const res = await callLLM(prompt, { maxTokens: MAX_SCORE_OUTPUT_TOKENS, questionId: QUESTION_ID });
        if (res?.usage) {
          scorePromptTokens += res.usage.prompt_tokens || 0;
          scoreCompletionTokens += res.usage.completion_tokens || 0;
        }
        if (res?.truncated) scoreTruncated++;
        const scoredInBatch = parseScoreResult(res?.text || '', b.batchEntries.length);
        for (const { index, score } of scoredInBatch) {
          const entry = b.batchEntries[index];
          if (entry) scored.set(entry.id, score);
        }
        process.stdout.write(`\r  精打: ${scored.size}/${yesEntries.length}, 批次 ${myIdx + 1}/${scoreBatches.length}          `);
      }
    })
  );
  console.log(`\n  精打完成: ${scored.size} 个已打分, tokens: prompt=${scorePromptTokens} completion=${scoreCompletionTokens}`);
} else {
  console.log('  粗筛无 YES 词，跳过精打');
}

const scoredList = [...scored.entries()]
  .map(([nounId, score]) => {
    const n = nounIndex.nouns.find((x) => x.id === nounId);
    return n ? { id: n.id, surface: n.surface, df: n.offsets.length, score } : null;
  })
  .filter(Boolean)
  .sort((a, b) => b.score - a.score);

const highScoredList = scoredList.filter((item) => item.score >= SCORE_THRESHOLD);
const topNouns = highScoredList.slice(0, TOP_N_NOUNS);

const allChains = [];
const highScoredDetails = [];
for (const item of topNouns) {
  const chains = buildTopologyChainsForNounV2(item.id);
  allChains.push(...chains);
  highScoredDetails.push({ id: item.id, surface: item.surface, score: item.score, df: item.df, chainCount: chains.length });
}

const mergedIntervals = mergeTopologyIntervals(allChains);
const recalledTexts = recallByIntervals(mergedIntervals);

const recallElapsed = ((Date.now() - tRecall) / 1000).toFixed(1);
const totalRecallPromptTokens = coarsePromptTokens + scorePromptTokens;
const totalRecallCompletionTokens = coarseCompletionTokens + scoreCompletionTokens;

console.log(`  Top 10: ${scoredList.slice(0, 10).map((s) => `${s.surface}(${s.score})`).join(', ')}`);
console.log(`  拓扑链: ${allChains.length} 条 → 合并区间 ${mergedIntervals.length} 个, 召回文本块: ${recalledTexts.length}, 耗时: ${recallElapsed}s`);

const recallResult = {
  questionId: q.id, question: q.question, zone: q.zone,
  totalNouns: nounIndex.nouns.length, coarseYesCount: coarseYes.size,
  scoredCount: scored.size, selectedCount: scoredList.length,
  highScoredCount: highScoredList.length, scoreThreshold: SCORE_THRESHOLD,
  failedBatches: coarseFailedBatches,
  tokenCost: { coarsePromptTokens, coarseCompletionTokens, scorePromptTokens, scoreCompletionTokens, totalPromptTokens: totalRecallPromptTokens, totalCompletionTokens: totalRecallCompletionTokens },
  elapsedSecs: parseFloat(recallElapsed),
  scoredNouns: scoredList, highScoredNouns: highScoredDetails,
  mergedTopologyIntervals: mergedIntervals, recalledTexts,
};

fs.writeFileSync(OUTPUT_RECALL, JSON.stringify([recallResult], null, 2), 'utf-8');
console.log(`  ✅ Recall 结果已保存: ${OUTPUT_RECALL}`);

// ============ 阶段2：构建 Prompt 输入 ============
console.log('\n[3/4] 阶段2：构建 Prompt 输入...');
const chunkToHits = new Map();
const recallItems = scoredList.map((item) => {
  const chains = buildTopologyChainsForNounV2(item.id);
  const bookKeys = [...new Set(chains.map((c) => c.chunkKey))];
  for (const bk of bookKeys) {
    if (!chunkToHits.has(bk)) chunkToHits.set(bk, []);
    chunkToHits.get(bk).push({ noun: item.surface, score: item.score, nounId: item.id });
  }
  return { id: item.id, surface: item.surface, score: item.score, df: item.df, bookKeys };
});

const llmChunks = [];
const tracebackMap = {};
recallResult.recalledTexts.forEach((chunk, idx) => {
  const materialId = idx + 1;
  const hits = chunkToHits.get(chunk.chunkKey) || [];
  llmChunks.push({ id: materialId, nounCount: hits.length, text: chunk.text });
  tracebackMap[materialId] = { chunkKey: chunk.chunkKey, nounCount: hits.length, hits };
});

const outputForLLM = [{ questionId: q.id, question: q.question, zone: q.zone, uniqueChunks: llmChunks.length, chunks: llmChunks }];
const tracebackMaps = { [q.id]: { question: q.question, totalMaterials: llmChunks.length, materials: tracebackMap } };

fs.writeFileSync(OUTPUT_LLM, JSON.stringify(outputForLLM, null, 2), 'utf-8');
fs.writeFileSync(OUTPUT_TRACEBACK, JSON.stringify(tracebackMaps, null, 2), 'utf-8');
console.log(`  ✅ LLM 输入: ${OUTPUT_LLM}`);
console.log(`  ✅ 溯源映射: ${OUTPUT_TRACEBACK}`);

// 生成 multipath prompt
const lines = [];
lines.push(`问题：${q.question}`);
lines.push('');
lines.push('材料：');
lines.push('');
for (const chunk of llmChunks) {
  lines.push(`【【${chunk.id}】】(命中: ${chunk.nounCount})`);
  lines.push(chunk.text);
  lines.push('');
}
lines.push('---');
lines.push('');
lines.push('要求：输出2-4条独立推理路径，每条路径包含多个步骤，每步可引用一个或多个材料【【N】】。');
lines.push('');
lines.push('格式：');
lines.push('');
lines.push('# 路径一：[标题]');
lines.push('');
lines.push('步骤1：使用【【X】】，提取...');
lines.push('步骤2：综合【【Y】】【【Z】】，对比...');
lines.push('');
lines.push('结论：[此路径结论]');
lines.push('');
lines.push('（继续路径二、三...）');
lines.push('');
lines.push('**引用规范**：');
lines.push('- 单个材料：使用【【N】】，提取...，判断...');
lines.push('- 多个材料：综合【【N】】【【M】】，对比/交叉验证/综合提取...');
lines.push('');
lines.push('**推理策略**：');
lines.push('- 对比论证：对比不同材料中的矛盾或差异');
lines.push('- 交叉验证：从多个材料中找到互相支撑的证据');
lines.push('- 综合支撑：从多处提取一致的特征或模式');

const prompt = lines.join('\n');
fs.writeFileSync(OUTPUT_PROMPT, prompt, 'utf-8');
console.log(`  ✅ Prompt 已保存: ${OUTPUT_PROMPT} (${prompt.length} 字符, ${llmChunks.length} 个材料)`);

// ============ 阶段3：串行 Reasoning（同一会话） ============
console.log('\n[4/4] 阶段3：串行 Reasoning（Z3Q2）...');
const tReasoning = Date.now();
const res = await callLLM(prompt, { maxTokens: 32768, questionId: QUESTION_ID });
const reasoningElapsed = ((Date.now() - tReasoning) / 1000).toFixed(1);

if (!res) {
  console.error('LLM 调用失败，未生成推理结果');
  process.exit(1);
}

const usedMaterials = new Set();
for (const m of res.text.matchAll(/【【(\d+)】】/g)) {
  usedMaterials.add(parseInt(m[1], 10));
}

const tracebackReport = {};
for (const materialId of usedMaterials) {
  const entry = tracebackMap[materialId];
  if (entry) tracebackReport[materialId] = entry;
}

const output = {
  questionId: q.id, question: q.question,
  model: LLM_MODEL, thinking: 'disabled',
  elapsedSecs: parseFloat(reasoningElapsed),
  tokenUsage: res.usage,
  truncated: res.truncated,
  llmOutput: res.text,
  totalMaterialsAvailable: llmChunks.length,
  materialsUsedCount: usedMaterials.size,
  traceback: tracebackReport,
};

fs.writeFileSync(OUTPUT_REASONING, JSON.stringify(output, null, 2), 'utf-8');

console.log(`\n✅ Reasoning 完成，耗时 ${reasoningElapsed}s`);
console.log(`   Token: prompt=${res.usage?.prompt_tokens ?? '-'} completion=${res.usage?.completion_tokens ?? '-'} total=${res.usage?.total_tokens ?? '-'}`);
if (res.truncated) console.log('   ⚠️  输出被截断');
console.log(`   引用材料: ${usedMaterials.size}/${llmChunks.length}`);
console.log(`   ✅ 已保存: ${OUTPUT_REASONING}`);

// ============ 总结 ============
const totalElapsed = ((Date.now() - tRecall) / 1000).toFixed(1);
console.log('\n' + '='.repeat(80));
console.log('串行测试完成总结');
console.log('='.repeat(80));
console.log(`问题: ${q.id} - ${q.question}`);
console.log(`Recall: ${recallElapsed}s, tokens: ${totalRecallPromptTokens} + ${totalRecallCompletionTokens}`);
console.log(`Reasoning: ${reasoningElapsed}s, tokens: ${res.usage?.prompt_tokens ?? '-'} + ${res.usage?.completion_tokens ?? '-'}`);
console.log(`总耗时: ${totalElapsed}s`);
console.log(`输出文件:`);
console.log(`  ${OUTPUT_RECALL}`);
console.log(`  ${OUTPUT_LLM}`);
console.log(`  ${OUTPUT_TRACEBACK}`);
console.log(`  ${OUTPUT_PROMPT}`);
console.log(`  ${OUTPUT_REASONING}`);
