/**
 * CoT 对比实验：生成 CoT 版多路径推理 Prompt（实验组一专用）
 *
 * 实验组一：不经 noun recall，直接用纯文表全部 chunk 作为材料。
 * 由于全量 chunk 数量很大（数百个），默认只取前 MAX_CHUNKS 个，
 * 以避免超出 LLM 上下文窗口。可通过环境变量 COT_MAX_CHUNKS 调整。
 *
 * Prompt 内容与主流程 generate-multipath-prompt.js 完全一致，
 * 唯一区别：数据源来自纯文表（candidate-texts-for-llm-cot.json）
 * 且 reasoning_effort = 'high'（开启 DeepThink）
 *
 * 用法：
 *   node generate-multipath-prompt-cot.js Z1-Q1
 *   COT_MAX_CHUNKS=50 node generate-multipath-prompt-cot.js Z1-Q1
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const COT_DIR = __dirname;
const CANDIDATE_PATH = path.join(COT_DIR, 'candidate-texts-for-llm-cot.json');

const questionId = process.argv[2];

// 全量 chunk 数量大，默认截取前 N 个（可配置）
const MAX_CHUNKS = parseInt(process.env.COT_MAX_CHUNKS || '100', 10);

if (!questionId) {
  console.error('用法: node generate-multipath-prompt-cot.js <questionId>');
  process.exit(1);
}

if (!fs.existsSync(CANDIDATE_PATH)) {
  console.error(`未找到 ${CANDIDATE_PATH}，请先运行 node build-prompt-cot.js`);
  process.exit(1);
}

const candidateTexts = JSON.parse(fs.readFileSync(CANDIDATE_PATH, 'utf-8'));
const entry = candidateTexts.find((e) => e.questionId === questionId);
if (!entry) {
  console.error(`未找到问题 ${questionId}，可用问题: ${candidateTexts.map((e) => e.questionId).join(', ')}`);
  process.exit(1);
}

const { question, chunks } = entry;

// 全量截取前 MAX_CHUNKS 个（实验组一：纯文表全量材料）
const selectedChunks = chunks.slice(0, MAX_CHUNKS);

console.log('='.repeat(80));
console.log(`[CoT] 生成多路径 Prompt（实验组一·纯文表）: [${questionId}] ${question}`);
console.log(`总材料数: ${chunks.length}, 本次使用: ${selectedChunks.length}（MAX_CHUNKS=${MAX_CHUNKS}）`);
console.log('='.repeat(80));

// 与主流程 generate-multipath-prompt.js 完全一致的 Prompt 模板
const lines = [];
lines.push(`问题：${question}`);
lines.push('');
lines.push('材料：');
lines.push('');

for (const chunk of selectedChunks) {
  lines.push(`【【${chunk.id}】】`);
  lines.push(chunk.text);
  lines.push('');
}

lines.push('---');
lines.push('');
lines.push('要求：输出2-4条独立推理路径，每条路径包含多个步骤，每步可引用一个或多个材料【【N】】。');
lines.push('');
lines.push('格式：');
lines.push('');
lines.push('# 路径一：[标题]');
lines.push('');
lines.push('步骤1：使用【【X】】，提取...');
lines.push('步骤2：综合【【Y】】【【Z】】，对比...');
lines.push('');
lines.push('结论：[此路径结论]');
lines.push('');
lines.push('（继续路径二、三...）');
lines.push('');
lines.push('**引用规范**：');
lines.push('- 单个材料：使用【【N】】，提取...，判断...');
lines.push('- 多个材料：综合【【N】】【【M】】，对比/交叉验证/综合提取...');
lines.push('');
lines.push('**推理策略**：');
lines.push('- 对比论证：对比不同材料中的矛盾或差异');
lines.push('- 交叉验证：从多个材料中找到互相支撑的证据');
lines.push('- 综合支撑：从多处提取一致的特征或模式');

const prompt = lines.join('\n');
const outputPath = path.join(COT_DIR, `multipath-prompt-cot-${questionId}.txt`);
fs.writeFileSync(outputPath, prompt, 'utf-8');

console.log(`\n✅ Prompt 已保存: ${outputPath}`);
console.log(`   长度: ${prompt.length} 字符, 材料数: ${selectedChunks.length}`);
console.log('\n下一步: node run-reasoning-cot.js ' + questionId);
