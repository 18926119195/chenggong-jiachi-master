/**
 * 诊断 19 个真实飘散批次的 non-high 分布模式
 * 对每个批次：
 *   1. 找出所有 non-high 的名词条目，按 truncId 排序
 *   2. 对每个 non-high 条目，检查该名词是否真的在标记的截断里
 *   3. 判断模式：
 *      - 整体偏移型：大部分 non-high 名词都不在标记的截断里，且编号连续
 *      - 孤立错误型：只有少数 non-high 名词不在标记截断里，其他 non-high 是因为兜底搜索（名词在文本里但在扩窗/全chunk找到）
 */
import fs from 'fs';
import path from 'path';

const SNAPSHOT_DIR = 's1-snapshots-group2';
const DRIFT_ANALYSIS = JSON.parse(fs.readFileSync('s1-group2-drift-token-analysis.json', 'utf-8'));

// 找出 19 个真实飘散的批次 ID
const trueDriftBatchIds = DRIFT_ANALYSIS.results
  .filter(r => r.hasDrift && r.nounActuallyInTruncText === false)
  .map(r => r.batchId);

console.log('=== 诊断 19 个真实飘散批次的 non-high 分布模式 ===\n');
console.log('批次 ID:', trueDriftBatchIds.join(', '), '\n');

const diagnostics = [];

for (const batchId of trueDriftBatchIds) {
  const batch = JSON.parse(fs.readFileSync(path.join(SNAPSHOT_DIR, `batch-${batchId}.json`), 'utf-8'));
  
  // 找出所有 non-high 条目
  const nonHighEntries = batch.parsedNouns
    .map(entry => {
      const nonHighOffsets = entry.offsets.filter(o => o.confidence !== 'high');
      if (nonHighOffsets.length === 0) return null;
      
      const trunc = batch.truncations.find(t => t.truncId === entry.truncId);
      const nounInText = trunc ? trunc.text.toLowerCase().includes(entry.noun.toLowerCase()) : false;
      
      return {
        truncId: entry.truncId,
        noun: entry.noun,
        confidence: nonHighOffsets[0].confidence,
        nounInText,
      };
    })
    .filter(e => e !== null)
    .sort((a, b) => a.truncId - b.truncId);
  
  const totalNonHigh = nonHighEntries.length;
  const notInText = nonHighEntries.filter(e => !e.nounInText).length;
  const notInTextRatio = totalNonHigh > 0 ? (notInText / totalNonHigh) * 100 : 0;
  
  // 判断是否连续编号（整体偏移特征）
  const notInTextTruncIds = nonHighEntries.filter(e => !e.nounInText).map(e => e.truncId);
  let consecutiveRuns = 0;
  let currentRun = 1;
  for (let i = 1; i < notInTextTruncIds.length; i++) {
    if (notInTextTruncIds[i] === notInTextTruncIds[i-1] + 1) {
      currentRun++;
    } else {
      if (currentRun >= 3) consecutiveRuns++;
      currentRun = 1;
    }
  }
  if (currentRun >= 3) consecutiveRuns++;
  
  const pattern = 
    notInTextRatio >= 60 && consecutiveRuns > 0 ? '整体偏移型' :
    notInTextRatio >= 30 && notInText >= 5 ? '混合型（需重跑）' :
    '孤立错误型（兜底可处理）';
  
  diagnostics.push({
    batchId,
    totalTruncations: batch.truncations.length,
    totalNonHigh,
    notInText,
    notInTextRatio: parseFloat(notInTextRatio.toFixed(1)),
    consecutiveRuns,
    pattern,
    firstDriftTruncId: DRIFT_ANALYSIS.results.find(r => r.batchId === batchId)?.firstDriftTruncId,
  });
  
  console.log(`批次 ${batchId}:`);
  console.log(`  截断总数: ${batch.truncations.length}`);
  console.log(`  non-high 名词总数: ${totalNonHigh}`);
  console.log(`  其中"名词不在标记截断里": ${notInText} (${notInTextRatio.toFixed(1)}%)`);
  console.log(`  连续编号段(≥3个): ${consecutiveRuns}`);
  console.log(`  模式判断: ${pattern}`);
  console.log('');
}

const needRerun = diagnostics.filter(d => d.pattern !== '孤立错误型（兜底可处理）');

console.log('\n=== 汇总 ===');
console.log('真实飘散批次总数:', diagnostics.length);
console.log('整体偏移型/混合型（建议重跑）:', needRerun.length);
console.log('孤立错误型（不需重跑）:', diagnostics.length - needRerun.length);

fs.writeFileSync('s1-group2-rerun-recommendation.json', JSON.stringify({
  meta: {
    description: 'non-high 分布模式诊断与重跑建议',
    trueDriftBatches: diagnostics.length,
    needRerunBatches: needRerun.length,
    canSkipBatches: diagnostics.length - needRerun.length,
  },
  diagnostics,
  needRerun: needRerun.map(d => d.batchId),
}, null, 2), 'utf-8');

console.log('\n建议重跑的批次:', needRerun.map(d => d.batchId).join(', '));
console.log('\n完整诊断已保存至: s1-group2-rerun-recommendation.json');
