/**
 * CoT 对比实验：运行实验组一推理（纯文表直接推理，CoT 开）
 *
 * 实验组一设计：
 *   材料来源：纯文表全部 chunk（不经过名词召回和拓扑链筛选）
 *   reasoning_effort: 'high' + thinking type=enabled（开启 DeepThink）
 *
 * 与主流程 run-reasoning.js 的对比：
 *   - 主流程：拓扑链筛选后的小规模材料 + thinking=disabled
 *   - 实验组一：全量纯文表 + thinking=high
 *
 * 用法：
 *   node run-reasoning-cot.js Z1-Q1
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { callLLM_CoT, LLM_BASE_URL, LLM_MODEL } from './src-cot/llmClient-cot.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const COT_DIR = __dirname;

const questionId = process.argv[2];
if (!questionId) {
  console.error('用法: node run-reasoning-cot.js <questionId>');
  process.exit(1);
}

const PROMPT_PATH = path.join(COT_DIR, `multipath-prompt-cot-${questionId}.txt`);
const OUTPUT_PATH = path.join(COT_DIR, `reasoning-output-cot-${questionId}.json`);

if (!fs.existsSync(PROMPT_PATH)) {
  console.error(`未找到 ${PROMPT_PATH}，请先运行 node generate-multipath-prompt-cot.js ${questionId}`);
  process.exit(1);
}

const prompt = fs.readFileSync(PROMPT_PATH, 'utf-8');

// 从候选文件中读取问题信息
const CANDIDATE_PATH = path.join(COT_DIR, 'candidate-texts-for-llm-cot.json');
const candidates = JSON.parse(fs.readFileSync(CANDIDATE_PATH, 'utf-8'));
const entry = candidates.find((e) => e.questionId === questionId);
const questionText = entry?.question || questionId;
const totalChunks = entry?.chunks?.length || 0;
const usedChunks = entry?.chunks?.slice(0, parseInt(process.env.COT_MAX_CHUNKS || '100', 10)).length || 0;

console.log('='.repeat(80));
console.log(`[CoT] 运行推理（实验组一·纯文表直推）: [${questionId}] ${questionText}`);
console.log(`LLM: ${LLM_BASE_URL} model=${LLM_MODEL} reasoning_effort=high temperature=0.6 max_tokens=384000`);
console.log(`材料总数: ${totalChunks}, 本次使用: ${usedChunks}, Prompt 长度: ${prompt.length} 字符`);
console.log('='.repeat(80));

async function main() {
  const t0 = Date.now();
  // 使用 llmClient-cot.js 的默认参数（已对齐官网：max_tokens=384000, temperature=0.6, reasoning_effort=high）
  const res = await callLLM_CoT(prompt);
  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);

  if (!res) {
    console.error('LLM 调用失败，未生成推理结果');
    process.exit(1);
  }

  console.log(`\n✅ 推理完成，耗时 ${elapsed}s`);
  console.log(`Token 用量: prompt=${res.usage?.prompt_tokens ?? '-'} completion=${res.usage?.completion_tokens ?? '-'} total=${res.usage?.total_tokens ?? '-'}`);
  if (res.truncated) console.log('⚠️  输出被截断，可考虑提高 maxTokens');

  const output = {
    questionId,
    question: questionText,
    group: '实验组一（纯文表+CoT）',
    model: LLM_MODEL,
    thinking: 'high',
    materialSource: '纯文表全部chunk（不经noun recall）',
    totalChunksAvailable: totalChunks,
    chunksUsedInPrompt: usedChunks,
    elapsedSecs: parseFloat(elapsed),
    tokenUsage: res.usage,
    truncated: res.truncated,
    llmOutput: res.text,
  };

  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 2), 'utf-8');
  console.log(`已保存: ${OUTPUT_PATH}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
