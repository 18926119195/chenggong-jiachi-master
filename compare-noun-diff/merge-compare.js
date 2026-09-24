/**
 * merge-s0-s1 — 对比实验专用版
 * 输入/输出路径指向 compare-noun-diff/ 目录
 */
import fs from 'fs';
import path from 'path';
import { buildPureTextTable } from './src/core/pureTextTable.js';

const COMPARE_DIR = path.join(process.cwd());
const DOCUVERSE_PATH = 'C:\\Users\\Administrator\\Desktop\\2026-09-21-master\\docuverse_cartographies_squizoanalythiques_Fe_lix_Guattari_1789114122714.docuverse.json';
const S1_PATH = path.join(COMPARE_DIR, 's1-nouns-with-offsets-new.json');
const S0_HITS_PATH = path.join(COMPARE_DIR, 's0-hits.json');
const OUTPUT_PATH = path.join(COMPARE_DIR, 'final-noun-index-new.json');

function normalizeId(surface) {
  return surface.toLowerCase().trim().replace(/\s+/g, '_');
}

const FRENCH_FUNCTION_WORDS = new Set([
  'de','la','le','les','un','une','des','du','et','en','au','aux',
  'ce','ces','cet','cette','son','sa','ses','il','elle','ils','elles',
  'on','qui','que','quoi','dans','pour','par','sur','pas','plus',
  'tout','tous','toute','toutes','ne','se','sont','est','ont','a',
  'ou','mais','donc','or','ni','car','si','y','lui','leur','leurs',
  'nous','vous','je','tu','mon','ma','mes','ton','ta','tes','notre',
  'votre','nos','vos','avec','sans','sous','vers','chez','entre',
]);

const OCR_JUNK_RE = /^[A-Za-zΦΣ]\.$|^\d+\)?\.?$|^##+$|^[a-zA-Z]\/$|^p\.$/;

function isJunkSurface(surface) {
  const trimmed = surface.trim();
  if (OCR_JUNK_RE.test(trimmed)) return true;
  if (FRENCH_FUNCTION_WORDS.has(trimmed.toLowerCase())) return true;
  return false;
}

function hasOverlap(a, b) {
  return a.start < b.end && b.start < a.end;
}

