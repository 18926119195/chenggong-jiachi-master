/**
 * 分析实验组二中 medium/low 置信度最早出现位置
 * 目标：定位每个批次 prompt 中哪个字符位置开始出现注意力飘散
 */

import fs from 'fs';
import path from 'path';

const GROUP2_OUTPUT = path.join(process.cwd(), 's1-nouns-with-offsets-group2.json');
const SNAPSHOT_DIR = path.join(process.cwd(), 's1-snapshots-group2');
const OUTPUT_PATH = path.join(process.cwd(), 's1-attention-drift-analysis.json');

console.log('========== 分析实验组二注意力飘散位置 ==========\n');

const group2Data = JSON.parse(fs.readFileSync(GROUP2_OUTPUT, 'utf-8'));

// 构建 chunkKey -> [截断列表]
const truncsByChunk = new Map();
const snapshotsByBatch = new Map();

const snapshotFiles = fs.readdirSync(SNAPSHOT_DIR).filter(f => f.endsWith('.json'));
for (const file of snapshotFiles) {
  const snapshot = JSON.parse(fs.readFileSync(path.join(SNAPSHOT_DIR, file), 'utf-8'));
  snapshotsByBatch.set(snapshot.batchId, snapshot);
  
  for (const trunc of snapshot.truncations) {
    if (!truncsByChunk.has(trunc.chunkKey)) truncsByChunk.set(trunc.chunkKey, []);
    truncsByChunk.get(trunc.chunkKey).push({ 
      ...trunc, 
      batchId: snapshot.batchId 
    });
  }
}

console.log(`快照索引构建完成: ${snapshotsByBatch.size} 个批次, ${truncsByChunk.size} 个 chunk\n`);

// 反查 offset 所属截断
function findTruncationForOffset(chunkKey, offsetStart, offsetEnd) {
  const truncs = truncsByChunk.get(chunkKey);
  if (!truncs) return null;
  return truncs.find(t => offsetStart >= t.start && offsetEnd <= t.end) || null;
}

// 按批次统计 medium/low 出现位置
const batchDriftStats = new Map();

for (const noun of group2Data.nouns) {
  for (const off of noun.offsets) {
    if (off.confidence === 'medium' || off.confidence === 'low') {
      const trunc = findTruncationForOffset(off.chunkKey, off.start, off.end);
      
      if (trunc) {
        if (!batchDriftStats.has(trunc.batchId)) {
          batchDriftStats.set(trunc.batchId, []);
        }
        batchDriftStats.get(trunc.batchId).push({
          noun: noun.surface,
          truncId: trunc.truncId,
          machineCode: trunc.machineCode,
          confidence: off.confidence,
          truncStart: trunc.start,
          truncEnd: trunc.end,
        });
      }
    }
  }
}

console.log(`检测到 ${batchDriftStats.size} 个批次存在 medium/low 置信度\n`);

// 分析每个批次
const batchAnalysis = [];

for (const [batchId, drifts] of batchDriftStats.entries()) {
  const snapshot = snapshotsByBatch.get(batchId);
  if (!snapshot) continue;

  // 找最早出现 drift 的截断
  drifts.sort((a, b) => a.truncId - b.truncId);
  const firstDrift = drifts[0];
  
  // 计算该截断在 prompt 中的位置
  const promptLines = snapshot.prompt.split('\n');
  let promptCharPos = 0;
  let truncPromptStartPos = -1;
  
  for (const line of promptLines) {
    if (line.includes(firstDrift.machineCode)) {
      truncPromptStartPos = promptCharPos;
      break;
    }
    promptCharPos += line.length + 1; // +1 for newline
  }

  // 统计该批次各置信度数量
  const mediumCount = drifts.filter(d => d.confidence === 'medium').length;
  const lowCount = drifts.filter(d => d.confidence === 'low').length;

  batchAnalysis.push({
    batchId,
    totalTruncations: snapshot.truncations.length,
    totalDrifts: drifts.length,
    mediumCount,
    lowCount,
    firstDrift: {
      truncId: firstDrift.truncId,
      machineCode: firstDrift.machineCode,
      noun: firstDrift.noun,
      confidence: firstDrift.confidence,
      promptCharPosition: truncPromptStartPos,
      promptCharPositionRatio: truncPromptStartPos >= 0 
        ? (truncPromptStartPos / snapshot.prompt.length * 100).toFixed(1) + '%'
        : 'N/A',
    },
    allDrifts: drifts.map(d => ({
      truncId: d.truncId,
      machineCode: d.machineCode,
      noun: d.noun,
      confidence: d.confidence,
    })),
  });
}

// 按 batchId 排序
batchAnalysis.sort((a, b) => a.batchId - b.batchId);

// 全局统计
const globalStats = {
  totalBatchesWithDrift: batchAnalysis.length,
  totalBatches: snapshotsByBatch.size,
  driftBatchRatio: (batchAnalysis.length / snapshotsByBatch.size * 100).toFixed(1) + '%',
  
  avgFirstDriftTruncId: (batchAnalysis.reduce((sum, b) => sum + b.firstDrift.truncId, 0) / batchAnalysis.length).toFixed(1),
  
  minFirstDriftTruncId: Math.min(...batchAnalysis.map(b => b.firstDrift.truncId)),
  maxFirstDriftTruncId: Math.max(...batchAnalysis.map(b => b.firstDrift.truncId)),
  
  avgPromptCharPositionRatio: (batchAnalysis
    .filter(b => b.firstDrift.promptCharPosition >= 0)
    .reduce((sum, b) => sum + parseFloat(b.firstDrift.promptCharPositionRatio), 0) / 
    batchAnalysis.filter(b => b.firstDrift.promptCharPosition >= 0).length
  ).toFixed(1) + '%',
};

const report = {
  meta: {
    experimentGroup: '实验组二（有兜底）',
    totalNouns: group2Data.nouns.length,
    generatedAt: new Date().toISOString(),
  },
  globalStats,
  batchAnalysis,
};

fs.writeFileSync(OUTPUT_PATH, JSON.stringify(report, null, 2), 'utf-8');

console.log('========== 分析完成 ==========');
console.log(`存在飘散的批次: ${globalStats.totalBatchesWithDrift} / ${globalStats.totalBatches} (${globalStats.driftBatchRatio})`);
console.log(`最早飘散截断编号平均值: ${globalStats.avgFirstDriftTruncId}`);
console.log(`最早飘散截断编号范围: ${globalStats.minFirstDriftTruncId} - ${globalStats.maxFirstDriftTruncId}`);
console.log(`飘散开始位置在 prompt 中的平均占比: ${globalStats.avgPromptCharPositionRatio}`);
console.log(`\n详细报告已保存: ${OUTPUT_PATH}`);
