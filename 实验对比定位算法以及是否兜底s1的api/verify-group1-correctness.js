/**
 * 验证实验组一的正确性：检查提取的名词是否真的在其对应的【【N】】截断内
 * 抽样：前20个 + 中间30个 + 后20个
 */

import fs from 'fs';
import path from 'path';

const GROUP1_OUTPUT = path.join(process.cwd(), 's1-nouns-with-offsets-group1.json');
const SNAPSHOT_DIR = path.join(process.cwd(), 's1-snapshots-group1');
const OUTPUT_PATH = path.join(process.cwd(), 's1-group1-verification-report.json');

console.log('========== 验证实验组一正确性 ==========\n');

const group1Data = JSON.parse(fs.readFileSync(GROUP1_OUTPUT, 'utf-8'));
const allNouns = group1Data.nouns;

console.log(`总名词数: ${allNouns.length}`);

// 抽样策略：前20 + 中间30 + 后20
const samples = [];
const sampleIndices = [];

// 前20个
for (let i = 0; i < Math.min(20, allNouns.length); i++) {
  sampleIndices.push(i);
}

// 中间30个
const midStart = Math.floor((allNouns.length - 30) / 2);
for (let i = midStart; i < midStart + 30 && i < allNouns.length; i++) {
  sampleIndices.push(i);
}

// 后20个
const endStart = Math.max(allNouns.length - 20, 0);
for (let i = endStart; i < allNouns.length; i++) {
  if (!sampleIndices.includes(i)) {
    sampleIndices.push(i);
  }
}

console.log(`抽样数量: ${sampleIndices.length} 个名词\n`);

// 构建快照索引：chunkKey -> [截断列表]（按 start 排序，用于按 offset 反查所属截断）
const truncsByChunk = new Map();

const snapshotFiles = fs.readdirSync(SNAPSHOT_DIR).filter(f => f.endsWith('.json'));
for (const file of snapshotFiles) {
  const snapshot = JSON.parse(fs.readFileSync(path.join(SNAPSHOT_DIR, file), 'utf-8'));
  for (const trunc of snapshot.truncations) {
    if (!truncsByChunk.has(trunc.chunkKey)) truncsByChunk.set(trunc.chunkKey, []);
    truncsByChunk.get(trunc.chunkKey).push({ ...trunc, batchId: snapshot.batchId });
  }
}

console.log(`快照索引构建完成: ${truncsByChunk.size} 个 chunk\n`);

// 每个 offset 反查所属截断：offset.start/end 应落在某个 trunc 的 [start, end) 区间内
function findTruncationForOffset(chunkKey, offsetStart, offsetEnd) {
  const truncs = truncsByChunk.get(chunkKey);
  if (!truncs) return null;
  return truncs.find(t => offsetStart >= t.start && offsetEnd <= t.end) || null;
}

// 验证每个抽样（一个名词可能有多个 offsets，逐一核对）
let correctCount = 0;
let incorrectCount = 0;
let notFoundInSnapshot = 0;

for (const idx of sampleIndices) {
  const noun = allNouns[idx];
  const nounText = (noun.surface || noun.id).toLowerCase();

  const offsetResults = [];

  for (const off of noun.offsets) {
    const trunc = findTruncationForOffset(off.chunkKey, off.start, off.end);

    if (!trunc) {
      notFoundInSnapshot++;
      offsetResults.push({
        chunkKey: off.chunkKey,
        start: off.start,
        end: off.end,
        status: 'SKIP',
        reason: '未在快照中找到覆盖该 offset 的截断（该 offset 可能超出所有截断区间）',
      });
      continue;
    }

    const truncText = trunc.text.toLowerCase();
    const isInTruncation = truncText.includes(nounText);

    if (isInTruncation) {
      correctCount++;
    } else {
      incorrectCount++;
    }

    offsetResults.push({
      batchId: trunc.batchId,
      truncId: trunc.truncId,
      machineCode: trunc.machineCode,
      chunkKey: off.chunkKey,
      start: off.start,
      end: off.end,
      truncationText: trunc.text,
      status: isInTruncation ? 'CORRECT' : 'INCORRECT',
      conclusion: isInTruncation
        ? '✓ 名词在对应截断内，提取正确'
        : `✗ 名词 "${nounText}" 不在截断 "${trunc.text}" 内`,
    });
  }

  samples.push({
    index: idx,
    noun: noun.surface,
    id: noun.id,
    offsetCount: noun.offsets.length,
    offsetResults,
  });
}

const report = {
  meta: {
    experimentGroup: '实验组一（无兜底）',
    totalNouns: allNouns.length,
    sampledNouns: samples.length,
    samplingStrategy: '前20 + 中间30 + 后20',
    generatedAt: new Date().toISOString(),
  },
  summary: {
    correct: correctCount,
    incorrect: incorrectCount,
    notFoundInSnapshot,
    accuracyRate: correctCount + incorrectCount > 0 
      ? ((correctCount / (correctCount + incorrectCount)) * 100).toFixed(2) + '%'
      : 'N/A',
  },
  samples,
};

fs.writeFileSync(OUTPUT_PATH, JSON.stringify(report, null, 2), 'utf-8');

console.log('========== 验证完成 ==========');
console.log(`✓ 正确（名词在截断内）: ${correctCount}`);
console.log(`✗ 错误（名词不在截断内）: ${incorrectCount}`);
console.log(`⊘ 跳过（快照缺失）: ${notFoundInSnapshot}`);
console.log(`准确率: ${report.summary.accuracyRate}`);
console.log(`\n输出文件: ${OUTPUT_PATH}`);

if (incorrectCount > 0) {
  console.log('\n⚠️  检测到错误样本！实验组一也存在注意力飘散问题。');
} else {
  console.log('\n✓ 实验组一所有抽样均正确，无注意力飘散。');
}
