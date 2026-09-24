/**
 * 对比 spaCy vs LLM 的 S1 名词提取重叠度 (v2)
 * 
 * 改进：使用位置区间交集匹配，而不是要求完全相同
 */

import fs from 'fs';
import path from 'path';

const SPACY_OUTPUT = path.join(process.cwd(), 'test-s1-spacy-output.json');
const LLM_OUTPUT = path.join(process.cwd(), 's1-nouns-with-offsets.json');

console.log('========================================');
console.log('spaCy vs LLM S1 名词提取重叠度分析 (v2)');
console.log('使用区间交集匹配');
console.log('========================================\n');

// 加载数据
const spacyData = JSON.parse(fs.readFileSync(SPACY_OUTPUT, 'utf-8'));
const llmData = JSON.parse(fs.readFileSync(LLM_OUTPUT, 'utf-8'));

console.log('数据加载:');
console.log(`  spaCy: ${spacyData.nouns.length} 个名词, ${spacyData.meta.totalOffsets} 个位置`);
console.log(`  LLM:   ${llmData.nouns.length} 个名词, ${llmData.meta.totalOffsets} 个位置\n`);

// 判断两个区间是否有交集
function hasOverlap(start1, end1, start2, end2) {
  return !(end1 <= start2 || end2 <= start1);
}

// 构建位置列表：每个元素是 { chunkKey, start, end, surface }
function buildOffsetList(data) {
  const list = [];
  for (const noun of data.nouns) {
    for (const offset of noun.offsets) {
      list.push({
        chunkKey: offset.chunkKey,
        start: offset.start,
        end: offset.end,
        surface: noun.surface
      });
    }
  }
  return list;
}

const spacyOffsets = buildOffsetList(spacyData);
const llmOffsets = buildOffsetList(llmData);

console.log('========================================');
console.log('1. 区间交集重叠分析');
console.log('========================================');

// 按 chunkKey 分组
const spacyByChunk = new Map();
const llmByChunk = new Map();

for (const off of spacyOffsets) {
  if (!spacyByChunk.has(off.chunkKey)) {
    spacyByChunk.set(off.chunkKey, []);
  }
  spacyByChunk.get(off.chunkKey).push(off);
}

for (const off of llmOffsets) {
  if (!llmByChunk.has(off.chunkKey)) {
    llmByChunk.set(off.chunkKey, []);
  }
  llmByChunk.get(off.chunkKey).push(off);
}

// 找出有区间交集的位置对
const overlaps = [];
let spacyMatchedCount = 0;
let llmMatchedCount = 0;
const spacyMatched = new Set();
const llmMatched = new Set();

for (const [chunkKey, spacyList] of spacyByChunk.entries()) {
  const llmList = llmByChunk.get(chunkKey);
  if (!llmList) continue;
  
  for (let i = 0; i < spacyList.length; i++) {
    const sp = spacyList[i];
    const spKey = `${chunkKey}:${sp.start}:${sp.end}`;
    
    for (let j = 0; j < llmList.length; j++) {
      const ll = llmList[j];
      const llKey = `${chunkKey}:${ll.start}:${ll.end}`;
      
      if (hasOverlap(sp.start, sp.end, ll.start, ll.end)) {
        overlaps.push({
          chunkKey,
          spacyStart: sp.start,
          spacyEnd: sp.end,
          spacySurface: sp.surface,
          llmStart: ll.start,
          llmEnd: ll.end,
          llmSurface: ll.surface,
          overlapStart: Math.max(sp.start, ll.start),
          overlapEnd: Math.min(sp.end, ll.end)
        });
        spacyMatched.add(spKey);
        llmMatched.add(llKey);
      }
    }
  }
}

spacyMatchedCount = spacyMatched.size;
llmMatchedCount = llmMatched.size;

console.log(`总位置数:`);
console.log(`  spaCy: ${spacyOffsets.length}`);
console.log(`  LLM:   ${llmOffsets.length}`);
console.log(`\n区间交集重叠:`);
console.log(`  重叠位置对: ${overlaps.length} 对`);
console.log(`  spaCy 有交集的位置: ${spacyMatchedCount} (${(spacyMatchedCount/spacyOffsets.length*100).toFixed(1)}%)`);
console.log(`  LLM 有交集的位置: ${llmMatchedCount} (${(llmMatchedCount/llmOffsets.length*100).toFixed(1)}%)`);
console.log(`  spaCy 独有位置: ${spacyOffsets.length - spacyMatchedCount}`);
console.log(`  LLM 独有位置: ${llmOffsets.length - llmMatchedCount}\n`);

// 分析交集情况
console.log('========================================');
console.log('2. 交集详细分析（前 20 对）');
console.log('========================================\n');

overlaps.slice(0, 20).forEach((ov, idx) => {
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`交集 #${idx + 1}`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`ChunkKey: ${ov.chunkKey.slice(0, 60)}...`);
  console.log(`spaCy: [${ov.spacyStart}-${ov.spacyEnd}] "${ov.spacySurface}"`);
  console.log(`LLM:   [${ov.llmStart}-${ov.llmEnd}] "${ov.llmSurface}"`);
  console.log(`交集区间: [${ov.overlapStart}-${ov.overlapEnd}]`);
  console.log(`名词相同: ${ov.spacySurface.toLowerCase() === ov.llmSurface.toLowerCase() ? '✅ 是' : '❌ 否'}`);
  console.log();
});

// 统计名词文本匹配度
const surfaceMatch = overlaps.filter(ov => 
  ov.spacySurface.toLowerCase() === ov.llmSurface.toLowerCase()
).length;

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('总结');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log(`区间有交集的位置对: ${overlaps.length}`);
console.log(`其中名词文本相同: ${surfaceMatch} (${(surfaceMatch/overlaps.length*100).toFixed(1)}%)`);
console.log(`其中名词文本不同: ${overlaps.length - surfaceMatch} (${((overlaps.length - surfaceMatch)/overlaps.length*100).toFixed(1)}%)`);
console.log(`\nspaCy 位置利用率: ${(spacyMatchedCount/spacyOffsets.length*100).toFixed(1)}%`);
console.log(`LLM 位置利用率: ${(llmMatchedCount/llmOffsets.length*100).toFixed(1)}%`);

console.log('\n✅ 分析完成！');
