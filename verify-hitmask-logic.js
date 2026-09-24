// 用 s0-hits.json 里那段真实数据复现 buildHitMaskForChunk 逻辑，验证到底为什么两条都被保留
function buildHitMaskForChunk(chunkText, nounsInChunk) {
  const hitMask = new Array(chunkText.length).fill(false);
  const hits = [];
  for (const n of nounsInChunk) {
    const { start, end, surface } = n;
    if (start < 0 || end > chunkText.length || start >= end) continue;
    let alreadyHit = false;
    for (let i = start; i < end; i++) {
      if (hitMask[i]) { alreadyHit = true; break; }
    }
    if (!alreadyHit) {
      for (let i = start; i < end; i++) hitMask[i] = true;
      hits.push({ surface, start, end });
    } else {
      console.log(`跳过（重叠）: "${surface}" [${start},${end})`);
    }
  }
  return { hitMask, hits };
}

// 构造一个假的chunkText，长度至少400
const chunkText = ' '.repeat(500);

// 关键：还原 processChunk 里 nouns 和 noun_phrases 拼接的真实顺序
// spaCy sidecar 返回顺序未知，这里测试两种可能顺序
console.log('=== 顺序A：noun_phrases（la subjectivité, start=360）先，noun（subjectivité, start=363）后 ===');
buildHitMaskForChunk(chunkText, [
  { surface: 'la subjectivité', start: 360, end: 375 },
  { surface: 'subjectivité', start: 363, end: 375 },
]);

console.log('\n=== 顺序B：noun（subjectivité, start=363）先，noun_phrase（la subjectivité, start=360）后 ===');
buildHitMaskForChunk(chunkText, [
  { surface: 'subjectivité', start: 363, end: 375 },
  { surface: 'la subjectivité', start: 360, end: 375 },
]);