function deduplicateOverlappingOffsets(allNouns) {
  const byChunk = new Map();
  for (const noun of allNouns) {
    for (const off of noun.offsets) {
      if (!byChunk.has(off.chunkKey)) byChunk.set(off.chunkKey, []);
      byChunk.get(off.chunkKey).push({
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

  for (const list of byChunk.values()) {
    list.sort((a, b) => a.start - b.start);
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i], b = list[j];
        if (a.nounId === b.nounId) continue;
        if (toRemove.has(a.offsetKey) || toRemove.has(b.offsetKey)) continue;
        if (hasOverlap(a, b)) {
          totalOverlaps++;
          const shorter = (a.end - a.start) < (b.end - b.start)
            ? a
            : ((a.end - a.start) > (b.end - b.start)
                ? b
                : (a.surface.length < b.surface.length ? a : b));
          toRemove.add(shorter.offsetKey);
        }
      }
    }
  }

  console.log(`  区间交集去重: ${totalOverlaps} 对交集，删除 ${toRemove.size} 个短 offset`);
  return toRemove;
}

async function main() {
  console.log('========== s0 + s1 合并（对比实验版）==========\n');

  const docuverse = JSON.parse(fs.readFileSync(DOCUVERSE_PATH, 'utf-8'));
  const pureTextTable = buildPureTextTable(docuverse.bookIndex);
  const entries = pureTextTable.entries;
  console.log(`纯文表: ${entries.length} 个 chunks\n`);

  console.log('读取 s0-hits.json...');
  let s0HitsByChunk;
  try {
    const s0Hits = JSON.parse(fs.readFileSync(S0_HITS_PATH, 'utf-8'));
    s0HitsByChunk = new Map((s0Hits.hitsByChunk || []).map((g) => [g.chunkKey, g.hits || []]));
    console.log(`  已加载 ${s0HitsByChunk.size} 个 chunk\n`);
  } catch (err) {
    console.error(`❌ 无法读取 s0-hits.json: ${err.message}`);
    process.exit(1);
  }

  const pageByChunkKey = new Map(entries.map((e) => [e.chunkKey, e.page]));

  const s0RawTokens = [];
  for (const [chunkKey, hits] of s0HitsByChunk.entries()) {
    const page = pageByChunkKey.get(chunkKey);
    for (const h of hits) {
      s0RawTokens.push({ surface: h.surface, chunkKey, start: h.start, end: h.end, page });
    }
  }
  console.log(`s0 名词: ${s0RawTokens.length} 个（去重前）\n`);

  let s1Data = { nouns: [] };
  if (fs.existsSync(S1_PATH)) {
    s1Data = JSON.parse(fs.readFileSync(S1_PATH, 'utf-8'));
    console.log(`s1 补缺名词: ${s1Data.nouns.length} 个\n`);
  } else {
    console.log('s1 文件不存在，跳过\n');
  }

  const mergedNouns = new Map();
  let s0JunkSkipped = 0, s1JunkSkipped = 0;

  for (const token of s0RawTokens) {
    const id = normalizeId(token.surface);
    if (id.length < 2) continue;
    if (isJunkSurface(token.surface)) { s0JunkSkipped++; continue; }
    if (!mergedNouns.has(id)) {
      mergedNouns.set(id, { id, surface: token.surface, offsets: [], source: 's0-spacy' });
    }
    mergedNouns.get(id).offsets.push({ chunkKey: token.chunkKey, start: token.start, end: token.end, page: token.page });
  }

  for (const entry of mergedNouns.values()) {
    const unique = new Map();
    for (const off of entry.offsets) {
      unique.set(`${off.chunkKey}-${off.start}-${off.end}`, off);
    }
    entry.offsets = [...unique.values()].sort((a, b) => a.chunkKey.localeCompare(b.chunkKey) || a.start - b.start);
  }

  for (const s1Entry of s1Data.nouns) {
    if (mergedNouns.has(s1Entry.id)) continue;
    if (isJunkSurface(s1Entry.surface)) { s1JunkSkipped++; continue; }
    mergedNouns.set(s1Entry.id, { id: s1Entry.id, surface: s1Entry.surface, offsets: s1Entry.offsets, source: 's1-llm' });
  }

  console.log(`噪声过滤: s0跳过${s0JunkSkipped}个, s1跳过${s1JunkSkipped}个\n`);

  const beforeDedup = [...mergedNouns.values()];
  const totalOffsetsBefore = beforeDedup.reduce((sum, e) => sum + e.offsets.length, 0);
  console.log(`合并后(去重前): ${beforeDedup.length} 个词条, ${totalOffsetsBefore} 处位置`);

  const offsetsToRemove = deduplicateOverlappingOffsets(beforeDedup);

  for (const noun of beforeDedup) {
    noun.offsets = noun.offsets.filter((off) => {
      const key = `${off.chunkKey}::${off.start}::${off.end}::${noun.id}`;
      return !offsetsToRemove.has(key);
    });
  }

  const afterDedup = beforeDedup.filter(n => n.offsets.length > 0);
  console.log(`合并后(去重后): ${afterDedup.length} 个词条\n`);

  const finalEntries = afterDedup.sort((a, b) => b.offsets.length - a.offsets.length || a.id.localeCompare(b.id));

  const s0Count = finalEntries.filter(e => e.source === 's0-spacy').length;
  const s1Count = finalEntries.filter(e => e.source === 's1-llm').length;
  const totalOffsets = finalEntries.reduce((sum, e) => sum + e.offsets.length, 0);

  console.log('========== 合并完成 ==========');
  console.log(`最终名词: ${finalEntries.length} 个 (s0: ${s0Count}, s1: ${s1Count})`);
  console.log(`总位置: ${totalOffsets} 处（去重前 ${totalOffsetsBefore}）`);
  console.log(`去重率: ${((1 - totalOffsets / Math.max(totalOffsetsBefore, 1)) * 100).toFixed(1)}%\n`);

  const output = {
    meta: {
      source: 's0 + s1 合并（对比实验版）',
      chunkCount: entries.length,
      totalNouns: finalEntries.length,
      s0Count, s1Count, totalOffsets,
      dedupRate: `${((1 - totalOffsets / Math.max(totalOffsetsBefore, 1)) * 100).toFixed(1)}%`,
      timestamp: new Date().toISOString(),
    },
    nouns: finalEntries,
  };

  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 2), 'utf-8');
  console.log(`输出文件: ${OUTPUT_PATH}`);
  console.log('\n前20个高频名词:');
  finalEntries.slice(0, 20).forEach((e, i) => console.log(`  ${i+1}. ${e.surface} (${e.offsets.length}次) [${e.source}]`));
}

main().catch(err => { console.error('执行失败:', err); process.exit(1); });
