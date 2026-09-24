import fs from 'fs';
const data = JSON.parse(fs.readFileSync('s1-nouns-with-offsets-group2.json', 'utf8'));

// 读取所有批次快照元数据，获取每个批次的输入信息
const snapshotDir = 's1-snapshots-group2';
const batchFiles = fs.readdirSync(snapshotDir).filter(f => f.startsWith('batch-') && f.endsWith('.json'));

const batchAnalysis = [];

for (const file of batchFiles) {
  const batchData = JSON.parse(fs.readFileSync(`${snapshotDir}/${file}`, 'utf8'));
  const batchIndex = parseInt(file.match(/batch-(\d+)/)[1]);
  
  // 获取该批次的输入截断列表
  const truncations = batchData.truncations || [];
  const totalTruncations = truncations.length;
  
  // 计算该批次的prompt总字符数（所有截断文本加编号标记）
  let promptTotalChars = 0;
  truncations.forEach((t, idx) => {
    const marker = `【【${idx + 1}】】`;
    promptTotalChars += marker.length + (t.text || '').length;
  });
  
  // 找出该批次中所有名词的首次medium/low出现位置
  const batchNouns = data.nouns.filter(noun => {
    return noun.offsets.some(offset => {
      const chunkKey = offset.chunkKey;
      return truncations.some(t => t.chunkKey === chunkKey);
    });
  });
  
  // 找到该批次中首个medium或low置信度的名词及其位置
  let firstDriftNoun = null;
  let firstDriftTruncIndex = Infinity;
  let firstDriftConfidence = null;
  
  batchNouns.forEach(noun => {
    noun.offsets.forEach(offset => {
      if (offset.confidence === 'medium' || offset.confidence === 'low') {
        const truncIndex = truncations.findIndex(t => t.chunkKey === offset.chunkKey);
        if (truncIndex !== -1 && truncIndex < firstDriftTruncIndex) {
          firstDriftTruncIndex = truncIndex;
          firstDriftNoun = noun.surface;
          firstDriftConfidence = offset.confidence;
        }
      }
    });
  });
  
  // 如果有飘散，计算飘散开始时的prompt字符位置
  let driftStartChar = null;
  let driftStartPercent = null;
  if (firstDriftTruncIndex !== Infinity) {
    driftStartChar = 0;
    for (let i = 0; i < firstDriftTruncIndex; i++) {
      const marker = `【【${i + 1}】】`;
      driftStartChar += marker.length + (truncations[i].text || '').length;
    }
    driftStartPercent = ((driftStartChar / promptTotalChars) * 100).toFixed(1);
  }
  
  // 统计该批次的置信度分布
  const confidenceCount = { high: 0, medium: 0, low: 0 };
  batchNouns.forEach(noun => {
    noun.offsets.forEach(offset => {
      const truncIndex = truncations.findIndex(t => t.chunkKey === offset.chunkKey);
      if (truncIndex !== -1) {
        confidenceCount[offset.confidence]++;
      }
    });
  });
  
  batchAnalysis.push({
    batchIndex,
    totalTruncations,
    promptTotalChars,
    firstDriftTruncIndex: firstDriftTruncIndex === Infinity ? null : firstDriftTruncIndex + 1,
    firstDriftNoun,
    firstDriftConfidence,
    driftStartChar,
    driftStartPercent: driftStartPercent ? parseFloat(driftStartPercent) : null,
    confidenceDistribution: confidenceCount,
    hasDrift: firstDriftTruncIndex !== Infinity
  });
}

// 按批次索引排序
batchAnalysis.sort((a, b) => a.batchIndex - b.batchIndex);

// 输出结果
fs.writeFileSync('s1-group2-drift-start-analysis.json', JSON.stringify({
  meta: {
    description: '实验组二每批次注意力飘散起始点分析',
    totalBatches: batchAnalysis.length,
    batchesWithDrift: batchAnalysis.filter(b => b.hasDrift).length,
    analysisDate: new Date().toISOString()
  },
  batches: batchAnalysis,
  summary: {
    avgDriftStartTruncIndex: batchAnalysis.filter(b => b.hasDrift).reduce((sum, b) => sum + b.firstDriftTruncIndex, 0) / batchAnalysis.filter(b => b.hasDrift).length,
    avgDriftStartPercent: batchAnalysis.filter(b => b.hasDrift).reduce((sum, b) => sum + b.driftStartPercent, 0) / batchAnalysis.filter(b => b.hasDrift).length,
    avgPromptChars: batchAnalysis.reduce((sum, b) => sum + b.promptTotalChars, 0) / batchAnalysis.length,
    earliestDrift: Math.min(...batchAnalysis.filter(b => b.hasDrift).map(b => b.firstDriftTruncIndex)),
    latestDrift: Math.max(...batchAnalysis.filter(b => b.hasDrift).map(b => b.firstDriftTruncIndex))
  }
}, null, 2), 'utf8');

console.log('✓ 分析完成，共处理', batchAnalysis.length, '个批次');
console.log('✓ 其中', batchAnalysis.filter(b => b.hasDrift).length, '个批次存在飘散');
console.log('✓ 结果已保存至 s1-group2-drift-start-analysis.json');
