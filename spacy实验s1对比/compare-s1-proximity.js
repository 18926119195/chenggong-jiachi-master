/**
 * 邻近分析：对于没有精确区间交集的 LLM 名词位置，
 * 找同一 chunkKey 内最近的 spaCy 位置，看看距离和内容差异。
 * 同时反向分析 spaCy 独有位置附近的 LLM 名词。
 */

import fs from 'fs';
import path from 'path';

const SPACY_OUTPUT = path.join(process.cwd(), 'test-s1-spacy-output.json');
const LLM_OUTPUT = path.join(process.cwd(), 's1-nouns-with-offsets.json');
const OUT_JSON = path.join(process.cwd(), 'compare-s1-proximity-output.json');

const spacyData = JSON.parse(fs.readFileSync(SPACY_OUTPUT, 'utf-8'));
const llmData = JSON.parse(fs.readFileSync(LLM_OUTPUT, 'utf-8'));

function hasOverlap(s1, e1, s2, e2) {
  return !(e1 <= s2 || e2 <= s1);
}

function buildOffsetList(data) {
  const list = [];
  for (const noun of data.nouns) {
    for (const offset of noun.offsets) {
      list.push({ chunkKey: offset.chunkKey, start: offset.start, end: offset.end, surface: noun.surface });
    }
  }
  return list;
}

const spacyOffsets = buildOffsetList(spacyData);
const llmOffsets = buildOffsetList(llmData);

const spacyByChunk = new Map();
for (const off of spacyOffsets) {
  if (!spacyByChunk.has(off.chunkKey)) spacyByChunk.set(off.chunkKey, []);
  spacyByChunk.get(off.chunkKey).push(off);
}

const llmByChunk = new Map();
for (const off of llmOffsets) {
  if (!llmByChunk.has(off.chunkKey)) llmByChunk.set(off.chunkKey, []);
  llmByChunk.get(off.chunkKey).push(off);
}

// 先算出哪些位置已经有精确区间交集（复用 v2 逻辑）
const spacyMatchedKeys = new Set();
const llmMatchedKeys = new Set();
for (const [chunkKey, spacyList] of spacyByChunk.entries()) {
  const llmList = llmByChunk.get(chunkKey);
  if (!llmList) continue;
  for (const sp of spacyList) {
    for (const ll of llmList) {
      if (hasOverlap(sp.start, sp.end, ll.start, ll.end)) {
        spacyMatchedKeys.add(`${chunkKey}:${sp.start}:${sp.end}`);
        llmMatchedKeys.add(`${chunkKey}:${ll.start}:${ll.end}`);
      }
    }
  }
}

function dist(a, b) {
  if (hasOverlap(a.start, a.end, b.start, b.end)) return 0;
  return a.start >= b.end ? a.start - b.end : b.start - a.end;
}

// 对每个未匹配的 LLM 位置，找同 chunk 内最近的 spaCy 位置
const llmNearMiss = [];
for (const [chunkKey, llmList] of llmByChunk.entries()) {
  const spacyList = spacyByChunk.get(chunkKey) || [];
  for (const ll of llmList) {
    const key = `${chunkKey}:${ll.start}:${ll.end}`;
    if (llmMatchedKeys.has(key)) continue;
    let nearest = null;
    let minDist = Infinity;
    for (const sp of spacyList) {
      const d = dist(ll, sp);
      if (d < minDist) { minDist = d; nearest = sp; }
    }
    llmNearMiss.push({
      chunkKey,
      llm: { start: ll.start, end: ll.end, surface: ll.surface },
      nearestSpacy: nearest ? { start: nearest.start, end: nearest.end, surface: nearest.surface } : null,
      distance: nearest ? minDist : null,
      hasSpacyInChunk: spacyList.length > 0
    });
  }
}

// 对每个未匹配的 spaCy 位置，找同 chunk 内最近的 LLM 位置
const spacyNearMiss = [];
for (const [chunkKey, spacyList] of spacyByChunk.entries()) {
  const llmList = llmByChunk.get(chunkKey) || [];
  for (const sp of spacyList) {
    const key = `${chunkKey}:${sp.start}:${sp.end}`;
    if (spacyMatchedKeys.has(key)) continue;
    let nearest = null;
    let minDist = Infinity;
    for (const ll of llmList) {
      const d = dist(sp, ll);
      if (d < minDist) { minDist = d; nearest = ll; }
    }
    spacyNearMiss.push({
      chunkKey,
      spacy: { start: sp.start, end: sp.end, surface: sp.surface },
      nearestLLM: nearest ? { start: nearest.start, end: nearest.end, surface: nearest.surface } : null,
      distance: nearest ? minDist : null,
      hasLLMInChunk: llmList.length > 0
    });
  }
}

