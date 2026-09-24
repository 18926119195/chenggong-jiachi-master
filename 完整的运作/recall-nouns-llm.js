/**
 * 基于词表拓扑链的召回引擎（两步粗筛 + 精打分架构）
 *
 * 流程：
 * 1. 粗筛（LLM 1 轮）：快速判断"是否相关"，每批输入【【N】】词语，只回【【N】】列表或 NONE
 * 2. 精打（LLM 2 轮）：只对粗筛 YES 的词打分，每批输入【【N】】词语，只回 JSON 数组
 * 3. 高分词 → 构建拓扑链 → 映射 bookKey → ChunkKey 去重 → 召回原文
 *
 * LLM 调用统一走 src/core/llmClient.js（DeepSeek，deepseek-chat，thinking 强制关闭）。
 *
 * 用法：
 *   node recall-nouns-llm.js                      # 所有问题
 *   node recall-nouns-llm.js Z1-Q1 Z1-Q2           # 指定问题ID
 *   NOUN_BATCH_SIZE=500 node recall-nouns-llm.js   # 粗筛批次大小（默认500）
 */

import fs from 'fs';
import path from 'path';
import { callLLM, LLM_BASE_URL, LLM_MODEL } from './src/core/llmClient.js';
import { atomSearchText, isRetrievableAtom } from './src/core/pureTextTable.js';

// ============ 配置（环境变量覆盖）============
const DOCUVERSE_PATH = process.env.DOCUVERSE_PATH || 'C:\\Users\\Administrator\\Desktop\\docuverse_cartographies_squizoanalythiques_Fe_lix_Guattari_1789114122714.docuverse.json';
const NOUN_INDEX_PATH = process.env.NOUN_INDEX_PATH || path.join(process.cwd(), 'final-noun-index.json');
const QUESTIONS_PATH = process.env.QUESTIONS_PATH || path.join(process.cwd(), 'test-questions.json');
const OUTPUT_PATH = process.env.OUTPUT_PATH || path.join(process.cwd(), 'noun-recall-results.json');

// ============ 黑名单过滤（送给LLM之前；不动名词表）============
const BLACKLIST_PATH = process.env.NOUN_BLACKLIST_PATH || path.join(process.cwd(), 'noun-blacklist.json');
const FILTER_BLACKLIST = (process.env.FILTER_BLACKLIST || '1') === '1'; // 默认开启，设为 0 可关闭

const CONCURRENCY = parseInt(process.env.LLM_CONCURRENCY || '8', 10);
const TOPOLOGY_WINDOW = parseInt(process.env.TOPOLOGY_WINDOW || '2', 10);
const QUESTION_IDS = process.argv.slice(2).length
  ? process.argv.slice(2)
  : (process.env.QUESTION_IDS || '').split(',').filter(Boolean);

// ============ Token 预算控制（对齐 s1-llm-fill.js）============
const CHARS_PER_TOKEN = 3.5;
const MAX_PROMPT_TOKENS = 2500; // 每批 prompt 最多 2500 tokens（预算分批依据，不变）
const MAX_COARSE_OUTPUT_TOKENS = 32768; // 粗筛输出上限（V4-Flash: 384K，设为 32K 安全阈值）
const MAX_SCORE_OUTPUT_TOKENS = 32768; // 精打输出上限（V4-Flash: 384K，设为 32K 安全阈值）

