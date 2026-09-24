/**
 * s0-s1 合并脚本（增强版）：合并后做区间交集去重
 *
 * 输入：
 *   1. s0-hits.json（spaCy 抽取结果）
 *   2. s1-nouns-with-offsets.json（LLM 补缺结果）
 *
 * 输出：
 *   final-noun-index.json - 去重后的最终名词索引
 *
 * 策略：
 *   1. 先按原流程合并 s0 + s1，标准化 ID 去重
 *   2. 合并完成后，对每个 chunk 内的 offsets 做区间交集去重：
 *      - 如果两个不同词条的 offset 区间有交集，保留最长的那个
 *      - 短词条的该 offset 被删除（不是删除整个词条，只删这一处位置）
 *   3. 清理空词条（offsets 被删光的）
 *   4. 按书序排序（chunkKey + start 升序）
 */

import fs from 'fs';
import { buildPureTextTable } from './src/core/pureTextTable.js';

const DOCUVERSE_PATH = process.env.DOCUVERSE_PATH || './docuverse_cartographies_squizoanalythiques_Fe_lix_Guattari_1789114122714.docuverse.json';
const S1_PATH = process.env.S1_PATH || './s1-nouns-with-offsets.json';
const OUTPUT_PATH = process.env.OUTPUT_PATH || './final-noun-index.json';

// ---------- 标准化名词 ID ----------
function normalizeId(surface) {
  return surface.toLowerCase().trim().replace(/\s+/g, '_');
}

// ---------- 噪声词条过滤 ----------
const FRENCH_FUNCTION_WORDS = new Set([
  'de', 'la', 'le', 'les', 'un', 'une', 'des', 'du', 'et', 'en', 'au', 'aux',
  'ce', 'ces', 'cet', 'cette', 'son', 'sa', 'ses', 'il', 'elle', 'ils', 'elles',
  'on', 'qui', 'que', 'quoi', 'dans', 'pour', 'par', 'sur', 'pas', 'plus',
  'tout', 'tous', 'toute', 'toutes', 'ne', 'se', 'sont', 'est', 'ont', 'a',
  'ou', 'mais', 'donc', 'or', 'ni', 'car', 'si', 'y', 'lui', 'leur', 'leurs',
  'nous', 'vous', 'je', 'tu', 'mon', 'ma', 'mes', 'ton', 'ta', 'tes', 'notre',
  'votre', 'nos', 'vos', 'avec', 'sans', 'sous', 'vers', 'chez', 'entre',
]);

const OCR_JUNK_RE = /^[A-Za-zΦΣ]\.$|^\d+\)?\.?$|^##+$|^[a-zA-Z]\/$|^p\.$/;

function isJunkSurface(surface) {
  const trimmed = surface.trim();
  if (OCR_JUNK_RE.test(trimmed)) return true;
  if (FRENCH_FUNCTION_WORDS.has(trimmed.toLowerCase())) return true;
  return false;
}

// ---------- 区间交集去重逻辑 ----------
/** 检查两个区间是否有交集 */
function hasOverlap(a, b) {
  return a.start < b.end && b.start < a.end;
}

/** 
 * 对每个 chunk 内的 offsets 做区间交集去重，保留最长的词条
 * 返回：{ kept: Set<offsetKey>, removed: Set<offsetKey> }
 */
function deduplicateOverlappingOffsets(allNouns) {
  // 按 chunkKey 分组所有 offset
  const byChunk = new Map();
  for (const noun of allNouns) {
    for (const off of noun.offsets) {
      const key = off.chunkKey;
      if (!byChunk.has(key)) byChunk.set(key, []);
      byChunk.get(key).push({
        nounId: noun.id,
        surface: noun.surface,
        start: off.start,
        end: off.end,
        offsetKey: `${off.chunkKey}::${off.start}::${off.end}::${noun.id}`,
      });
    }
  }

  const toRemove = new Set();
  let totalOverlaps = 0;

  // 对每个 chunk 内的 offsets 做两两比对
  for (const [chunkKey, list] of byChunk.entries()) {
    list.sort((a, b) => a.start - b.start);
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i], b = list[j];
        if (a.nounId === b.nounId) continue; // 同一个词条的不同 offset 不去重
        if (toRemove.has(a.offsetKey) || toRemove.has(b.offsetKey)) continue; // 已经被标记删除

        if (hasOverlap(a, b)) {
          totalOverlaps++;
          const lenA = a.end - a.start;
          const lenB = b.end - b.start;
          // 保留更长的，删除短的
          const shorter = lenA < lenB ? a : (lenA > lenB ? b : (a.surface.length < b.surface.length ? a : b));
          toRemove.add(shorter.offsetKey);
        }
      }
    }
  }

  console.log(`\n区间交集去重: 发现 ${totalOverlaps} 对交集，删除 ${toRemove.size} 个短 offset\n`);
  return toRemove;
}