console.log('========================================');
console.log('LLM 独有位置的邻近分析');
console.log('========================================');
console.log(`LLM 独有位置总数: ${llmNearMiss.length}`);

const llmWithSpacyInChunk = llmNearMiss.filter(x => x.hasSpacyInChunk);
const llmNoSpacyInChunk = llmNearMiss.filter(x => !x.hasSpacyInChunk);
console.log(`  同 chunk 内 spaCy 有输出: ${llmWithSpacyInChunk.length}`);
console.log(`  同 chunk 内 spaCy 无输出: ${llmNoSpacyInChunk.length}\n`);

// 距离分桶
const buckets = { '0(仅表面文本不同)': 0, '1-5': 0, '6-20': 0, '21-50': 0, '51-200': 0, '>200': 0, '无spaCy': 0 };
for (const x of llmNearMiss) {
  if (x.distance === null) buckets['无spaCy']++;
  else if (x.distance === 0) buckets['0(仅表面文本不同)']++;
  else if (x.distance <= 5) buckets['1-5']++;
  else if (x.distance <= 20) buckets['6-20']++;
  else if (x.distance <= 50) buckets['21-50']++;
  else if (x.distance <= 200) buckets['51-200']++;
  else buckets['>200']++;
}
console.log('距离分布（LLM独有位置 → 最近spaCy位置）:');
for (const [k, v] of Object.entries(buckets)) {
  console.log(`  ${k}: ${v} (${(v/llmNearMiss.length*100).toFixed(1)}%)`);
}

console.log('\n距离 <= 20 字符的样本（前30个，说明LLM抓到了spaCy附近但没识别出的词）:');
const closeSamples = llmNearMiss.filter(x => x.distance !== null && x.distance > 0 && x.distance <= 20).slice(0, 30);
closeSamples.forEach((x, i) => {
  console.log(`${i+1}. LLM[${x.llm.start}-${x.llm.end}]"${x.llm.surface}"  <-距离${x.distance}->  spaCy[${x.nearestSpacy.start}-${x.nearestSpacy.end}]"${x.nearestSpacy.surface}"`);
});

console.log('\n\n========================================');
console.log('spaCy 独有位置的邻近分析');
console.log('========================================');
console.log(`spaCy 独有位置总数: ${spacyNearMiss.length}`);

const spacyBuckets = { '0(仅表面文本不同)': 0, '1-5': 0, '6-20': 0, '21-50': 0, '51-200': 0, '>200': 0, '无LLM': 0 };
for (const x of spacyNearMiss) {
  if (x.distance === null) spacyBuckets['无LLM']++;
  else if (x.distance === 0) spacyBuckets['0(仅表面文本不同)']++;
  else if (x.distance <= 5) spacyBuckets['1-5']++;
  else if (x.distance <= 20) spacyBuckets['6-20']++;
  else if (x.distance <= 50) spacyBuckets['21-50']++;
  else if (x.distance <= 200) spacyBuckets['51-200']++;
  else spacyBuckets['>200']++;
}
console.log('距离分布（spaCy独有位置 → 最近LLM位置）:');
for (const [k, v] of Object.entries(spacyBuckets)) {
  console.log(`  ${k}: ${v} (${(v/spacyNearMiss.length*100).toFixed(1)}%)`);
}

// 全量名词内容分布：spaCy独有 vs LLM独有 各自最常见的词
function topSurfaces(list, key) {
  const counter = new Map();
  for (const x of list) {
    const s = x[key].surface.toLowerCase();
    counter.set(s, (counter.get(s) || 0) + 1);
  }
  return Array.from(counter.entries()).sort((a, b) => b[1] - a[1]).slice(0, 20);
}

console.log('\nspaCy 独有位置中最常见的词（Top 20）:');
topSurfaces(spacyNearMiss, 'spacy').forEach(([w, c]) => console.log(`  ${w}: ${c} 次`));

console.log('\nLLM 独有位置中最常见的词（Top 20）:');
topSurfaces(llmNearMiss, 'llm').forEach(([w, c]) => console.log(`  ${w}: ${c} 次`));

// 保存全量数据供进一步检索
fs.writeFileSync(OUT_JSON, JSON.stringify({
  meta: {
    llmNearMissCount: llmNearMiss.length,
    spacyNearMissCount: spacyNearMiss.length
  },
  llmNearMiss,
  spacyNearMiss
}, null, 2), 'utf-8');

console.log(`\n✅ 全量数据已保存: ${OUT_JSON}`);