function estimatePromptTokens(text) {
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

console.log(`LLM: ${LLM_BASE_URL} model=${LLM_MODEL} thinking=disabled`);

// ============ 加载数据 ============
console.log('加载数据...');
const docuverse = JSON.parse(fs.readFileSync(DOCUVERSE_PATH, 'utf-8'));
const nounIndex = JSON.parse(fs.readFileSync(NOUN_INDEX_PATH, 'utf-8'));
const questions = JSON.parse(fs.readFileSync(QUESTIONS_PATH, 'utf-8'));

// 构建 chunk 表（不再拼接全局 fullText，也不计算全局偏移量）
const chunkEntries = [];
for (const chunk of docuverse.bookIndex.chunks) {
  if (!isRetrievableAtom(chunk)) continue;
  const text = atomSearchText(chunk).trim();
  if (!text || text.length < 8) continue;
  chunkEntries.push({
    chunkKey: chunk.key,
    page: chunk.page,
    text,
  });
}
// chunkKey -> entry 的直查表，取代原来的"全局偏移二分查找"
const chunkByKey = new Map(chunkEntries.map((e) => [e.chunkKey, e]));
console.log(`  chunk 数: ${chunkEntries.length}（无全局拼接）`);
console.log(`  名词数（原始）: ${nounIndex.nouns.length}, 问题数: ${questions.length}`);

// ============ 黑名单过滤：送给 LLM 的名词列表 =============
if (FILTER_BLACKLIST && fs.existsSync(BLACKLIST_PATH)) {
  const blacklistData = JSON.parse(fs.readFileSync(BLACKLIST_PATH, 'utf-8'));
  const blacklistedSurfaces = new Set(blacklistData.blacklist || []);
  const before = nounIndex.nouns.length;
  nounIndex.nouns = nounIndex.nouns.filter((n) => !blacklistedSurfaces.has(n.surface));
  const after = nounIndex.nouns.length;
  console.log(`  黑名单过滤: ${before} → ${after}（剔除 ${before - after} 条 = ${((before - after) / before * 100).toFixed(2)}%, 黑名单条目=${blacklistedSurfaces.size}）`);
} else if (FILTER_BLACKLIST) {
  console.warn(`  ⚠️ FILTER_BLACKLIST=1 但黑名单文件不存在: ${BLACKLIST_PATH}（跳过过滤）`);
}

// ============ 辅助函数：isRetrievableAtom / atomSearchText 已提取到 src/core/pureTextTable.js ============
// （原来这里的本地副本对 note 清洗规则不全，与其他脚本存在细微差异，改用共享模块后消除该分裂）

// ============ Prompt 构建（机器符号，不含偏移量） ============
function buildCoarsePrompt(question, batchWords) {
  const list = batchWords.map((w, i) => `【【${i + 1}】】${w}`).join('\n');
  return `问题: ${question}

从下列名词中，选出所有对回答这个问题可能有帮助的词。只回答相关词的机器符号，例如：【【1】】【【5】】【【17】】
如果没有任何相关词，回答：NONE

词语列表：
${list}

相关词编号：`;
}

function buildScorePrompt(question, yesNounSurfaces) {
  const list = yesNounSurfaces.map((w, i) => `【【${i + 1}】】${w}`).join('\n');
  return `问题: ${question}

以下是你选中的相关词，请按重要程度打分（1-100）：
  1-30   弱相关：领域相关但非核心，仅提及
  31-60  中等相关：对答案有一定贡献
  61-80  强相关：重要概念，显著影响答案质量
  81-100 核心概念：没有它就无法准确回答

词语列表：
${list}

输出格式要求：
- 只输出【【N】】分数，每行一个，不要任何解释或额外文字
- 例如：【【1】】95
- 不要输出：【【1】】95（这个词很重要因为...）← 错误
- 不要使用思维链，不要推理过程，直接给出分数
- 严格按格式，开始输出：`;
}

// ============ Token 预算分批（粗筛）============
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

  if (currentBatch.length > 0) {
    batches.push({ startIdx: globalStartIdx, batchNouns: currentBatch });
  }

  return batches;
}

// ============ Token 预算分批（精打）============
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

  if (currentBatch.length > 0) {
    batches.push({ startIdx: globalStartIdx, batchEntries: currentBatch });
  }

  return batches;
}

// ============ 解析函数（容错，宽松匹配） ============
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
  if (/^【【\s*】\s*】$/.test(text)) return [];

  const results = [];
  // 找出所有【【N】】的位置
  const refs = [...text.matchAll(/【【(\d+)】】/g)];

  for (let i = 0; i < refs.length; i++) {
    const idx = parseInt(refs[i][1], 10) - 1; // 0-based
    if (idx < 0 || idx >= batchSize) continue;

    // 该编号对应的文本区间：从本编号结束，到下一个编号开始（或文本结尾）
    const start = refs[i].index + refs[i][0].length;
    const end = i + 1 < refs.length ? refs[i + 1].index : text.length;
    const segment = text.slice(start, end);

    // 只在这个区间内提取分数（取第一个 1-100 的数字）
    const scoreMatch = segment.match(/\d{1,3}/);
    if (!scoreMatch) continue;
    const score = parseInt(scoreMatch[0], 10);
    if (score < 1 || score > 100) continue;

    results.push({ index: idx, score });
  }

  return results;
}

