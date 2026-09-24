/**
 * s1 LLM 兜底补缺脚本 —— 实验组一（无兜底：仅截断原始区间内匹配）
 *
 * 与 s1-llm-fill.js 逻辑完全一致，唯一新增：
 *   - 每次 LLM 调用后，将该批次的完整输入（prompt / 各截断的 chunkKey+区间+文本）
 *     和输出（LLM 原始返回文本 + 解析结果）快照写入 s1-snapshots-group1/batch-<id>.json
 *   - 供人工按批次核对：LLM 用【【N】】机器符码引用的截断内容，
 *     与该批次实际喂给它的第 N 个截断文本是否一致。
 *
 * 输出: s1-nouns-with-offsets-group1.json
 * 快照: s1-snapshots-group1/batch-<batchId>.json
 */

import fs from 'fs';
import path from 'path';
import { buildPureTextTable } from './src/core/pureTextTable.js';
import { callLLM } from './src/core/llmClient.js';

const REPORT_PATH = process.env.REPORT_PATH || path.join(process.cwd(), 's0-quality-report.json');
const S0_HITS_PATH = process.env.S0_HITS_PATH || path.join(process.cwd(), 's0-hits.json');
const DOCUVERSE_PATH = process.env.DOCUVERSE_PATH || path.join(process.cwd(), 'docuverse_cartographies_squizoanalythiques_Fe_lix_Guattari_1789114122714.docuverse.json');
const OUTPUT_PATH = path.join(process.cwd(), 's1-nouns-with-offsets-group1.json');
const SNAPSHOT_DIR = path.join(process.cwd(), 's1-snapshots-group1');

if (!fs.existsSync(SNAPSHOT_DIR)) fs.mkdirSync(SNAPSHOT_DIR, { recursive: true });

// ---------- 并行控制 ----------
const CONCURRENCY = parseInt(process.env.LLM_CONCURRENCY || '5', 10);
const LIMIT = process.env.LIMIT ? parseInt(process.env.LIMIT, 10) : Infinity;
const MAX_TOKENS_PER_CALL = 32768; // V4-Flash 384K 输出上限

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

const CHARS_PER_TOKEN = 3.5;
const MAX_PROMPT_TOKENS = 2500;

