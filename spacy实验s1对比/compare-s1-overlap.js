/**
 * 对比 spaCy vs LLM 的 S1 名词提取重叠度
 * 
 * 分析维度：
 * 1. 按 chunkKey + offset 匹配（精确位置重叠）
 * 2. 按 chunkKey 匹配（同一 chunk 内不同位置的名词）
 * 3. 展示独有名词样本
 */

import fs from 'fs';
import path from 'path';

const SPACY_OUTPUT = path.join(process.cwd(), 'test-s1-spacy-output.json');
const LLM_OUTPUT = path.join(process.cwd(), 's1-nouns-with-offsets.json');

console.log('========================================');
console.log('spaCy vs LLM S1 名词提取重叠度分析');
console.log('========================================\n');

// 加载数据
const spacyData = JSON.parse(fs.readFileSync(SPACY_OUTPUT, 'utf-8'));
const llmData = JSON.parse(fs.readFileSync(LLM_OUTPUT, 'utf-8'));

console.log('数据加载:');
console.log(`  spaCy: ${spacyData.nouns.length} 个名词, ${spacyData.meta.totalOffsets} 个位置`);
console.log(`  LLM:   ${llmData.nouns.length} 个名词, ${llmData.meta.totalOffsets} 个位置\n`);

// 构建位置索引：chunkKey + start + end -> noun surface
function buildPositionIndex(data) {
  const index = new Map(); // key: "chunkKey:start:end" -> noun surface
  const chunkIndex = new Map(); // key: chunkKey -> [noun surfaces]
  
  for (const noun of data.nouns) {
    for (const offset of noun.offsets) {
      const posKey = `${offset.chunkKey}:${offset.start}:${offset.end}`;
      index.set(posKey, noun.surface);
      
      if (!chunkIndex.has(offset.chunkKey)) {
        chunkIndex.set(offset.chunkKey, []);
      }
      chunkIndex.get(offset.chunkKey).push(noun.surface);
    }
  }
  
  return { positionIndex: index, chunkIndex };
}

const spacyIndexes = buildPositionIndex(spacyData);
const llmIndexes = buildPositionIndex(llmData);

// 1. 精确位置重叠（chunkKey + offset 完全相同）
const spacyPositions = new Set(spacyIndexes.positionIndex.keys());
const llmPositions = new Set(llmIndexes.positionIndex.keys());

const exactOverlap = [...spacyPositions].filter(pos => llmPositions.has(pos));
const spacyOnlyPositions = [...spacyPositions].filter(pos => !llmPositions.has(pos));
const llmOnlyPositions = [...llmPositions].filter(pos => !spacyPositions.has(pos));

console.log('========================================');
console.log('1. 精确位置重叠分析 (chunkKey + offset)');
console.log('========================================');
console.log(`总位置数:`);
console.log(`  spaCy: ${spacyPositions.size}`);
console.log(`  LLM:   ${llmPositions.size}`);
console.log(`\n重叠情况:`);
console.log(`  精确重叠: ${exactOverlap.length} 个位置 (${(exactOverlap.length / spacyPositions.size * 100).toFixed(1)}% of spaCy)`);
console.log(`  spaCy独有: ${spacyOnlyPositions.length} 个位置`);
console.log(`  LLM独有: ${llmOnlyPositions.length} 个位置\n`);

// 2. Chunk 级别重叠（同一 chunk，不管位置）
const spacyChunks = new Set(spacyIndexes.chunkIndex.keys());
const llmChunks = new Set(llmIndexes.chunkIndex.keys());

const chunkOverlap = [...spacyChunks].filter(chunk => llmChunks.has(chunk));
const spacyOnlyChunks = [...spacyChunks].filter(chunk => !llmChunks.has(chunk));
const llmOnlyChunks = [...llmChunks].filter(chunk => !spacyChunks.has(chunk));

console.log('========================================');
console.log('2. Chunk 级别重叠分析');
console.log('========================================');
console.log(`涉及 chunk 数:`);
console.log(`  spaCy: ${spacyChunks.size}`);
console.log(`  LLM:   ${llmChunks.size}`);
console.log(`\n重叠情况:`);
console.log(`  共同 chunk: ${chunkOverlap.length} 个`);
console.log(`  spaCy独有 chunk: ${spacyOnlyChunks.length} 个`);
console.log(`  LLM独有 chunk: ${llmOnlyChunks.length} 个\n`);

