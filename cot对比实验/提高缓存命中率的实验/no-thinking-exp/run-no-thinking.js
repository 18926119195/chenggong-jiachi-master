/**
 * no-thinking-exp · 关闭 thinking 对照实验推理脚本
 *
 * 与 ../run-cot-cache-exp.js 的唯一区别：
 *   - 使用 callLLM_NoThinking（reasoning_effort='none'，关闭 DeepThink）
 *   - 独立 API Key（no-thinking-exp/.env）
 *   - 输出写入 no-thinking-exp/<questionId>/ 子目录，不污染其他目录
 *
 * 用法（从 no-thinking-exp 文件夹内运行）：
 *   node run-no-thinking.js Z3-Q1
 *   node run-no-thinking.js Z3-Q2
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { callLLM_NoThinking, LLM_BASE_URL, LLM_MODEL } from './llmClient-no-thinking.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// prompt 文件在父目录（提高缓存命中率的实验）中
const PROMPTS_DIR = path.join(__dirname, '..');

const questionId = process.argv[2];
if (!questionId) {
  console.error('用法: node run-no-thinking.js <questionId>');
  console.error('示例: node run-no-thinking.js Z3-Q1');
  process.exit(1);
}

const VALID_IDS = ['Z1-Q1','Z1-Q2','Z1-Q3','Z1-Q4','Z2-Q1','Z2-Q2','Z2-Q3','Z2-Q4',
                   'Z3-Q1','Z3-Q2','Z3-Q3','Z3-Q4','Z4-Q1','Z4-Q2','Z4-Q3','Z4-Q4'];
if (!VALID_IDS.includes(questionId)) {
  console.error(`未知 questionId: ${questionId}`);
  process.exit(1);
}

const QUESTION_MAP = {
  'Z3-Q1': '比较Pierre Janet、Freud、Karl Jaspers对无意识的理解有何异同？',
  'Z3-Q2': '精神分析如何处理精神病性结构？有哪些临床策略？',
};

// 输出写到 no-thinking-exp/<questionId>/ 子目录
const OUT_DIR = path.join(__dirname, questionId.replace('-', '_').toLowerCase());
if (!fs.existsSync(OUT_DIR)) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
}

// 读取与 CoT 实验完全相同的 prompt（chunks-first 重排版）
const PROMPT_FILE = path.join(PROMPTS_DIR, `multipath-prompt-cot-${questionId}.txt`);
if (!fs.existsSync(PROMPT_FILE)) {
  console.error(`未找到 prompt 文件: ${PROMPT_FILE}`);
  process.exit(1);
}

const prompt = fs.readFileSync(PROMPT_FILE, 'utf-8');
const questionText = QUESTION_MAP[questionId] || questionId;

console.log('='.repeat(80));
console.log(`[NoThinking] 运行推理: ${questionId} — ${questionText}`);
console.log(`LLM: ${LLM_BASE_URL} model=${LLM_MODEL} reasoning_effort=none temperature=0.6`);
console.log(`Prompt 长度: ${prompt.length} 字符 (≈ ${Math.round(prompt.length / 4)} tokens)`);
console.log(`输出目录: ${OUT_DIR}`);
console.log('='.repeat(80));

async function main() {
  const t0 = Date.now();

  const res = await callLLM_NoThinking(prompt);

  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);

  if (!res) {
    console.error('[NoThinking] LLM 调用失败');
    process.exit(1);
  }

  const usage = res.usage || {};
  const cacheHit  = usage.prompt_cache_hit_tokens  ?? 0;
  const cacheMiss = usage.prompt_cache_miss_tokens ?? 0;
  const totalPrompt = cacheHit + cacheMiss;
  const cacheHitRate = totalPrompt > 0 ? ((cacheHit / totalPrompt) * 100).toFixed(1) : 'N/A';

  console.log(`\n✅ 推理完成，耗时 ${elapsed}s`);
  console.log(`Prompt tokens: ${usage.prompt_tokens ?? '-'}  Completion tokens: ${usage.completion_tokens ?? '-'}`);
  console.log(`Total tokens: ${usage.total_tokens ?? '-'}`);
  console.log(`Cache hit: ${cacheHit} tokens | Cache miss: ${cacheMiss} tokens | Hit rate: ${cacheHitRate}%`);
  if (res.truncated) console.log('⚠️  输出被截断');

  const outputData = {
    questionId,
    question: questionText,
    group: '关闭thinking对照实验组（chunks-first 重排 + reasoning_effort=none）',
    model: LLM_MODEL,
    thinking: 'none',
    temperature: 0.6,
    maxTokens: 384000,
    elapsedSecs: parseFloat(elapsed),
    tokenUsage: {
      prompt_tokens:             usage.prompt_tokens,
      completion_tokens:         usage.completion_tokens,
      total_tokens:              usage.total_tokens,
      prompt_cache_hit_tokens:  cacheHit,
      prompt_cache_miss_tokens: cacheMiss,
    },
    cacheHitRate,
    truncated: res.truncated,
    llmOutput: res.text,
    promptSource: `multipath-prompt-cot-${questionId}.txt (chunks-first 重排版，与 CoT 实验完全相同)`,
  };

  const OUTPUT_JSON = path.join(OUT_DIR, `reasoning-output-${questionId}.json`);
  fs.writeFileSync(OUTPUT_JSON, JSON.stringify(outputData, null, 2), 'utf-8');
  console.log(`\n📄 结果已保存: ${OUTPUT_JSON}`);

  // 保存 prompt 副本供追溯（与 CoT 版共享，此处用 symlink 避免重复存储）
  const PROMPT_COPY = path.join(OUT_DIR, `prompt-${questionId}.txt`);
  if (!fs.existsSync(PROMPT_COPY)) {
    fs.copyFileSync(PROMPT_FILE, PROMPT_COPY);
  }
  console.log(`📋 Prompt 副本: ${PROMPT_COPY}`);
}

main().catch((err) => {
  console.error('[NoThinking] 运行时错误:', err);
  process.exit(1);
});
