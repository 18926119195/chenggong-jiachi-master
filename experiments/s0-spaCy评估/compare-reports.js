/**
 * 对比两个版本的 quality report 数据
 */

import fs from 'fs';

const mainFlow = JSON.parse(
  fs.readFileSync('C:\\Users\\Administrator\\Desktop\\2026-09-21-master\\s0-quality-report.json', 'utf-8')
);

const experiment = JSON.parse(
  fs.readFileSync('C:\\Users\\Administrator\\Desktop\\2026-09-21-master\\experiments\\s0-spaCy评估\\s0-evaluation-report.json', 'utf-8')
);

console.log('='.repeat(60));
console.log('两个版本 s0-quality-report 对比');
console.log('='.repeat(60));

console.log('\n【基本统计】');
console.log('                    主流程版本    实验版本');
console.log(`总 chunks:          ${mainFlow.chunkCount}           ${experiment.stats.totalChunks}`);
console.log(`总字符数:           ${mainFlow.totalChars}        ${experiment.stats.totalChars}`);

console.log('\n【spaCy 抽取】');
console.log(`主流程: ${mainFlow.hitCount} 个命中 (去重后)`);
console.log(`实验:   ${experiment.stats.extractedNouns} 个抽取 (原始)`);

console.log('\n【覆盖率】');
console.log(`                    主流程版本    实验版本`);
console.log(`命中字符:           ${mainFlow.hitChars}        ${experiment.coverage.hitChars}`);
console.log(`覆盖率:            ${(mainFlow.hitChars / mainFlow.totalChars * 100).toFixed(2)}%          ${experiment.coverage.coverage}%`);
console.log(`剩余文片段:         ${mainFlow.residualCount}         ${experiment.coverage.residualCount}`);
console.log(`剩余文字符:         ${mainFlow.residualChars}       ${experiment.coverage.residualChars}`);

console.log('\n【差异分析】');
console.log(`命中字符差异: ${experiment.coverage.hitChars - mainFlow.hitChars} (实验版 - 主流程版)`);
console.log(`剩余文片段差异: ${experiment.coverage.residualCount - mainFlow.residualCount} (实验版 - 主流程版)`);
console.log(`剩余文字符差异: ${experiment.coverage.residualChars - mainFlow.residualChars} (实验版 - 主流程版)`);

// 抽几个 residual 样本来对比
console.log('\n【主流程版本剩余文样本（前5个）】');
for (let i = 0; i < Math.min(5, mainFlow.residuals.length); i++) {
  const r = mainFlow.residuals[i];
  console.log(`  ${i+1}. "${r.text}" (${r.length}字符)`);
}

console.log('\n【实验版本剩余文样本（前5个）】');
for (let i = 0; i < Math.min(5, experiment.samples.residuals.length); i++) {
  const r = experiment.samples.residuals[i];
  console.log(`  ${i+1}. "${r}"`);
}
