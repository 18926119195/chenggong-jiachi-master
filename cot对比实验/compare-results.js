/**
 * CoT 对比实验：对比实验组一（CoT 直推）与实验组二（主流程）的推理结果
 *
 * 实验组一：cot对比实验/reasoning-output-cot-<questionId>.json
 * 实验组二：reasoning-output-<questionId>.json（根目录，主流程）
 *
 * 用法：
 *   node compare-results.js              # 对比所有问题
 *   node compare-results.js Z1-Q1 Z1-Q2  # 指定问题
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const COT_DIR = path.join(__dirname);
const MAIN_DIR = process.cwd();

const questionIds = process.argv.slice(2).length
  ? process.argv.slice(2)
  : ['Z1-Q1', 'Z1-Q2', 'Z1-Q3', 'Z1-Q4', 'Z2-Q1', 'Z2-Q2', 'Z2-Q3', 'Z2-Q4', 'Z3-Q1', 'Z3-Q2', 'Z3-Q3', 'Z4-Q1', 'Z4-Q2', 'Z4-Q3', 'Z4-Q4'];

console.log('='.repeat(80));
console.log('CoT 对比实验结果分析');
console.log('='.repeat(80));

const rows = [];
let availableCount = 0;
let missingCot = 0;
let missingMain = 0;

for (const qid of questionIds) {
  const cotPath = path.join(COT_DIR, `reasoning-output-cot-${qid}.json`);
  const mainPath = path.join(MAIN_DIR, `reasoning-output-${qid}.json`);

  const cotExists = fs.existsSync(cotPath);
  const mainExists = fs.existsSync(mainPath);

  if (!cotExists) { missingCot++; continue; }
  if (!mainExists) { missingMain++; continue; }
  availableCount++;

  const cot = JSON.parse(fs.readFileSync(cotPath, 'utf-8'));
  const main = JSON.parse(fs.readFileSync(mainPath, 'utf-8'));

  // Token 对比
  const cotPromptTokens = cot.tokenUsage?.prompt_tokens || 0;
  const cotCompTokens = cot.tokenUsage?.completion_tokens || 0;
  const mainPromptTokens = main.tokenUsage?.prompt_tokens || 0;
  const mainCompTokens = main.tokenUsage?.completion_tokens || 0;

  // 材料引用对比（主流程有 traceback，实验组一没有）
  const mainMaterialsUsed = main.materialsUsedCount || 0;
  const mainTotalMaterials = main.totalMaterialsAvailable || 0;

  // 答案长度对比
  const cotAnswerLen = cot.llmOutput?.length || 0;
  const mainAnswerLen = main.llmOutput?.length || 0;

  rows.push({
    questionId: qid,
    question: cot.question || main.question || '',
    group1: {
      materialSource: cot.materialSource || '纯文表',
      chunksUsed: cot.chunksUsedInPrompt || 0,
      promptTokens: cotPromptTokens,
      completionTokens: cotCompTokens,
      totalTokens: cotPromptTokens + cotCompTokens,
      answerLen: cotAnswerLen,
      truncated: cot.truncated || false,
    },
    group2: {
      materialSource: '拓扑链筛选',
      chunksUsed: mainTotalMaterials,
      materialsUsed: mainMaterialsUsed,
      promptTokens: mainPromptTokens,
      completionTokens: mainCompTokens,
      totalTokens: mainPromptTokens + mainCompTokens,
      answerLen: mainAnswerLen,
      truncated: main.truncated || false,
    },
  });
}

console.log(`\n已对比: ${availableCount} 个问题`);
if (missingCot > 0) console.log(`⚠️  实验组一缺失: ${missingCot} 个`);
if (missingMain > 0) console.log(`⚠️  主流程缺失: ${missingMain} 个`);

if (rows.length === 0) {
  console.log('\n无可对比结果，请先运行实验组一（run-full-cot-pipeline.js）');
  process.exit(0);
}

// 表格输出
console.log('\n' + '='.repeat(80));
console.log('Token 用量对比');
console.log('='.repeat(80));
console.log(
  `${'问题'.padEnd(8)} | ${'实验组一(CoT直推)'.padEnd(30)} | ${'实验组二(主流程)'.padEnd(30)} | ${'差异'.padEnd(10)}`
);
console.log('-'.repeat(80));

for (const r of rows) {
  const g1 = `${r.group1.totalTokens.toLocaleString()} tokens (P:${r.group1.promptTokens.toLocaleString()} C:${r.group1.completionTokens.toLocaleString()})`;
  const g2 = `${r.group2.totalTokens.toLocaleString()} tokens (P:${r.group2.promptTokens.toLocaleString()} C:${r.group2.completionTokens.toLocaleString()})`;
  const diff = `+${(r.group1.totalTokens - r.group2.totalTokens).toLocaleString()}`;
  console.log(`${r.questionId.padEnd(8)} | ${g1.padEnd(30)} | ${g2.padEnd(30)} | ${diff.padEnd(10)}`);
}

console.log('\n' + '='.repeat(80));
console.log('材料规模对比');
console.log('='.repeat(80));
console.log(`${'问题'.padEnd(8)} | ${'实验组一材料'.padEnd(15)} | ${'实验组二材料(筛选后)'.padEnd(20)} | ${'主流程引用'.padEnd(12)}`);
console.log('-'.repeat(80));

for (const r of rows) {
  const g1 = `${r.group1.chunksUsed} chunks`;
  const g2 = `${r.group2.chunksUsed} chunks`;
  const used = `${r.group2.materialsUsed || 0} 被引用`;
  console.log(`${r.questionId.padEnd(8)} | ${g1.padEnd(15)} | ${g2.padEnd(20)} | ${used.padEnd(12)}`);
}

console.log('\n' + '='.repeat(80));
console.log('答案长度对比');
console.log('='.repeat(80));
console.log(`${'问题'.padEnd(8)} | ${'实验组一(字符)'.padEnd(15)} | ${'实验组二(字符)'.padEnd(15)} | ${'差异'.padEnd(10)}`);
console.log('-'.repeat(80));

for (const r of rows) {
  const diff = r.group1.answerLen - r.group2.answerLen;
  const diffStr = (diff >= 0 ? '+' : '') + diff;
  console.log(
    `${r.questionId.padEnd(8)} | ${String(r.group1.answerLen).padEnd(15)} | ${String(r.group2.answerLen).padEnd(15)} | ${diffStr.padEnd(10)}`
  );
}

// 汇总统计
const g1TotalTokens = rows.reduce((s, r) => s + r.group1.totalTokens, 0);
const g2TotalTokens = rows.reduce((s, r) => s + r.group2.totalTokens, 0);
const g1AvgAnswerLen = rows.reduce((s, r) => s + r.group1.answerLen, 0) / rows.length;
const g2AvgAnswerLen = rows.reduce((s, r) => s + r.group2.answerLen, 0) / rows.length;

console.log('\n' + '='.repeat(80));
console.log('汇总统计');
console.log('='.repeat(80));
console.log(`  实验组一总 tokens: ${g1TotalTokens.toLocaleString()}（平均 ${Math.round(g1TotalTokens / rows.length).toLocaleString()}/问题）`);
console.log(`  实验组二总 tokens: ${g2TotalTokens.toLocaleString()}（平均 ${Math.round(g2TotalTokens / rows.length).toLocaleString()}/问题）`);
console.log(`  实验组一平均答案长度: ${Math.round(g1AvgAnswerLen).toLocaleString()} 字符`);
console.log(`  实验组二平均答案长度: ${Math.round(g2AvgAnswerLen).toLocaleString()} 字符`);
console.log(`  平均答案长度差异: ${(g1AvgAnswerLen - g2AvgAnswerLen) >= 0 ? '+' : ''}${Math.round(g1AvgAnswerLen - g2AvgAnswerLen)} 字符`);

// 推理质量人工评估区
console.log('\n' + '='.repeat(80));
console.log('推理质量人工评估（请手动填写）');
console.log('='.repeat(80));
for (const r of rows) {
  console.log(`\n【${r.questionId}】${r.question}`);
  console.log(`  实验组一（CoT直推）: `);
  console.log(`  ${(r.group1.answerLen > 200 ? r.group1.answerLen + '字符答案摘要: ' + (r.group1.answerLen > 0 ? '(见JSON文件)' : '') : '')}`);
  console.log(`  实验组二（主流程）: `);
  console.log(`  ${(r.group2.answerLen > 200 ? r.group2.answerLen + '字符答案摘要: ' + (r.group2.answerLen > 0 ? '(见JSON文件)' : '') : '')}`);
  console.log(`  质量评分  [实验组一: ___/10]  [实验组二: ___/10]`);
}

// 保存对比报告
const report = {
  meta: {
    comparedAt: new Date().toISOString(),
    questionsCount: rows.length,
    missingCot,
    missingMain,
  },
  summary: {
    group1: { totalTokens: g1TotalTokens, avgTokens: Math.round(g1TotalTokens / rows.length), avgAnswerLen: Math.round(g1AvgAnswerLen) },
    group2: { totalTokens: g2TotalTokens, avgTokens: Math.round(g2TotalTokens / rows.length), avgAnswerLen: Math.round(g2AvgAnswerLen) },
  },
  rows,
};

const reportPath = path.join(COT_DIR, 'comparison-report.json');
fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf-8');
console.log(`\n✅ 对比报告已保存: ${reportPath}`);