// ============ 拓扑链召回（新架构）============
// 策略：
// 1. 分数过滤：只保留 score >= SCORE_THRESHOLD 的名词
// 2. 展开所有偏移量：从终词表获取每个高分名词的所有去重位移
// 3. 名词邻居：每个偏移量在终词表中找前后各 TOPOLOGY_WINDOW 个名词（基于终词表位置，非字符）
// 4. 拓扑链区间：第一个名词首字符位移 ~ 最后一个名词末字符位移
// 5. 区间去重取并集：合并重叠拓扑链
// 6. 按区间召回原文：用于推理模型

const SCORE_THRESHOLD = 80; // 分数阈值

// 预建：全局名词出现列表（按阅读序：page → chunkKey → start）
function buildGlobalNounOccurrences() {
  const occurrences = [];
  for (const noun of nounIndex.nouns) {
    for (const { chunkKey, start, end, page } of noun.offsets) {
      occurrences.push({
        nounId: noun.id,
        nounSurface: noun.surface,
        chunkKey,
        start,
        end,
        page: page || 0,
      });
    }
  }
  // 按阅读序排序：page → start（同页内按偏移量）
  occurrences.sort((a, b) => {
    if (a.page !== b.page) return a.page - b.page;
    if (a.chunkKey !== b.chunkKey) return a.chunkKey.localeCompare(b.chunkKey);
    return a.start - b.start;
  });
  return occurrences;
}

const globalNounOccurrences = buildGlobalNounOccurrences();

// 基于全局阅读序构建拓扑链（可跨 chunk）
function buildTopologyChainsForNounV2(nounId) {
  const nounEntry = nounIndex.nouns.find((n) => n.id === nounId);
  if (!nounEntry) return [];

  const chains = [];
  for (const { chunkKey, start, end, page } of nounEntry.offsets) {
    // 在全局 occurrence 列表中找到当前名词的位置
    let targetIdx = -1;
    for (let i = 0; i < globalNounOccurrences.length; i++) {
      const occ = globalNounOccurrences[i];
      if (occ.chunkKey === chunkKey && occ.start === start) {
        targetIdx = i;
        break;
      }
    }

    if (targetIdx === -1) continue;

    // 跨 chunk 取前后各 TOPOLOGY_WINDOW 个名词
    const beforeStart = Math.max(0, targetIdx - TOPOLOGY_WINDOW);
    const afterEnd = Math.min(globalNounOccurrences.length, targetIdx + 1 + TOPOLOGY_WINDOW);

    // 收集邻居（去重表面形式）
    const neighborSet = new Set();
    for (let i = beforeStart; i < afterEnd; i++) {
      if (i !== targetIdx) { // 排除目标名词自己
        neighborSet.add(globalNounOccurrences[i].nounSurface);
      }
    }

    if (neighborSet.size === 0) continue;

    // 拓扑链范围：从 beforeStart 到 afterEnd-1 的所有 occurrence
    // 按 chunkKey 分组，记录每个 chunk 内的 start/end 范围
    const chunkRanges = new Map(); // chunkKey -> { minStart, maxEnd, page }
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

    // 为每个涉及的 chunk 创建一条链记录
    for (const [ck, range] of chunkRanges) {
      chains.push({
        chunkKey: ck, // 链所在的 chunk
        page: range.page || 0,
        offset: ck === chunkKey ? start : -1, // 仅当是目标名词所在 chunk 时记录 offset
        neighbors: [...neighborSet],
        chainStart: range.minStart,
        chainEnd: range.maxEnd,
        involvedChunks: [...chunkRanges.keys()],
        crossChunk: chunkRanges.size > 1,
      });
    }
  }
  return chains;
}

// 合并拓扑链区间（每条 chain 已按 chunk 拆分，直接分组合并）
function mergeTopologyIntervals(chains) {
  if (chains.length === 0) return [];

  // 按 chunkKey 分组
  const byChunk = new Map();
  for (const chain of chains) {
    if (!byChunk.has(chain.chunkKey)) byChunk.set(chain.chunkKey, []);
    byChunk.get(chain.chunkKey).push({
      chainStart: chain.chainStart,
      chainEnd: chain.chainEnd,
      page: chain.page,
    });
  }

  // 每组内按 chainStart 排序，合并重叠区间
  const merged = [];
  for (const [chunkKey, intervals] of byChunk) {
    intervals.sort((a, b) => a.chainStart - b.chainStart);

    let curStart = intervals[0].chainStart;
    let curEnd = intervals[0].chainEnd;
    let curPage = intervals[0].page;

    for (let i = 1; i < intervals.length; i++) {
      const { chainStart, chainEnd, page } = intervals[i];
      if (chainStart <= curEnd) {
        // 重叠或相邻，合并
        curEnd = Math.max(curEnd, chainEnd);
      } else {
        // 不重叠，保存当前区间，开新区间
        merged.push({ chunkKey, chainStart: curStart, chainEnd: curEnd, page: curPage });
        curStart = chainStart;
        curEnd = chainEnd;
        curPage = page;
      }
    }
    merged.push({ chunkKey, chainStart: curStart, chainEnd: curEnd, page: curPage });
  }

  return merged;
}

