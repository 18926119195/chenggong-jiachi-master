/**
 * 人工核对工具：检查实验组二中 medium/low 置信度的名词
 * 是否真的在其对应的【【N】】截断内
 * 
 * 输出格式化的核对报告，便于人工判断"注意力飘散"问题
 */

import fs from 'fs';
import path from 'path';

const REPORT_PATH = path.join(process.cwd(), 's1-group2-medium-low-confidence-report.json');
const SNAPSHOT_DIR = path.join(process.cwd(), 's1-snapshots-group2');
const OUTPUT_PATH = path.join(process.cwd(), 's1-manual-verification-samples.json');

console.log('========== 生成人工核对样本 ==========\n');

const report = JSON.parse(fs.readFileSync(REPORT_PATH, 'utf-8'));

const samples = [];

// 取前 10 个包含 medium/low 的批次
const batchesToCheck = report.batchesWithMediumLow.slice(0, 10);

for (const batch of batchesToCheck) {
  const snapshotPath = path.join(SNAPSHOT_DIR, batch.snapshotFile);
  const snapshot = JSON.parse(fs.readFileSync(snapshotPath, 'utf-8'));

  // 每个批次取前 3 个 medium/low 名词
  const nounsToCheck = batch.nounsWithMediumLow.slice(0, 3);

  for (const noun of nounsToCheck) {
    const truncation = noun.truncation;
    if (!truncation) continue;

    const nounText = noun.noun.toLowerCase();
    const truncText = truncation.text.toLowerCase();
    const isInTruncation = truncText.includes(nounText);

    samples.push({
      batchId: snapshot.batchId,
      truncId: noun.truncId,
      machineCode: noun.machineCode,
      noun: noun.noun,
      truncation: {
        chunkKey: truncation.chunkKey,
        start: truncation.start,
        end: truncation.end,
        page: truncation.page,
        text: truncation.text,
      },
      mediumOffsets: noun.mediumOffsets,
      lowOffsets: noun.lowOffsets,
      verification: {
        isNounInTruncationText: isInTruncation,
        conclusion: isInTruncation 
          ? '✓ 名词在截断内，兜底算法正确扩展到了相邻区域'
          : '✗ 名词不在截断内！注意力飘散：兜底算法匹配到了错误位置',
      },
    });
  }
}

fs.writeFileSync(OUTPUT_PATH, JSON.stringify({ samples }, null, 2), 'utf-8');

console.log(`生成了 ${samples.length} 个核对样本`);
console.log(`输出文件: ${OUTPUT_PATH}\n`);

// 统计结果
const correct = samples.filter(s => s.verification.isNounInTruncationText).length;
const incorrect = samples.filter(s => !s.verification.isNounInTruncationText).length;

console.log('初步自动核对结果（简单字符串匹配）：');
console.log(`  ✓ 名词在截断内: ${correct}`);
console.log(`  ✗ 名词不在截断内: ${incorrect}`);

if (incorrect > 0) {
  console.log('\n⚠️  检测到疑似"注意力飘散"样本！');
  console.log('   请打开输出文件人工复核这些样本，确认：');
  console.log('   1. LLM 用【【N】】引用的截断');
  console.log('   2. 该截断的实际文本内容');
  console.log('   3. 提取的名词是否真的出现在该截断内');
}
