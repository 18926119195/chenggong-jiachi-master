/**
 * 检查 s0-hits.json 中的 hit 顺序
 * 如果顺序和 spaCy 结果不一致，可能导致 alreadyHit 逻辑产生不同结果
 */

import fs from 'fs';

const hitsData = JSON.parse(
  fs.readFileSync('C:\\Users\\Administrator\\Desktop\\2026-09-21-master\\s0-hits.json', 'utf-8')
);

// 检查前几个 chunk 的 hit 顺序
console.log('检查 s0-hits.json 中 hit 的顺序...\n');

for (let i = 0; i < 3; i++) {
  const chunk = hitsData.hitsByChunk[i];
  console.log(`Chunk ${i + 1}:`);
  console.log(`  hit 数量: ${chunk.hits.length}`);
  console.log('  前10个 hit:');
  
  for (let j = 0; j < Math.min(10, chunk.hits.length); j++) {
    const h = chunk.hits[j];
    console.log(`    ${j + 1}. "${h.surface}" (${h.start}-${h.end})`);
  }
  
  // 检查是否按 start 排序
  const starts = chunk.hits.map(h => h.start);
  const isSorted = starts.every((s, i) => i === 0 || s >= starts[i - 1]);
  console.log(`  是否按 start 排序: ${isSorted ? '✅ 是' : '❌ 否'}`);
  console.log('');
}

// 检查 hit 是否有重叠
console.log('检查 hit 是否有重叠...');
let chunksWithOverlap = 0;
let totalOverlaps = 0;

for (const chunk of hitsData.hitsByChunk) {
  let hasOverlap = false;
  for (let i = 1; i < chunk.hits.length; i++) {
    if (chunk.hits[i].start < chunk.hits[i - 1].end) {
      hasOverlap = true;
      totalOverlaps++;
    }
  }
  if (hasOverlap) chunksWithOverlap++;
}

console.log(`有重叠的 chunk 数: ${chunksWithOverlap}`);
console.log(`重叠 hit 数: ${totalOverlaps}`);
