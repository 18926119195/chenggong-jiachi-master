/**
 * 检查拓扑链区间是否覆盖否定词等语义修饰词
 *
 * 步骤：
 * 1. 扫描所有 chunk 文本，找出法语否定词的位置
 * 2. 对每个否定词，找到其后方最近的名词（被修饰对象）
 * 3. 计算该名词的拓扑链区间（左边界）
 * 4. 判断否定词是否在区间内
 *
 * 用法：
 *   node check-negation-coverage.cjs
 */

import fs from 'fs';
import path from 'path';

const DOCUVERSE_PATH = process.env.DOCUVERSE_PATH || 'C:\\Users\\Administrator\\Desktop\\docuverse_cartographies_squizoanalythiques_Fe_lix_Guattari_1789114122714.docuverse.json';
const NOUN_INDEX_PATH = process.env.NOUN_INDEX_PATH || path.join(process.cwd(), 'final-noun-index.json');
const BLACKLIST_PATH = process.env.NOUN_BLACKLIST_PATH || path.join(process.cwd(), 'noun-blacklist.json');
const TOPOLOGY_WINDOW = parseInt(process.env.TOPOLOGY_WINDOW || '2', 10);

// ============ 法语否定词列表 ============
const NEGATION_PATTERNS = [
  // 独立否定词
  { word: 'ne',      is_prefix: false },
  { word: 'n\'',     is_prefix: true  },
  { word: 'pas',     is_prefix: false },
  { word: 'plus',    is_prefix: false },
  { word: 'jamais',  is_prefix: false },
  { word: 'rien',    is_prefix: false },
  { word: 'personne',is_prefix: false },
  { word: 'aucun',   is_prefix: false },
  { word: 'ni',      is_prefix: false },
  { word: 'guère',   is_prefix: false },
  { word: 'point',   is_prefix: false },
  { word: 'nul',     is_prefix: false },
  { word: 'nulle',   is_prefix: false },
  { word: 'nuls',    is_prefix: false },
  { word: 'nulles',  is_prefix: false },
  { word: 'n\'',     is_prefix: true  }, // n' (before vowel)
  // 常见组合（ne + 什么）
  { word: 'ne ',     is_prefix: false },
];

