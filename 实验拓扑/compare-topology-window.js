/**
 * 拓扑链窗口对比实验
 * 
 * 目标：对比 TOPOLOGY_WINDOW=1 vs 2，统计召回 chunk 去重后的字符数
 * 
 * 不调用 API，直接读取 noun-recall-results.json 的打分结果，
 * 基于同一批高分词，用不同窗口参数重新计算拓扑链和召回量。
 * 
 * 用法：
 *   node 实验拓扑/compare-topology-window.js
 */

import fs from 'fs';
import path from 'path';
import { atomSearchText, isRetrievableAtom } from '../src/core/pureTextTable.js';

// ============ 配置 ============
const DOCUVERSE_PATH = process.env.DOCUVERSE_PATH || 'C:\\Users\\Administrator\\Desktop\\docuverse_cartographies_squizoanalythiques_Fe_lix_Guattari_1789114122714.docuverse.json';
const NOUN_INDEX_PATH = process.env.NOUN_INDEX_PATH || path.join(process.cwd(), 'final-noun-index.json');
const RECALL_RESULTS_PATH = process.env.RECALL_RESULTS_PATH || path.join(process.cwd(), 'noun-recall-results.json');
const OUTPUT_PATH = path.join(process.cwd(), '实验拓扑', 'window-comparison-report.json');

const WINDOWS_TO_COMPARE = [1, 2]; // 对比窗口 1 和 2
const SCORE_THRESHOLD = 80; // 与 recall-nouns-llm.js 保持一致
const TOP_N_NOUNS = 80; // 与 recall-nouns-llm.js 保持一致

console.log('拓扑链窗口对比实验');
console.log('='.repeat(60));
console.log(`对比窗口: ${WINDOWS_TO_COMPARE.join(' vs ')}`);
console.log(`分数阈值: ${SCORE_THRESHOLD}, Top N: ${TOP_N_NOUNS}\n`);

// ============ 加载数据 ============
console.log('加载数据...');
const docuverse = JSON.parse(fs.readFileSync(DOCUVERSE_PATH, 'utf-8'));
const nounIndex = JSON.parse(fs.readFileSync(NOUN_INDEX_PATH, 'utf-8'));
const recallResults = JSON.parse(fs.readFileSync(RECALL_RESULTS_PATH, 'utf-8'));

// 构建 chunk 查询表
const chunkByKey = new Map();
for (const chunk of docuverse.bookIndex.chunks) {
  if (!isRetrievableAtom(chunk)) continue;
  const text = atomSearchText(chunk).trim();
  if (!text || text.length < 8) continue;
  chunkByKey.set(chunk.key, {
    chunkKey: chunk.key,
    page: chunk.page,
    text,
  });
}

console.log(`  chunk 数: ${chunkByKey.size}`);
console.log(`  名词数: ${nounIndex.nouns.length}`);
console.log(`  已有召回结果问题数: ${recallResults.length}\n`);

// ============ 构建全局名词序列（按阅读序） ============
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
  occurrences.sort((a, b) => {
    if (a.page !== b.page) return a.page - b.page;
    if (a.chunkKey !== b.chunkKey) return a.chunkKey.localeCompare(b.chunkKey);
    return a.start - b.start;
  });
  return occurrences;
}

const globalNounOccurrences = buildGlobalNounOccurrences();
console.log(`  全局名词出现次数: ${globalNounOccurrences.length}\n`);

// ============ 拓扑链构建（参数化窗口） ============
function buildTopologyChainsWithWindow(nounId, windowSize) {
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

    const beforeStart = Math.max(0, targetIdx - windowSize);
    const afterEnd = Math.min(globalNounOccurrences.length, targetIdx + 1 + windowSize);

    const neighborSet = new Set();
    for (let i = beforeStart; i < afterEnd; i++) {
      if (i !== targetIdx) {
        neighborSet.add(globalNounOccurrences[i].nounSurface);
      }
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
      chains.push({
        chunkKey: ck,
        page: range.page || 0,
        chainStart: range.minStart,
        chainEnd: range.maxEnd,
      });
    }
  }

  return chains;
}

// ============ 区间合并 ============
function mergeIntervals(chains) {
  if (chains.length === 0) return [];

  const byChunk = new Map();
  for (const c of chains) {
    if (!byChunk.has(c.chunkKey)) {
      byChunk.set(c.chunkKey, []);
    }
    byChunk.get(c.chunkKey).push({ start: c.chainStart, end: c.chainEnd, page: c.page });
  }

  const merged = [];
  for (const [ck, intervals] of byChunk) {
    intervals.sort((a, b) => a.start - b.start);
    const stack = [intervals[0]];
    for (let i = 1; i < intervals.length; i++) {
      const top = stack[stack.length - 1];
      if (intervals[i].start <= top.end) {
        top.end = Math.max(top.end, intervals[i].end);
      } else {
        stack.push(intervals[i]);
      }
    }
    for (const interval of stack) {
      merged.push({ chunkKey: ck, ...interval });
    }
  }

  return merged;
}

// ============ 召回文本 ============
function recallByIntervals(intervals) {
  const chunkKeys = new Set(intervals.map((iv) => iv.chunkKey));
  const recalled = [];
  for (const ck of chunkKeys) {
    const entry = chunkByKey.get(ck);
    if (entry) {
      recalled.push({
        chunkKey: ck,
        page: entry.page,
        text: entry.text,
        charCount: entry.text.length,
      });
    }
  }
  return recalled;
}

