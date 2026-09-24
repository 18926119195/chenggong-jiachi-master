/**
 * 分析 s0-hits.json 中某个 chunk 的命中数量
 */

import fs from 'fs';

const hitsData = JSON.parse(
  fs.readFileSync('C:\\Users\\Administrator\\Desktop\\2026-09-21-master\\s0-hits.json', 'utf-8')
);

// 找到第3个 chunk
const chunk3 = hitsData.hitsByChunk[2];

console.log('第3个 chunk 分析:');
console.log('  chunkKey:', chunk3.chunkKey.slice(0, 50) + '...');
console.log('  命中数量:', chunk3.hits.length);

// 统计 unique surface
const surfaces = new Set(chunk3.hits.map(h => h.surface));
console.log('  唯一 surface 数:', surfaces.size);

// 统计位置重叠
const hitCount = chunk3.hits.length;
const uniqueStartEnd = new Set(chunk3.hits.map(h => `${h.start}-${h.end}`));
console.log('  唯一 (start,end) 对:', uniqueStartEnd.size);

// 显示前20个命中
console.log('\n前20个命中:');
for (let i = 0; i < Math.min(20, chunk3.hits.length); i++) {
  const h = chunk3.hits[i];
  console.log(`  ${i+1}. "${h.surface}" (${h.start}-${h.end})`);
}

// 统计重复命中
const hitByPos = {};
for (const h of chunk3.hits) {
  const key = `${h.start}-${h.end}`;
  if (!hitByPos[key]) hitByPos[key] = [];
  hitByPos[key].push(h.surface);
}

let duplicateCount = 0;
for (const [pos, surfaces] of Object.entries(hitByPos)) {
  if (surfaces.length > 1) {
    duplicateCount += surfaces.length - 1;
  }
}

console.log('\n重复命中数量:', duplicateCount);
console.log('（同一位置被多个 surface 标记）');
