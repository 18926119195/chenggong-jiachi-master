/**
 * 分析实验组二的快照，提取所有 medium/low 置信度的名词
 * 
 * 输出 s1-group2-medium-low-confidence-report.json，包含：
 *   - 每个批次中被标记为 medium/low 的名词
 *   - 对应的【【N】】机器符码
 *   - 该截断的 chunkKey, start, end, text
 *   - 名词的定位结果（offsets）
 * 
 * 用于人工核对：这些 medium/low 名词是否真的在对应的【【N】】截断内
 */

import fs from 'fs';
import path from 'path';

const SNAPSHOT_DIR = path.join(process.cwd(), 's1-snapshots-group2');
const OUTPUT_PATH = path.join(process.cwd(), 's1-group2-medium-low-confidence-report.json');

console.log('========== 分析实验组二快照 ==========\n');

if (!fs.existsSync(SNAPSHOT_DIR)) {
  console.error(`错误：快照目录不存在: ${SNAPSHOT_DIR}`);
  console.error('请先运行 node s1-llm-fill-group2.js');
  process.exit(1);
}

const snapshotFiles = fs.readdirSync(SNAPSHOT_DIR).filter(f => f.endsWith('.json')).sort((a, b) => {
  const aNum = parseInt(a.match(/\d+/)?.[0] || '0', 10);
  const bNum = parseInt(b.match(/\d+/)?.[0] || '0', 10);
  return aNum - bNum;
});

if (snapshotFiles.length === 0) {
  console.error('错误：快照目录为空');
  process.exit(1);
}

console.log(`读取 ${snapshotFiles.length} 个快照文件...\n`);

const report = {
  meta: {
    experimentGroup: '实验组二（带兜底）',
    snapshotDir: SNAPSHOT_DIR,
    totalBatches: snapshotFiles.length,
    generatedAt: new Date().toISOString(),
  },
  summary: {
    totalNouns: 0,
    mediumConfidence: 0,
    lowConfidence: 0,
    batchesWithMediumLow: 0,
  },
  batchesWithMediumLow: [],
};

for (const file of snapshotFiles) {
  const filePath = path.join(SNAPSHOT_DIR, file);
  const snapshot = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

  const mediumLowNouns = [];

  for (const parsedNoun of snapshot.parsedNouns) {
    report.summary.totalNouns++;

    const hasMediumOrLow = parsedNoun.offsets.some(
      off => off.confidence === 'medium' || off.confidence === 'low'
    );

    if (hasMediumOrLow) {
      const truncation = snapshot.truncations.find(t => t.truncId === parsedNoun.truncId);
      
      const mediumOffsets = parsedNoun.offsets.filter(off => off.confidence === 'medium');
      const lowOffsets = parsedNoun.offsets.filter(off => off.confidence === 'low');

      report.summary.mediumConfidence += mediumOffsets.length;
      report.summary.lowConfidence += lowOffsets.length;

      mediumLowNouns.push({
        noun: parsedNoun.noun,
        truncId: parsedNoun.truncId,
        machineCode: parsedNoun.machineCode,
        truncation: truncation ? {
          chunkKey: truncation.chunkKey,
          start: truncation.start,
          end: truncation.end,
          page: truncation.page,
          text: truncation.text,
        } : null,
        mediumOffsets,
        lowOffsets,
      });
    }
  }

  if (mediumLowNouns.length > 0) {
    report.summary.batchesWithMediumLow++;
    report.batchesWithMediumLow.push({
      batchId: snapshot.batchId,
      snapshotFile: file,
      nounsWithMediumLow: mediumLowNouns,
    });
  }
}

fs.writeFileSync(OUTPUT_PATH, JSON.stringify(report, null, 2), 'utf-8');

console.log('========== 分析完成 ==========');
console.log(`总名词数: ${report.summary.totalNouns}`);
console.log(`Medium 置信度位置: ${report.summary.mediumConfidence}`);
console.log(`Low 置信度位置: ${report.summary.lowConfidence}`);
console.log(`包含 medium/low 的批次: ${report.summary.batchesWithMediumLow} / ${snapshotFiles.length}`);
console.log(`\n输出文件: ${OUTPUT_PATH}`);

if (report.summary.batchesWithMediumLow > 0) {
  console.log('\n⚠️  需要人工核对的批次：');
  for (const batch of report.batchesWithMediumLow) {
    console.log(`   批次 ${batch.batchId}: ${batch.nounsWithMediumLow.length} 个名词有 medium/low 位置`);
  }
  console.log('\n人工核对步骤：');
  console.log('1. 打开生成的报告文件（JSON 格式）');
  console.log('2. 对于每个 medium/low 名词：');
  console.log('   - 查看其 machineCode（如【【3】】）');
  console.log('   - 查看对应的 truncation.text（该截断的完整文本）');
  console.log('   - 检查该名词是否真的出现在这个 truncation.text 内');
  console.log('3. 如果名词不在对应截断内，说明发生了"注意力飘散"：');
  console.log('   LLM 提取了其他截断的名词，或者兜底算法匹配到了错误位置');
}