// 法语否定词的 regex（区分前缀 n' 和普通词）
function buildNegationRegex() {
  // n' 开头的缩写形式（如 n'existe, n'est, n'a, n'importe）
  // 排除 n 的其他用法（数字等）
  const prefix_neg = /\bn\s*['\u2019]/gi;  // n' 或 n'
  const standalone_neg = /\b(?:ne|pas|plus|jamais|rien|personne|aucun|ni|guère|point|nul|nulle|nuls|nulles)\b/gi;
  return { prefix_neg, standalone_neg };
}

// ============ 加载数据 ============
console.log('加载数据...');
const docuverse = JSON.parse(fs.readFileSync(DOCUVERSE_PATH, 'utf-8'));
const nounIndex = JSON.parse(fs.readFileSync(NOUN_INDEX_PATH, 'utf-8'));

// 构建黑名单 set（模拟过滤）
let blacklistedSurfaces = new Set();
if (fs.existsSync(BLACKLIST_PATH)) {
  const bl = JSON.parse(fs.readFileSync(BLACKLIST_PATH, 'utf-8'));
  blacklistedSurfaces = new Set(bl.blacklist || []);
}

// 构建 noun surface → entries 映射
const nounSurfaceMap = new Map();
for (const noun of nounIndex.nouns) {
  if (!nounSurfaceMap.has(noun.surface)) nounSurfaceMap.set(noun.surface, []);
  nounSurfaceMap.get(noun.surface).push(noun);
}

// 构建 chunkKey → chunk.text 映射
const chunkByKey = new Map();
for (const chunk of docuverse.bookIndex.chunks) {
  chunkByKey.set(chunk.key, chunk.content || '');
}

// 构建 globalNounOccurrences（带黑名单过滤的版本）
function buildGlobalOccurrences(filterBlacklist) {
  const occs = [];
  for (const noun of nounIndex.nouns) {
    if (filterBlacklist && blacklistedSurfaces.has(noun.surface)) continue;
    for (const offset of noun.offsets) {
      occs.push({
        chunkKey: offset.chunkKey,
        start: offset.start,
        end: offset.end,
        surface: noun.surface,
        nounId: noun.id,
      });
    }
  }
  // 按 page/offset 排序（近似全局阅读序）
  occs.sort((a, b) => a.chunkKey.localeCompare(b.chunkKey) || a.start - b.start);
  return occs;
}

const occFiltered = buildGlobalOccurrences(true);
const occUnfiltered = buildGlobalOccurrences(false);

// 构建 chunk 内 offset → occurrence 映射（快速查找）
function buildChunkOccMap(occs) {
  const m = new Map(); // chunkKey -> { start -> occ }
  for (const occ of occs) {
    if (!m.has(occ.chunkKey)) m.set(occ.chunkKey, new Map());
    m.get(occ.chunkKey).set(occ.start, occ);
  }
  return m;
}

const chunkOccMapFiltered = buildChunkOccMap(occFiltered);
const chunkOccMapUnfiltered = buildChunkOccMap(occUnfiltered);

// ============ 找否定词 + 后方名词 ============
function findNegationsInChunk(chunkKey, text) {
  const results = [];
  const { prefix_neg, standalone_neg } = buildNegationRegex();

  // 找所有匹配
  const matches = [];

  // 前缀形式 n'
  let m;
  const prefixRe = /\bn\s*['\u2019]/gi;
  while ((m = prefixRe.exec(text)) !== null) {
    matches.push({ start: m.index, end: m.index + m[0].length, word: m[0], isPrefix: true });
  }

  // 独立形式
  const standRe = /\b(?:ne|pas|plus|jamais|rien|personne|aucun|ni|guère|point|nul|nulle|nuls|nulles)\b/gi;
  while ((m = standRe.exec(text)) !== null) {
    matches.push({ start: m.index, end: m.index + m[0].length, word: m[0], isPrefix: false });
  }

  // 找每个否定词后方最近的名词（排除前缀形式 n'，因为它修饰的是动词不是名词）
  for (const neg of matches) {
    if (neg.isPrefix) {
      // n' 通常不直接修饰名词，跳过
      continue;
    }

    // 在 text[neg.end ...] 中找第一个名词
    const after = text.slice(neg.end);
    const occMap = chunkOccMapFiltered.get(chunkKey) || new Map();

    let bestNoun = null;
    let bestStart = Infinity;
    for (const [start, occ] of occMap) {
      if (start >= neg.end) {
        // 这个名词在否定词之后
        // 计算 text 中该名词的实际位置
        const nounOffsetInText = start; // occ.start 就是相对于 chunk text 的 offset
        if (nounOffsetInText < bestStart) {
          bestStart = nounOffsetInText;
          bestNoun = occ;
        }
      }
    }

    if (bestNoun) {
      results.push({
        chunkKey,
        negation: neg.word,
        negStart: neg.start,
        negEnd: neg.end,
        nounSurface: bestNoun.surface,
        nounStart: bestNoun.start,
        nounEnd: bestNoun.end,
      });
    }
  }

  return results;
}

// ============ 检查拓扑链区间是否覆盖否定词 ============
function getLeftBoundaryOfNoun(chunkKey, nounStart, occs, chunkOccMap) {
  // 在 occs 中找到这个名词的全局位置
  let occIdx = -1;
  for (let i = 0; i < occs.length; i++) {
    if (occs[i].chunkKey === chunkKey && occs[i].start === nounStart) {
      occIdx = i;
      break;
    }
  }
  if (occIdx === -1) return null;

  const beforeStart = Math.max(0, occIdx - TOPOLOGY_WINDOW);
  const beforeEnd   = occIdx; // 不包含目标名词自己

  // 找前 W 个名词的最小 start
  let minStart = nounStart;
  for (let i = beforeStart; i < beforeEnd; i++) {
    minStart = Math.min(minStart, occs[i].start);
  }

  // 但要限定在同一 chunk 内（拓扑链基于 chunk 内 occurrences）
  const chunkOccs = chunkOccMap.get(chunkKey);
  if (chunkOccs) {
    // 找 chunk 内前 W 个名词
    const sortedChunkOccs = [...chunkOccMap.get(chunkKey).values()].sort((a, b) => a.start - b.start);
    const nounChunkIdx = sortedChunkOccs.findIndex(o => o.start === nounStart);
    if (nounChunkIdx > 0) {
      const wBefore = sortedChunkOccs.slice(Math.max(0, nounChunkIdx - TOPOLOGY_WINDOW), nounChunkIdx);
      minStart = Math.min(...wBefore.map(o => o.start));
    }
  }

  return minStart;
}

// ============ 主分析 ============
console.log('\n========== 否定词覆盖分析 ==========');
console.log(`TOPOLOGY_WINDOW=${TOPOLOGY_WINDOW}`);
console.log(`名词数（过滤前）: ${nounIndex.nouns.length}`);
console.log(`名词数（过滤后）: ${occFiltered.length / (occUnfiltered.length / nounIndex.nouns.length) | 0}（估算）`);
console.log(`黑名单条目: ${blacklistedSurfaces.size}\n`);

let covered = 0, uncovered = 0;
const uncoveredExamples = [];
const coveredExamples = [];

let totalNegations = 0;
let skippedNoNoun = 0;

for (const [chunkKey, text] of chunkByKey) {
  const negations = findNegationsInChunk(chunkKey, text);
  if (negations.length === 0) continue;

  for (const neg of negations) {
    totalNegations++;

    // 计算过滤后的左边界
    const leftBoundaryFiltered = getLeftBoundaryOfNoun(
      neg.chunkKey, neg.nounStart, occFiltered, chunkOccMapFiltered
    );

    // 计算过滤前的左边界
    const leftBoundaryUnfiltered = getLeftBoundaryOfNoun(
      neg.chunkKey, neg.nounStart, occUnfiltered, chunkOccMapUnfiltered
    );

    if (leftBoundaryFiltered === null) {
      // 过滤后该名词不在 occ 列表中（已被黑名单过滤）
      skippedNoNoun++;
      continue;
    }

    const coveredByFiltered = neg.negStart >= leftBoundaryFiltered && neg.negStart <= neg.nounEnd;
    const coveredByUnfiltered = neg.negStart >= leftBoundaryUnfiltered && neg.negStart <= neg.nounEnd;

    const snippet = text.slice(Math.max(0, neg.negStart - 5), Math.min(text.length, neg.nounEnd + 10));
    const snippetEscaped = snippet.replace(/\n/g, '↩');

    if (coveredByFiltered) {
      covered++;
      if (coveredExamples.length < 10) {
        coveredExamples.push({ ...neg, snippet: snippetEscaped });
      }
    } else {
      uncovered++;
      uncoveredExamples.push({ ...neg, snippet: snippetEscaped, leftBoundaryFiltered });
    }
  }
}

console.log(`总否定词实例: ${totalNegations}`);
console.log(`跳过（名词已被过滤）: ${skippedNoNoun}`);
console.log(`\n覆盖情况（过滤后拓扑链）:`);
console.log(`  ✅ 否定词在拓扑链区间内: ${covered} (${(covered / totalNegations * 100).toFixed(1)}%)`);
console.log(`  ❌ 否定词不在拓扑链区间内: ${uncovered} (${(uncovered / totalNegations * 100).toFixed(1)}%)`);

if (uncovered > 0) {
  console.log(`\n❌ 未覆盖的否定词示例（${Math.min(20, uncoveredExamples.length)} 个）:`);
  for (const ex of uncoveredExamples.slice(0, 20)) {
    console.log(`  "${ex.negation}" at ${ex.negStart} → noun="${ex.nounSurface}" [${ex.nounStart}, ${ex.nounEnd}], 左边界=${ex.leftBoundaryFiltered}`);
    console.log(`    文本: ...${ex.snippet}...`);
  }
}

if (coveredExamples.length > 0) {
  console.log(`\n✅ 已覆盖的否定词示例（前${Math.min(5, coveredExamples.length)} 个）:`);
  for (const ex of coveredExamples.slice(0, 5)) {
    console.log(`  "${ex.negation}" → noun="${ex.nounSurface}", 文本: ...${ex.snippet}...`);
  }
}

// 特别分析：被过滤掉的名词中，有没有是实际被否定词修饰的？
console.log('\n========== 特殊检查：被过滤名词是否被否定词修饰 ==========');
const filteredNounSurfaces = new Set([...blacklistedSurfaces].filter(s => s.trim()));
let negModifiesFiltered = 0;

for (const [chunkKey, text] of chunkByKey) {
  const negations = findNegationsInChunk(chunkKey, text);
  for (const neg of negations) {
    // 检查该名词是否被黑名单过滤
    if (blacklistedSurfaces.has(neg.nounSurface)) {
      negModifiesFiltered++;
      if (negModifiesFiltered <= 5) {
        console.log(`  ⚠️ 否定词 "${neg.negation}" 修饰的名词 "${neg.nounSurface}" 在黑名单中`);
        const snippet = text.slice(Math.max(0, neg.negStart - 5), Math.min(text.length, neg.nounEnd + 10)).replace(/\n/g, '↩');
        console.log(`     文本: ...${snippet}...`);
      }
    }
  }
}
console.log(`\n被黑名单过滤的名词被否定词修饰的实例: ${negModifiesFiltered}`);