function estimatePromptTokens(text) {
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

function splitIntoTokenBoundedBatches(truncations) {
  const batches = [];
  let currentBatch = [];
  let currentPromptTokens = 0;

  for (const trunc of truncations) {
    const sectionText = `【【${currentBatch.length + 1}】】\n${trunc.text}`;
    const additionalTokens = estimatePromptTokens(sectionText);
    const estimatedTotal = currentPromptTokens + additionalTokens;

    if (currentBatch.length > 0 && estimatedTotal > MAX_PROMPT_TOKENS) {
      batches.push([...currentBatch]);
      currentBatch = [trunc];
      currentPromptTokens = estimatePromptTokens(`【【1】】\n${trunc.text}`);
    } else {
      currentBatch.push(trunc);
      currentPromptTokens += additionalTokens;
    }
  }

  if (currentBatch.length > 0) {
    batches.push(currentBatch);
  }

  return batches;
}

function parseBatchLLMOutput(rawOutput, batchSize, batchIdForDebug) {
  if (!rawOutput || typeof rawOutput !== 'string') return [];
  const text = rawOutput.trim();

  if (/^【【\s*】\s*】$/.test(text)) return [];

  const results = [];
  const seen = new Set();

  function pushEntry(truncId, nouns) {
    if (seen.has(truncId)) return;
    if (truncId < 1 || truncId > batchSize) return;
    seen.add(truncId);
    const clean = (Array.isArray(nouns) ? nouns : [nouns])
      .map((n) => (typeof n === 'string' ? n.trim() : ''))
      .filter((n) => n.length >= 2);
    results.push({ trunc_id: truncId, nouns: clean });
  }

  function parseRefValue(ref) {
    if (typeof ref === 'number') return ref;
    if (typeof ref !== 'string') return NaN;
    const m = ref.match(/(\d+)/);
    return m ? parseInt(m[1], 10) : NaN;
  }

  const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  let jsonText = codeBlockMatch ? codeBlockMatch[1] : '';
  if (!jsonText) {
    const arrMatch = text.match(/\[[\s\S]*\]/);
    if (arrMatch) jsonText = arrMatch[0];
  }

  if (jsonText) {
    try {
      let fixed = jsonText.trim();
      const openBrackets = (fixed.match(/\[/g) || []).length;
      const closeBrackets = (fixed.match(/\]/g) || []).length;
      const openBraces = (fixed.match(/\{/g) || []).length;
      const closeBraces = (fixed.match(/\}/g) || []).length;
      if (openBrackets > closeBrackets) {
        if (openBraces > closeBraces) fixed += '}';
        fixed += ']';
      }
      const parsed = JSON.parse(fixed);
      if (Array.isArray(parsed)) {
        for (const item of parsed) {
          if (!item || typeof item !== 'object') continue;
          const ref = item.i ?? item.trunc_id ?? item.id ?? item.index;
          const truncId = parseRefValue(ref);
          if (!Number.isFinite(truncId)) continue;
          const nouns = item.nouns ?? item.w ?? item.words ?? [];
          pushEntry(truncId, nouns);
        }
        if (results.length > 0) return results;
      }
    } catch (err) {
      // continue fallback
    }
  }

  for (const m of text.matchAll(/【+(\d+)】+[^\n]*?[:：]\s*([^\n]+)/g)) {
    const truncId = parseInt(m[1], 10);
    const nouns = m[2]
      .split(/[,，;；\n|]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    pushEntry(truncId, nouns);
  }

  if (results.length === 0) {
    const refs = [...text.matchAll(/【+(\d+)】+/g)];
    for (let i = 0; i < refs.length; i++) {
      const truncId = parseInt(refs[i][1], 10);
      if (truncId < 1 || truncId > batchSize) continue;
      const start = refs[i].index + refs[i][0].length;
      const end = i + 1 < refs.length ? refs[i + 1].index : text.length;
      const between = text.slice(start, end);
      const tokens = between
        .split(/[,，;；\s\n|·•]+/)
        .map((s) => s.trim().replace(/^[:：\.\-]+|[:：\.\-]+$/g, ''))
        .filter((s) => s.length >= 2);
      pushEntry(truncId, tokens);
    }
  }

  if (results.length === 0) {
    console.warn(`[批次 ${batchIdForDebug}] LLM输出无法解析，返回空结果`);
  }

  return results;
}

function isValidNoun(noun) {
  const trimmed = noun.trim();
  
  if (trimmed.length < 3 && !/^[A-Z]{2,}$/.test(trimmed)) {
    return false;
  }
  
  if (/^[\d\s\p{P}]+$/u.test(trimmed)) {
    return false;
  }
  
  const stopwords = [
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
    'of', 'the', 'a', 'an', 'and', 'or', 'to', 'in', 'on', 'at', 'by', 'for', 'with',
    'is', 'are', 'was', 'were', 'be', 'been', 'have', 'has', 'had',
  ];
  if (stopwords.includes(trimmed.toLowerCase())) {
    return false;
  }
  
  if (trimmed.length === 1 && !/[A-Z]/.test(trimmed)) {
    return false;
  }
  
  return true;
}

// 实验组一定位算法：仅在截断原始区间 [truncStart, truncEnd) 内匹配
function locateNounInChunkText(noun, chunkText, truncStart, truncEnd, s0HitIntervalsInChunk = []) {
  if (!isValidNoun(noun)) {
    return [];
  }

  const needle = noun.toLowerCase().trim();
  const offsets = [];

  const searchRegion = chunkText.slice(truncStart, truncEnd);
  const searchRegionLower = searchRegion.toLowerCase();

  let from = 0;
  while (from < searchRegionLower.length) {
    const at = searchRegionLower.indexOf(needle, from);
    if (at < 0) break;

    const localStart = truncStart + at;
    const localEnd = localStart + needle.length;

    const overlapsS0 = s0HitIntervalsInChunk.some((interval) => {
      return !(localEnd <= interval.start || localStart >= interval.end);
    });

    if (!overlapsS0) {
      offsets.push({ start: localStart, end: localEnd, confidence: 'high' });
    }

    from = at + needle.length;
  }

  return offsets;
}

async function processBatchesParallel(batches, concurrency, chunkTextByKey, s0HitsByChunk) {
  const results = [];
  const queue = [...batches];
  let completed = 0;

  const workers = Array.from({ length: concurrency }, async (_, workerId) => {
    while (queue.length > 0) {
      const batch = queue.shift();
      if (!batch) break;

      try {
        const prompt = buildBatchPrompt(batch.truncations);
        const res = await callLLM(prompt, { maxTokens: MAX_TOKENS_PER_CALL, temperature: 0 });
        if (!res) throw new Error('LLM 返回 null（重试耗尽）');

        const text = res.text || '';
        const parsed = parseBatchLLMOutput(text, batch.truncations.length, batch.batchId);

        // 🔍 快照：保存该批次的完整输入输出 + 定位结果
        const snapshot = {
          experimentGroup: '实验组一（无兜底）',
          batchId: batch.batchId,
          timestamp: new Date().toISOString(),
          prompt,
          truncations: batch.truncations.map((trunc, idx) => ({
            truncId: idx + 1,
            machineCode: `【【${idx + 1}】】`,
            chunkKey: trunc.chunkKey,
            start: trunc.start,
            end: trunc.end,
            page: trunc.page,
            text: trunc.text,
          })),
          llmRawOutput: text,
          parsedNouns: [],
        };

        // 为每个提取的名词记录定位结果
        for (const item of parsed) {
          const truncIndex = item.trunc_id - 1;
          if (truncIndex < 0 || truncIndex >= batch.truncations.length) continue;

          const trunc = batch.truncations[truncIndex];
          const chunkText = chunkTextByKey.get(trunc.chunkKey);
          if (!chunkText) continue;

          const s0HitIntervalsInChunk = s0HitsByChunk.get(trunc.chunkKey) || [];

          for (const noun of item.nouns) {
            const offsets = locateNounInChunkText(
              noun,
              chunkText,
              trunc.start,
              trunc.end,
              s0HitIntervalsInChunk
            );

            snapshot.parsedNouns.push({
              truncId: item.trunc_id,
              machineCode: `【【${item.trunc_id}】】`,
              noun,
              found: offsets.length > 0,
              offsets: offsets.map(off => ({
                start: off.start,
                end: off.end,
                confidence: off.confidence,
              })),
            });
          }
        }

        // 写入快照文件
        const snapshotPath = path.join(SNAPSHOT_DIR, `batch-${batch.batchId}.json`);
        fs.writeFileSync(snapshotPath, JSON.stringify(snapshot, null, 2), 'utf-8');

        completed++;
        const truncWarn = res.truncated ? ' ⚠️ 截断!' : '';
        const tok = res.usage
          ? ` (prompt=${res.usage.prompt_tokens ?? '-'} completion=${res.usage.completion_tokens ?? '-'})`
          : '';
        console.log(`[Worker ${workerId}] 批次 ${batch.batchId} 完成 (${completed}/${batches.length})${tok}${truncWarn}`);

        results.push({
          batchId: batch.batchId,
          parsed,
          ok: true,
          usage: res.usage || null,
          truncated: !!res.truncated,
        });
      } catch (err) {
        console.error(`[Worker ${workerId}] 批次 ${batch.batchId} 失败:`, err.message);
        results.push({ batchId: batch.batchId, ok: false, error: err.message });
      }
    }
  });

  await Promise.all(workers);
  return results;
}

async function main() {
  console.log('========== 实验组一：无兜底算法（仅截断原始区间内匹配）==========');
  console.log(`快照输出: ${SNAPSHOT_DIR}\n`);

  const report = JSON.parse(fs.readFileSync(REPORT_PATH, 'utf-8'));
  const missedNounSamples = report.residuals || [];

  if (missedNounSamples.length === 0) {
    console.log('无剩余残留区间，无需补缺');
    process.exit(0);
  }

  let s0HitIntervals = [];
  try {
    const s0Hits = JSON.parse(fs.readFileSync(S0_HITS_PATH, 'utf-8'));
    s0HitIntervals = s0Hits.hitsByChunk || [];
    console.log(`加载 s0 命中位置表: ${s0HitIntervals.length} 个 chunk\n`);
  } catch (err) {
    console.warn(`⚠️  无法加载 s0-hits.json (${err.message})\n`);
  }

  const truncationsToProcess = Number.isFinite(LIMIT) ? missedNounSamples.slice(0, LIMIT) : missedNounSamples;
  console.log(`处理截断: ${truncationsToProcess.length} 个\n`);

  const docuverse = JSON.parse(fs.readFileSync(DOCUVERSE_PATH, 'utf-8'));
  const pureTextTable = buildPureTextTable(docuverse.bookIndex);
  const chunkEntries = pureTextTable.entries;
  const chunkTextByKey = new Map(chunkEntries.map((e) => [e.chunkKey, e.text]));
  console.log(`纯文表: ${chunkEntries.length} 个 chunk\n`);

  const s0HitsByChunk = new Map();
  for (const group of s0HitIntervals) {
    if (group.chunkKey) s0HitsByChunk.set(group.chunkKey, group.hits || []);
  }

  const tokenBoundedBatches = splitIntoTokenBoundedBatches(truncationsToProcess);
  const batches = tokenBoundedBatches.map((truncations, i) => ({
    batchId: i + 1,
    truncations,
  }));

  console.log(`分批: ${batches.length} 批\n`);
  console.log('开始调用 LLM...\n');

  const startTime = Date.now();
  const batchResults = await processBatchesParallel(batches, CONCURRENCY, chunkTextByKey, s0HitsByChunk);
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  let totalPromptTokens = 0;
  let totalCompletionTokens = 0;
  let truncatedBatches = 0;
  let failedBatches = 0;
  for (const r of batchResults) {
    if (!r.ok) { failedBatches++; continue; }
    if (r.truncated) truncatedBatches++;
    if (r.usage) {
      totalPromptTokens += r.usage.prompt_tokens || 0;
      totalCompletionTokens += r.usage.completion_tokens || 0;
    }
  }

  const s1Nouns = new Map();

  for (const batchResult of batchResults) {
    if (!batchResult.ok) continue;

    const batch = batches.find((b) => b.batchId === batchResult.batchId);
    if (!batch) continue;

    for (const item of batchResult.parsed) {
      const truncIndex = item.trunc_id - 1;
      if (truncIndex < 0 || truncIndex >= batch.truncations.length) continue;

      const trunc = batch.truncations[truncIndex];
      const chunkKey = trunc.chunkKey;
      const chunkText = chunkTextByKey.get(chunkKey);
      if (!chunkText) continue;

      const s0HitIntervalsInChunk = s0HitsByChunk.get(chunkKey) || [];

      for (const noun of item.nouns) {
        const id = noun.toLowerCase().trim().replace(/\s+/g, '_');
        if (id.length < 2) continue;

        const offsets = locateNounInChunkText(
          noun,
          chunkText,
          trunc.start,
          trunc.end,
          s0HitIntervalsInChunk
        );

        if (offsets.length === 0) continue;

        if (!s1Nouns.has(id)) {
          s1Nouns.set(id, {
            id,
            surface: noun,
            offsets: [],
            sourceTruncIds: [],
          });
        }

        const entry = s1Nouns.get(id);
        entry.offsets.push(...offsets.map(off => ({
          chunkKey,
          start: off.start,
          end: off.end,
          page: trunc.page,
          confidence: off.confidence,
        })));
        entry.sourceTruncIds.push(`${chunkKey}-${trunc.start}`);
      }
    }
  }

  const confidenceStats = { high: 0, medium: 0, low: 0 };

  for (const entry of s1Nouns.values()) {
    const uniqueOffsets = new Map();
    for (const offset of entry.offsets) {
      const key = `${offset.chunkKey}-${offset.start}-${offset.end}`;
      uniqueOffsets.set(key, offset);
      confidenceStats[offset.confidence] = (confidenceStats[offset.confidence] || 0) + 1;
    }
    entry.offsets = [...uniqueOffsets.values()].sort((a, b) =>
      a.chunkKey.localeCompare(b.chunkKey) || a.start - b.start
    );
    entry.sourceTruncIds = [...new Set(entry.sourceTruncIds)].sort();
  }

  const s1Entries = [...s1Nouns.values()].sort((a, b) => b.offsets.length - a.offsets.length || a.id.localeCompare(b.id));

  const output = {
    meta: {
      experimentGroup: '实验组一（无兜底）',
      snapshotDir: SNAPSHOT_DIR,
      locateAlgorithm: '仅在截断原始区间 [truncStart, truncEnd) 内匹配，无扩窗，无全 chunk 兜底',
      llmModel: process.env.LLM_MODEL || 'deepseek-chat',
      temperature: 0,
      thinking: 'disabled',
      tokenUsage: {
        promptTokens: totalPromptTokens,
        completionTokens: totalCompletionTokens,
        totalTokens: totalPromptTokens + totalCompletionTokens,
      },
      batchStats: {
        total: batchResults.length,
        ok: batchResults.filter((r) => r.ok).length,
        failed: failedBatches,
        truncated: truncatedBatches,
      },
      inputTruncations: truncationsToProcess.length,
      outputNouns: s1Entries.length,
      totalOffsets: s1Entries.reduce((sum, e) => sum + e.offsets.length, 0),
      elapsedSeconds: parseFloat(elapsed),
      confidenceStats,
    },
    nouns: s1Entries,
  };

  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 2), 'utf-8');

  console.log('\n========== 实验组一完成 ==========');
  console.log(`补缺名词: ${s1Entries.length} 个`);
  console.log(`总命中位置: ${output.meta.totalOffsets} 处`);
  console.log(`置信度: 高=${confidenceStats.high}, 中=${confidenceStats.medium}, 低=${confidenceStats.low}`);
  console.log(`输出文件: ${OUTPUT_PATH}`);
  console.log(`快照文件: ${SNAPSHOT_DIR} (${batches.length} 个批次)`);
}

main().catch((err) => {
  console.error('执行失败:', err);
  process.exit(1);
});