// ---------- 主流程 ----------
async function main() {
  console.log('========== s0 + s1 合并流程（区间去重增强版）==========\n');

  // 1. 构建纯文表
  const docuverse = JSON.parse(fs.readFileSync(DOCUVERSE_PATH, 'utf-8'));
  const pureTextTable = buildPureTextTable(docuverse.bookIndex);
  const entries = pureTextTable.entries;
  console.log(`纯文表: ${entries.length} 个 chunks\n`);

  // 2. 读取 s0-hits.json
  console.log('读取 s0-hits.json...');
  const S0_HITS_PATH = process.env.S0_HITS_PATH || './s0-hits.json';
  let s0HitsByChunk;
  try {
    const s0Hits = JSON.parse(fs.readFileSync(S0_HITS_PATH, 'utf-8'));
    s0HitsByChunk = new Map((s0Hits.hitsByChunk || []).map((g) => [g.chunkKey, g.hits || []]));
    console.log(`  已加载 ${s0HitsByChunk.size} 个 chunk 的 s0 命中`);
  } catch (err) {
    console.error(`\n❌ 无法读取 s0-hits.json: ${err.message}`);
    process.exit(1);
  }

  const pageByChunkKey = new Map(entries.map((e) => [e.chunkKey, e.page]));
  // 书序位置索引：entries 数组的下标就是 bookIndex.chunks 的原始顺序（书序），
  // chunkKey 是哈希字符串，不能用字典序代表书序，必须用这个索引排序。
  const chunkOrderIndex = new Map(entries.map((e, i) => [e.chunkKey, i]));

  const s0RawTokens = [];
  let processed = 0;
  for (const [chunkKey, hits] of s0HitsByChunk.entries()) {
    const page = pageByChunkKey.get(chunkKey);
    for (const h of hits) {
      s0RawTokens.push({
        surface: h.surface,
        chunkKey,
        start: h.start,
        end: h.end,
        page,
      });
    }
    processed++;
    process.stdout.write(`\r  进度: ${processed}/${s0HitsByChunk.size} chunks`);
  }
  console.log(`\ns0 名词: ${s0RawTokens.length} 个（去重前）\n`);

  // 3. 读取 s1
  let s1Data = { nouns: [] };
  if (fs.existsSync(S1_PATH)) {
    s1Data = JSON.parse(fs.readFileSync(S1_PATH, 'utf-8'));
    console.log(`s1 补缺名词: ${s1Data.nouns.length} 个\n`);
  } else {
    console.log('s1 文件不存在，跳过补缺\n');
  }

  // 4. 合并去重（标准化 ID 去重）
  const mergedNouns = new Map();

  let s0JunkSkipped = 0;
  for (const token of s0RawTokens) {
    const id = normalizeId(token.surface);
    if (id.length < 2) continue;
    if (isJunkSurface(token.surface)) { s0JunkSkipped++; continue; }

    if (!mergedNouns.has(id)) {
      mergedNouns.set(id, {
        id,
        surface: token.surface,
        offsets: [],
        source: 's0-spacy',
      });
    }
    mergedNouns.get(id).offsets.push({ 
      chunkKey: token.chunkKey, 
      start: token.start, 
      end: token.end, 
      page: token.page 
    });
  }

  // 每个词条内部按 chunkKey + offset 精确去重
  for (const entry of mergedNouns.values()) {
    const unique = new Map();
    for (const off of entry.offsets) {
      unique.set(`${off.chunkKey}-${off.start}-${off.end}`, off);
    }
    entry.offsets = [...unique.values()];
  }

  let s1JunkSkipped = 0;
  for (const s1Entry of s1Data.nouns) {
    if (mergedNouns.has(s1Entry.id)) continue;
    if (isJunkSurface(s1Entry.surface)) { s1JunkSkipped++; continue; }

    mergedNouns.set(s1Entry.id, {
      id: s1Entry.id,
      surface: s1Entry.surface,
      offsets: s1Entry.offsets,
      source: 's1-llm',
    });
  }

  console.log(`噪声过滤：s0 跳过 ${s0JunkSkipped} 个token，s1 跳过 ${s1JunkSkipped} 个词条\n`);

  const beforeDedup = [...mergedNouns.values()];
  const totalOffsetsBefore = beforeDedup.reduce((sum, e) => sum + e.offsets.length, 0);
  console.log(`合并后（区间去重前）: ${beforeDedup.length} 个词条，${totalOffsetsBefore} 处位置\n`);

  // 5. 区间交集去重（保留最长）
  const toRemove = deduplicateOverlappingOffsets(beforeDedup);

  // 从每个词条的 offsets 里删除被标记的短 offset
  for (const noun of beforeDedup) {
    noun.offsets = noun.offsets.filter((off) => {
      const key = `${off.chunkKey}::${off.start}::${off.end}::${noun.id}`;
      return !toRemove.has(key);
    });
  }

  // 清理 offsets 被删光的词条
  const finalEntries = beforeDedup.filter((n) => n.offsets.length > 0);

  // 6. 按书序排序（用 chunkOrderIndex 而不是 chunkKey 字符串排序）
  finalEntries.forEach((n) => {
    n.offsets.sort((a, b) => {
      const idxA = chunkOrderIndex.get(a.chunkKey) ?? Infinity;
      const idxB = chunkOrderIndex.get(b.chunkKey) ?? Infinity;
      return idxA - idxB || a.start - b.start;
    });
  });
  finalEntries.sort((a, b) => {
    const offA = a.offsets[0];
    const offB = b.offsets[0];
    const idxA = chunkOrderIndex.get(offA.chunkKey) ?? Infinity;
    const idxB = chunkOrderIndex.get(offB.chunkKey) ?? Infinity;
    return idxA - idxB || offA.start - offB.start;
  });

  // 7. 统计
  const s0Count = finalEntries.filter((e) => e.source === 's0-spacy').length;
  const s1Count = finalEntries.filter((e) => e.source === 's1-llm').length;
  const totalOffsets = finalEntries.reduce((sum, e) => sum + e.offsets.length, 0);

  console.log('========== 去重完成 ==========');
  console.log(`最终名词数: ${finalEntries.length} 个（去重前 ${beforeDedup.length}）`);
  console.log(`  - s0 (spaCy): ${s0Count} 个`);
  console.log(`  - s1 (LLM补缺): ${s1Count} 个`);
  console.log(`总位置数: ${totalOffsets} 处（去重前 ${totalOffsetsBefore}）`);
  console.log(`去重率: ${((1 - totalOffsets / totalOffsetsBefore) * 100).toFixed(1)}%\n`);

  // 8. 输出
  const output = {
    meta: {
      source: 's0 + s1 合并（区间去重增强版）',
      chunkCount: entries.length,
      totalNouns: finalEntries.length,
      s0Count,
      s1Count,
      totalOffsets,
      dedupRate: `${((1 - totalOffsets / totalOffsetsBefore) * 100).toFixed(1)}%`,
      timestamp: new Date().toISOString(),
    },
    nouns: finalEntries,
  };

  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 2), 'utf-8');
  console.log(`输出文件: ${OUTPUT_PATH}`);

  console.log(`\n前20个名词（按书序）:`);
  finalEntries.slice(0, 20).forEach((e, i) => {
    const first = e.offsets[0];
    console.log(`  ${i + 1}. ${e.surface} (${e.offsets.length}处) [${e.source}] page ${first.page}`);
  });
}

main().catch((err) => {
  console.error('执行失败:', err);
  process.exit(1);
});