// 按区间召回原文
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

// 旧函数保留（兼容），但主流程改用新架构
function getTopologyBookKeys(nounId) {
  const chains = buildTopologyChainsForNounV2(nounId);
  const bookKeys = new Set();
  for (const c of chains) if (c.chunkKey) bookKeys.add(c.chunkKey);
  return { chains, bookKeys: [...bookKeys] };
}

function recallByBookKey(chunkKey) {
  const entry = chunkByKey.get(chunkKey);
  return entry ? entry.text : null;
}

// ============ 主流程 ============
async function main() {
  const qList = questions.filter((q) => !QUESTION_IDS.length || QUESTION_IDS.includes(q.id));
  console.log(`========== 拓扑链召回引擎（两步架构）==========`);
  console.log(`全量名词: ${nounIndex.nouns.length}, 问题数: ${qList.length}`);
  console.log(`Token预算分批: 最多${MAX_PROMPT_TOKENS} tokens/批次, 并发: ${CONCURRENCY}, 拓扑窗口: ${TOPOLOGY_WINDOW} 名词, 分数阈值: ${SCORE_THRESHOLD}\n`);

  // 增量安全：保留未参与本次运行的其他题目结果
  let preserved = [];
  if (fs.existsSync(OUTPUT_PATH)) {
    try {
      const existing = JSON.parse(fs.readFileSync(OUTPUT_PATH, 'utf-8'));
      const targetIds = new Set(qList.map((q) => q.id));
      preserved = existing.filter((e) => e && !targetIds.has(e.questionId));
      if (preserved.length > 0) {
        console.log(`保留 ${preserved.length} 个未参与本次运行的结果:`);
        preserved.forEach((e) => console.log(`  - ${e.questionId}`));
      }
    } catch (e) {
      console.warn(`读取已有 ${OUTPUT_PATH} 失败: ${e.message}`);
    }
  }

  const allResults = [...preserved];

  // 同题串行：每个 questionId 独占一个时段，最大化 prompt-cache 命中率
  // 题间顺序执行（for 循环），题内批次并发（CONCURRENCY 控制）
  // 精打阶段同样：攒满一轮精打批次再一起并发，保证精打缓存命中率
  for (const q of qList) {
    console.log(`\n--- [${q.id}] ${q.question} ---`);
    const t0 = Date.now();

    // ---- 第一阶段：粗筛（同题独占并发池）----
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
          const res = await callLLM(prompt, { maxTokens: MAX_COARSE_OUTPUT_TOKENS, questionId: q.id });
          if (res?.usage) {
            coarsePromptTokens += res.usage.prompt_tokens || 0;
            coarseCompletionTokens += res.usage.completion_tokens || 0;
          }
          if (res?.truncated) coarseTruncated++;
          if (!res) coarseFailedBatches++;
          const yesIndices = parseCoarseResult(res?.text || '', b.batchNouns.length);
          for (const localIdx of yesIndices) coarseYes.set(b.startIdx + localIdx, true);
          process.stdout.write(`\r  粗筛: ${coarseYes.size} 个 YES / ${nounIndex.nouns.length}, 批次 ${myIdx + 1}/${coarseBatches.length}          `);
        }
      })
    );

    console.log(`\n  粗筛完成: ${coarseYes.size}/${nounIndex.nouns.length} 个相关词 (失败: ${coarseFailedBatches}/${coarseBatches.length})`);
    console.log(`  粗筛 tokens: prompt=${coarsePromptTokens} completion=${coarseCompletionTokens}`);
    if (coarseTruncated > 0) console.log(`  ⚠️  粗筛截断: ${coarseTruncated}/${coarseBatches.length} 批次`);

    // ---- 第二阶段：精打（攒满一轮粗筛结果后再并发，保证精打缓存）----
    const yesEntries = [...coarseYes.keys()].map((globalIdx) => nounIndex.nouns[globalIdx]);
    const scored = new Map();
    let scorePromptTokens = 0, scoreCompletionTokens = 0;

    if (yesEntries.length === 0) {
      console.log('  粗筛无 YES 词，跳过精打');
    } else {
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
            const res = await callLLM(prompt, { maxTokens: MAX_SCORE_OUTPUT_TOKENS, questionId: q.id });
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
            process.stdout.write(`\r  精打: ${scored.size}/${yesEntries.length} 个已打分, 批次 ${myIdx + 1}/${scoreBatches.length}          `);
          }
        })
      );

      console.log(`\n  精打完成: ${scored.size}/${yesEntries.length} 个已打分`);
      console.log(`  精打 tokens: prompt=${scorePromptTokens} completion=${scoreCompletionTokens}`);
      if (scoreTruncated > 0) console.log(`  ⚠️  精打截断: ${scoreTruncated}/${scoreBatches.length} 批次`);
    }

    // ---- 分数过滤 + 排序 + Top 80 截断 ----
    const scoredList = [...scored.entries()]
      .map(([nounId, score]) => {
        const n = nounIndex.nouns.find((x) => x.id === nounId);
        return n ? { id: n.id, surface: n.surface, df: n.offsets.length, score } : null;
      })
      .filter(Boolean)
      .sort((a, b) => b.score - a.score);

    // 分数阈值过滤：只保留 score >= SCORE_THRESHOLD 的名词
    const highScoredList = scoredList.filter((item) => item.score >= SCORE_THRESHOLD);

    // Top 80 截断：按分数降序取前 80 个名词（控制拓扑链爆炸 + 召回量）
    const TOP_N_NOUNS = 80;
    const topNouns = highScoredList.slice(0, TOP_N_NOUNS);

    const lostCount = yesEntries.length - scored.size;
    if (lostCount > 0) {
      console.log(`  ⚠️  精打解析丢失: ${lostCount}/${yesEntries.length} 个词 (${((lostCount / yesEntries.length) * 100).toFixed(1)}%)`);
    }

    const totalPromptTokens = coarsePromptTokens + scorePromptTokens;
    const totalCompletionTokens = coarseCompletionTokens + scoreCompletionTokens;

    console.log(`  Top 10: ${scoredList.slice(0, 10).map((s) => `${s.surface}(${s.score})`).join(', ')}`);
    console.log(`  高分词(score>=${SCORE_THRESHOLD}): ${highScoredList.length}/${scoredList.length} 个, 取前 ${topNouns.length} 个构建拓扑`);

    // ---- 新拓扑链架构：Top N 高分名词 → 拓扑链区间并集 → 区间召回 ----
    const allChains = [];
    const highScoredDetails = [];

    for (const item of topNouns) {
      const chains = buildTopologyChainsForNounV2(item.id);
      allChains.push(...chains);
      highScoredDetails.push({
        id: item.id,
        surface: item.surface,
        score: item.score,
        df: item.df,
        chainCount: chains.length,
        chainSample: chains.slice(0, 2).map((c) => ({
          page: c.page,
          neighbors: c.neighbors,
          chainStart: c.chainStart,
          chainEnd: c.chainEnd,
        })),
      });
    }

    // 区间去重取并集
    const mergedIntervals = mergeTopologyIntervals(allChains);

    // 按区间召回原文
    const recalledTexts = recallByIntervals(mergedIntervals);

    const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
    const result = {
      questionId: q.id,
      question: q.question,
      zone: q.zone,
      totalNouns: nounIndex.nouns.length,
      coarseYesCount: coarseYes.size,
      scoredCount: scored.size,
      selectedCount: scoredList.length,
      highScoredCount: highScoredList.length,
      scoreThreshold: SCORE_THRESHOLD,
      failedBatches: coarseFailedBatches,
      tokenCost: {
        coarsePromptTokens,
        coarseCompletionTokens,
        scorePromptTokens,
        scoreCompletionTokens,
        totalPromptTokens,
        totalCompletionTokens,
      },
      elapsedSecs: parseFloat(elapsed),
      scoredNouns: scoredList,
      highScoredNouns: highScoredDetails,
      mergedTopologyIntervals: mergedIntervals,
      recalledTexts,
    };

    allResults.push(result);
    console.log(`  拓扑链总数: ${allChains.length}, 合并后区间: ${mergedIntervals.length}, 召回文本块: ${recalledTexts.length}, 耗时: ${elapsed}s`);

    fs.writeFileSync(OUTPUT_PATH, JSON.stringify(allResults, null, 2), 'utf-8');
    console.log(`  已增量保存到: ${OUTPUT_PATH}`);
  }

  console.log(`\n完成，结果已保存: ${OUTPUT_PATH}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
