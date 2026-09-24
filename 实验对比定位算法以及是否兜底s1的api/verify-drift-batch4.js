import fs from 'fs';

const data = JSON.parse(fs.readFileSync('s1-nouns-with-offsets-group2.json', 'utf8'));
const batch4 = JSON.parse(fs.readFileSync('s1-snapshots-group2/batch-4.json', 'utf8'));

console.log('=== 批次 4 验证：第一个 medium/low 名词 ===\n');

// 找出批次4中所有 medium/low 的名词
const batch4Truncations = batch4.truncations;
const batch4ChunkKeys = new Set(batch4Truncations.map(t => t.chunkKey));

const driftNouns = [];

data.nouns.forEach(noun => {
  noun.offsets.forEach(offset => {
    if (batch4ChunkKeys.has(offset.chunkKey) && 
        (offset.confidence === 'medium' || offset.confidence === 'low')) {
      driftNouns.push({
        surface: noun.surface,
        ...offset
      });
    }
  });
});

// 按 chunk 在批次中的位置排序
driftNouns.sort((a, b) => {
  const aTrunc = batch4Truncations.find(t => t.chunkKey === a.chunkKey);
  const bTrunc = batch4Truncations.find(t => t.chunkKey === b.chunkKey);
  return (aTrunc?.truncId || 999) - (bTrunc?.truncId || 999);
});

console.log(`批次 4 共有 ${driftNouns.length} 个 medium/low 置信度名词\n`);

// 验证前 10 个
const toVerify = driftNouns.slice(0, 10);

toVerify.forEach((drift, idx) => {
  const trunc = batch4Truncations.find(t => t.chunkKey === drift.chunkKey);
  const actuallyInText = trunc.text.includes(drift.surface);
  
  console.log(`${idx + 1}. 名词: "${drift.surface}"`);
  console.log(`   置信度: ${drift.confidence}`);
  console.log(`   定位算法认为在截断【【${trunc.truncId}】】`);
  console.log(`   截断实际文本: "${trunc.text}"`);
  console.log(`   ✓ 名词真的在这个截断里？ ${actuallyInText ? '是' : '否 ❌'}`);
  
  // 在 LLM 输出中找这个名词是哪个截断输出的
  const lines = batch4.llmRawOutput.split('\n');
  let llmSaidTruncId = null;
  for (const line of lines) {
    const match = line.match(/【【(\d+)】】(.+)/);
    if (match) {
      const truncId = parseInt(match[1]);
      const nouns = match[2].split(',').map(s => s.trim());
      if (nouns.some(n => n === drift.surface || n.includes(drift.surface))) {
        llmSaidTruncId = truncId;
        break;
      }
    }
  }
  
  if (llmSaidTruncId) {
    console.log(`   LLM 实际输出中标记为【【${llmSaidTruncId}】】`);
    const llmTrunc = batch4Truncations.find(t => t.truncId === llmSaidTruncId);
    if (llmTrunc) {
      console.log(`   【【${llmSaidTruncId}】】的文本: "${llmTrunc.text}"`);
      console.log(`   ✓ 在 LLM 标记的截断里？ ${llmTrunc.text.includes(drift.surface) ? '是' : '否'}`);
    }
  }
  
  console.log('');
});

console.log('\n=== 结论 ===');
console.log('如果"定位算法认为的截断"和"名词真实不在里面"，这说明是定位算法的问题');
console.log('如果"LLM标记的截断"和"名词也不在里面"，这说明是 LLM 注意力飘散问题');
