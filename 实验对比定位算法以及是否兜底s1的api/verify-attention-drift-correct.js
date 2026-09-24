import fs from 'fs';

// 读取数据
const report = JSON.parse(fs.readFileSync('s0-quality-report.json', 'utf8'));
const s1Old = JSON.parse(fs.readFileSync('s1-nouns-with-offsets-temp01-window50-1455nouns.json', 'utf8'));

// 建立截断 ID -> {chunkKey, start, end, text} 的映射
const truncMap = new Map();
for (const trunc of report.residuals || []) {
  const truncId = `${trunc.chunkKey}-${trunc.start}`;
  truncMap.set(truncId, trunc);
}

console.log(`加载截断数据: ${truncMap.size} 个残留区间\n`);

// 筛选所有 medium/low 的位置
const mediumLowOffsets = [];
for (const noun of s1Old.nouns) {
  for (const offset of noun.offsets) {
    if (offset.confidence === 'medium' || offset.confidence === 'low') {
      mediumLowOffsets.push({
        noun: noun.surface,
        nounId: noun.id,
        chunkKey: offset.chunkKey,
        offsetStart: offset.start,
        offsetEnd: offset.end,
        confidence: offset.confidence,
        sourceTruncIds: noun.sourceTruncIds || [],
      });
    }
  }
}

console.log(`找到 ${mediumLowOffsets.length} 个 medium/low 置信度的位置\n`);

// 验证每个位置是否在其对应的截断内
let inCorrectTrunc = 0;
let inSameChunkOtherTrunc = 0;
let inOtherChunk = 0;
const driftExamples = [];

for (const item of mediumLowOffsets) {
  // 检查1：这个 chunk 是否被 LLM 看过（sourceTruncIds 里有该 chunkKey 的截断）
  const truncsInSameChunk = item.sourceTruncIds
    .filter((id) => id.startsWith(item.chunkKey + '-'))
    .map((id) => truncMap.get(id))
    .filter(Boolean);

  if (truncsInSameChunk.length === 0) {
    // LLM 从未看过这个 chunk，却匹配到了这个 chunk
    inOtherChunk++;
    if (driftExamples.length < 20) {
      driftExamples.push({
        type: '跨chunk飘散',
        noun: item.noun,
        chunkKey: item.chunkKey,
        offsetStart: item.offsetStart,
        offsetEnd: item.offsetEnd,
        confidence: item.confidence,
        sourceTruncIds: item.sourceTruncIds.slice(0, 3),
      });
    }
    continue;
  }

  // 检查2：offset 是否在任意一个 sourceTruncIds 对应的截断区间内
  const inAnyTrunc = truncsInSameChunk.some((trunc) => {
    return item.offsetStart >= trunc.start && item.offsetEnd <= trunc.end;
  });

  if (inAnyTrunc) {
    inCorrectTrunc++;
  } else {
    inSameChunkOtherTrunc++;
    if (driftExamples.length < 20) {
      driftExamples.push({
        type: '同chunk内跨截断飘散',
        noun: item.noun,
        chunkKey: item.chunkKey,
        offsetStart: item.offsetStart,
        offsetEnd: item.offsetEnd,
        confidence: item.confidence,
        sourceTruncIds: item.sourceTruncIds.slice(0, 3),
        truncsInSameChunk: truncsInSameChunk.map((t) => ({ start: t.start, end: t.end, text: t.text.substring(0, 50) })),
      });
    }
  }
}

console.log(`结果统计：`);
console.log(`  在正确截断内：${inCorrectTrunc} (${(inCorrectTrunc / mediumLowOffsets.length * 100).toFixed(1)}%)`);
console.log(`  同chunk内跨截断：${inSameChunkOtherTrunc} (${(inSameChunkOtherTrunc / mediumLowOffsets.length * 100).toFixed(1)}%)`);
console.log(`  跨chunk飘散：${inOtherChunk} (${(inOtherChunk / mediumLowOffsets.length * 100).toFixed(1)}%)`);
console.log(`\n注意力飘散率（跨chunk + 跨截断）：${((inSameChunkOtherTrunc + inOtherChunk) / mediumLowOffsets.length * 100).toFixed(1)}%\n`);

if (driftExamples.length > 0) {
  console.log(`飘散案例（前20个）：`);
  console.log(JSON.stringify(driftExamples, null, 2));
}
