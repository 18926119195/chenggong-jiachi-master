/**
 * CoT 对比实验：一键执行实验组一（纯文表直推 + CoT）完整流程
 *
 * 实验组一流程（不经 noun recall）：
 *   纯文表 → build-prompt-cot.js（纯文表全量材料）
 *     → generate-multipath-prompt-cot.js（MAX_CHUNKS 个 chunk）
 *     → run-reasoning-cot.js（reasoning_effort=high）
 *
 * 实验组二（主流程）复用根目录已有结果，不重新运行。
 *
 * 用法：
 *   node run-full-cot-pipeline.js Z1-Q1    # 单个问题
 *   node run-full-cot-pipeline.js          # 所有问题
 *   COT_MAX_CHUNKS=50 node run-full-cot-pipeline.js  # 调整材料数量
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const COT_DIR = path.join(process.cwd(), 'cot对比实验');
const questionId = process.argv[2];
const questionArg = questionId ? ` ${questionId}` : '';

const MAX_CHUNKS = process.env.COT_MAX_CHUNKS || '100';
console.log('='.repeat(80));
console.log('[CoT] 完整流程自动执行（实验组一·纯文表直推）');
console.log('='.repeat(80));
console.log(`处理问题: ${questionId || '所有问题'}`);
console.log(`材料数: 前 ${MAX_CHUNKS} 个 chunk（纯文表全量，不经noun recall）`);
console.log('');

function runStep(step, description, command, cwd) {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`步骤 ${step}: ${description}`);
  console.log(`${'='.repeat(80)}`);
  try {
    execSync(command, { stdio: 'inherit', cwd: cwd || process.cwd() });
  } catch (err) {
    console.error(`\n❌ 步骤 ${step} 失败`);
    process.exit(1);
  }
}

// 步骤1：构建推理输入（从纯文表，不经 noun recall）
runStep(1, '构建推理输入（纯文表全量材料）', `node build-prompt-cot.js${questionArg}`, COT_DIR);

// 加载候选文件确定目标问题
const CANDIDATE_PATH = path.join(COT_DIR, 'candidate-texts-for-llm-cot.json');
const candidates = JSON.parse(fs.readFileSync(CANDIDATE_PATH, 'utf-8'));
const targetQuestions = questionId
  ? candidates.filter((q) => q.questionId === questionId)
  : candidates;

if (targetQuestions.length === 0) {
  console.error(`\n❌ 未找到问题 ${questionId}`);
  process.exit(1);
}

// 步骤2-3：生成 Prompt + 执行推理
let stepNum = 2;
for (const q of targetQuestions) {
  runStep(stepNum, `生成多路径Prompt [${q.questionId}]`, `node generate-multipath-prompt-cot.js ${q.questionId}`, COT_DIR);
  stepNum++;
  runStep(stepNum, `执行推理 [${q.questionId}]（CoT 开启）`, `node run-reasoning-cot.js ${q.questionId}`, COT_DIR);
  stepNum++;
}

console.log('\n' + '='.repeat(80));
console.log('✅ [CoT] 完整流程执行完毕（实验组一）');
console.log('='.repeat(80));
console.log(`\n实验组一输出文件（cot对比实验目录）:`);
for (const q of targetQuestions) {
  console.log(`  - reasoning-output-cot-${q.questionId}.json`);
}
console.log(`\n实验组二（主流程）复用根目录已有文件，无需重新运行`);
console.log(`\n下一步: node compare-results.js`);