// ============ 主实验循环 ============
function runExperiment() {
  const comparisonResults = [];

  for (const result of recallResults) {
    console.log(`处理问题: ${result.questionId} - ${result.question}`);

    // 获取高分词（与原始逻辑一致：score >= 80，取前 80 个）
    const highScoredNouns = result.scoredNouns
      .filter((n) => n.score >= SCORE_THRESHOLD)
      .slice(0, TOP_N_NOUNS);

    console.log(`  高分词数: ${highScoredNouns.length}`);

    const windowResults = {};

    for (const windowSize of WINDOWS_TO_COMPARE) {
      const allChains = [];
      for (const noun of highScoredNouns) {
        const chains = buildTopologyChainsWithWindow(noun.id, windowSize);
        allChains.push(...chains);
      }

      const mergedIntervals = mergeIntervals(allChains);
      const recalledTexts = recallByIntervals(mergedIntervals);
      const totalChars = recalledTexts.reduce((sum, t) => sum + t.charCount, 0);
      const avgCharsPerChunk = recalledTexts.length > 0 ? Math.round(totalChars / recalledTexts.length) : 0;

      windowResults[`window_${windowSize}`] = {
        windowSize,
        chainCount: allChains.length,
        mergedIntervalCount: mergedIntervals.length,
        recalledChunkCount: recalledTexts.length,
        totalCharacters: totalChars,
        avgCharactersPerChunk: avgCharsPerChunk,
        recalledChunks: recalledTexts.map((t) => ({
          chunkKey: t.chunkKey,
          page: t.page,
          charCount: t.charCount,
        })),
      };

      console.log(`  窗口=${windowSize}: 链=${allChains.length}, 合并区间=${mergedIntervals.length}, 召回chunk=${recalledTexts.length}, 总字符=${totalChars}`);
    }

    // 计算差异
    const w1 = windowResults.window_1;
    const w2 = windowResults.window_2;
    const charDiff = w2.totalCharacters - w1.totalCharacters;
    const chunkDiff = w2.recalledChunkCount - w1.recalledChunkCount;
    const charDiffPercent = w1.totalCharacters > 0 ? ((charDiff / w1.totalCharacters) * 100).toFixed(1) : '0.0';
    const chunkDiffPercent = w1.recalledChunkCount > 0 ? ((chunkDiff / w1.recalledChunkCount) * 100).toFixed(1) : '0.0';

    console.log(`  差异: 字符 ${charDiff > 0 ? '+' : ''}${charDiff} (${charDiffPercent}%), chunk ${chunkDiff > 0 ? '+' : ''}${chunkDiff} (${chunkDiffPercent}%)\n`);

    comparisonResults.push({
      questionId: result.questionId,
      question: result.question,
      zone: result.zone,
      highScoredNounCount: highScoredNouns.length,
      highScoredNouns: highScoredNouns.map((n) => ({ id: n.id, surface: n.surface, score: n.score })),
      windowResults,
      difference: {
        characterDiff: charDiff,
        characterDiffPercent: parseFloat(charDiffPercent),
        chunkDiff,
        chunkDiffPercent: parseFloat(chunkDiffPercent),
      },
    });
  }

  return comparisonResults;
}

// ============ 执行并保存 ============
console.log('开始实验...\n');
const comparisonResults = runExperiment();

fs.writeFileSync(OUTPUT_PATH, JSON.stringify(comparisonResults, null, 2), 'utf-8');
console.log(`\n实验完成，结果已保存到: ${OUTPUT_PATH}`);

// ============ 统计汇总 ============
console.log('\n' + '='.repeat(60));
console.log('汇总统计');
console.log('='.repeat(60));

let totalCharDiff = 0;
let totalChunkDiff = 0;
let w1TotalChars = 0;
let w2TotalChars = 0;
let w1TotalChunks = 0;
let w2TotalChunks = 0;

for (const result of comparisonResults) {
  const w1 = result.windowResults.window_1;
  const w2 = result.windowResults.window_2;
  totalCharDiff += (w2.totalCharacters - w1.totalCharacters);
  totalChunkDiff += (w2.recalledChunkCount - w1.recalledChunkCount);
  w1TotalChars += w1.totalCharacters;
  w2TotalChars += w2.totalCharacters;
  w1TotalChunks += w1.recalledChunkCount;
  w2TotalChunks += w2.recalledChunkCount;
}

const avgCharDiff = (totalCharDiff / comparisonResults.length).toFixed(0);
const avgChunkDiff = (totalChunkDiff / comparisonResults.length).toFixed(1);
const overallCharDiffPercent = w1TotalChars > 0 ? ((totalCharDiff / w1TotalChars) * 100).toFixed(1) : '0.0';
const overallChunkDiffPercent = w1TotalChunks > 0 ? ((totalChunkDiff / w1TotalChunks) * 100).toFixed(1) : '0.0';

console.log(`问题总数: ${comparisonResults.length}`);
console.log(`窗口=1 平均: ${(w1TotalChars / comparisonResults.length).toFixed(0)} 字符, ${(w1TotalChunks / comparisonResults.length).toFixed(1)} chunks`);
console.log(`窗口=2 平均: ${(w2TotalChars / comparisonResults.length).toFixed(0)} 字符, ${(w2TotalChunks / comparisonResults.length).toFixed(1)} chunks`);
console.log(`平均差异: ${avgCharDiff} 字符/问题 (${overallCharDiffPercent}%), ${avgChunkDiff} chunks/问题 (${overallChunkDiffPercent}%)`);
console.log(`\n详细对比报告已保存到: ${OUTPUT_PATH}`);