// 3. 采样对比：独有名词长什么样
console.log('========================================');
console.log('3. 独有名词样本对比');
console.log('========================================\n');

// 采样 spaCy 独有
const spacyOnlySamples = spacyOnlyPositions.slice(0, 15).map(posKey => {
  const [chunkKey, start, end] = posKey.split(':');
  return {
    noun: spacyIndexes.positionIndex.get(posKey),
    chunkKey: chunkKey.slice(0, 30) + '...',
    offset: `${start}-${end}`
  };
});

// 采样 LLM 独有
const llmOnlySamples = llmOnlyPositions.slice(0, 15).map(posKey => {
  const [chunkKey, start, end] = posKey.split(':');
  return {
    noun: llmIndexes.positionIndex.get(posKey),
    chunkKey: chunkKey.slice(0, 30) + '...',
    offset: `${start}-${end}`
  };
});

console.log('spaCy 独有名词样本（前15个）:');
console.log('─'.repeat(80));
console.table(spacyOnlySamples);

console.log('\nLLM 独有名词样本（前15个）:');
console.log('─'.repeat(80));
console.table(llmOnlySamples);

// 4. 统计名词长度分布
function analyzeLengthDistribution(data, label) {
  const lengths = data.nouns.map(n => n.surface.length);
  lengths.sort((a, b) => a - b);
  const median = lengths[Math.floor(lengths.length / 2)];
  const avg = lengths.reduce((sum, l) => sum + l, 0) / lengths.length;
  const min = Math.min(...lengths);
  const max = Math.max(...lengths);
  
  return { label, min, max, avg: avg.toFixed(1), median, count: lengths.length };
}

console.log('\n========================================');
console.log('4. 名词长度分布');
console.log('========================================');
console.table([
  analyzeLengthDistribution(spacyData, 'spaCy'),
  analyzeLengthDistribution(llmData, 'LLM')
]);

// 5. 重叠名词详细展示（包含原始残文）
console.log('\n========================================');
console.log('5. 精确位置重叠详细分析（全部 5 个）');
console.log('========================================\n');

// 加载 s0-quality-report 获取残文原文
const qualityReport = JSON.parse(fs.readFileSync(path.join(process.cwd(), 's0-quality-report.json'), 'utf-8'));
const residualsMap = new Map();
for (const residual of qualityReport.residuals) {
  const key = `${residual.chunkKey}:${residual.start}:${residual.end}`;
  residualsMap.set(key, residual.text);
}

exactOverlap.forEach((posKey, index) => {
  const [chunkKey, start, end] = posKey.split(':');
  const spacyNoun = spacyIndexes.positionIndex.get(posKey);
  const llmNoun = llmIndexes.positionIndex.get(posKey);
  
  // 尝试找到这个位置的残文原文
  let residualText = '（未找到残文原文）';
  for (const [resKey, text] of residualsMap.entries()) {
    const [resChunkKey, resStart, resEnd] = resKey.split(':');
    if (resChunkKey === chunkKey) {
      // 检查这个名词的位置是否在残文范围内
      const nounStart = parseInt(start, 10);
      const resStartNum = parseInt(resStart, 10);
      const resEndNum = parseInt(resEnd, 10);
      if (nounStart >= resStartNum && nounStart < resEndNum) {
        residualText = text;
        break;
      }
    }
  }
  
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`重叠 #${index + 1}`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`ChunkKey: ${chunkKey}`);
  console.log(`位置: ${start}-${end}`);
  console.log(`残文原文: "${residualText}"`);
  console.log(`spaCy 识别: "${spacyNoun}"`);
  console.log(`LLM 识别:   "${llmNoun}"`);
  console.log(`是否一致: ${spacyNoun === llmNoun ? '✅ 是' : '❌ 否'}`);
  console.log();
});

// 统计一致性
const consistentCount = exactOverlap.filter(posKey => {
  return spacyIndexes.positionIndex.get(posKey) === llmIndexes.positionIndex.get(posKey);
}).length;

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('总结');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log(`精确位置重叠: ${exactOverlap.length} 个`);
console.log(`识别结果一致: ${consistentCount} 个 (${(consistentCount / exactOverlap.length * 100).toFixed(1)}%)`);
console.log(`识别结果不一致: ${exactOverlap.length - consistentCount} 个 (${((exactOverlap.length - consistentCount) / exactOverlap.length * 100).toFixed(1)}%)`);

console.log('\n✅ 分析完成！');
