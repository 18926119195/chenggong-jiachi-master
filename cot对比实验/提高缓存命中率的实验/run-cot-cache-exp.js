/**
 * 提高缓存命中率的实验 · 推理运行脚本
 *
 * 专门针对 "提高缓存命中率的实验" 文件夹内的 chunks-first 重排 prompt。
 * 所有中间产物和结果都写入本文件夹内，不污染父目录。
 *
 * 用法（从 "提高缓存命中率的实验" 文件夹内运行）：
 *   node run-cot-cache-exp.js Z3-Q1
 *   node run-cot-cache-exp.js Z3-Q2
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { callLLM_CoT, LLM_BASE_URL, LLM_MODEL } from '../src-cot/llmClient-cot.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const questionId = process.argv[2];
if (!questionId) {
  console.error('用法: node run-cot-cache-exp.js <questionId>');
  console.error('示例: node run-cot-cache-exp.js Z3-Q1');
  process.exit(1);
}

// 验证 questionId 合法
const VALID_IDS = ['Z1-Q1','Z1-Q2','Z1-Q3','Z1-Q4','Z2-Q1','Z2-Q2','Z2-Q3','Z2-Q4',
                   'Z3-Q1','Z3-Q2','Z3-Q3','Z3-Q4','Z4-Q1','Z4-Q2','Z4-Q3','Z4-Q4'];
if (!VALID_IDS.includes(questionId)) {
  console.error(`未知 questionId: ${questionId}`);
  process.exit(1);
}

// 问题文本映射（从 prompt 文件内提取）
const QUESTION_MAP = {
  'Z3-Q1': '比较Pierre Janet、Freud、Karl Jaspers对无意识的理解有何异同？',
  'Z3-Q2': '精神分析如何处理精神病性结构？有哪些临床策略？',
};

// 输出目录
const OUT_DIR = path.join(__dirname, questionId.replace('-', '_').toLowerCase());
// 示例：Z3-Q1 → z3_q1/  Z3-Q2 → z3_q2/

if (!fs.existsSync(OUT_DIR)) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
}

// Prompt 文件路径（chunks-first 重排版，在本文件夹内）
const PROMPT_FILE = path.join(__dirname, `multipath-prompt-cot-${questionId}.txt`);
if (!fs.existsSync(PROMPT_FILE)) {
  console.error(`未找到 prompt 文件: ${PROMPT_FILE}`);
  process.exit(1);
}

const prompt = fs.readFileSync(PROMPT_FILE, 'utf-8');
const questionText = QUESTION_MAP[questionId] || questionId;

console.log('='.repeat(80));
console.log(`[CacheExp] 运行推理: ${questionId} — ${questionText}`);
console.log(`LLM: ${LLM_BASE_URL} model=${LLM_MODEL}`);
console.log(`Prompt 长度: ${prompt.length} 字符 (≈ ${Math.round(prompt.length / 4)} tokens)`);
console.log(`输出目录: ${OUT_DIR}`);
console.log('='.repeat(80));

async function main() {
  const t0 = Date.now();

  // 严格复用 llmClient-cot.js 的参数配置
  const res = await callLLM_CoT(prompt);

  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);

  if (!res) {
    console.error('[CacheExp] LLM 调用失败');
    process.exit(1);
  }

  const usage = res.usage || {};
  const cacheHit = usage.prompt_cache_hit_tokens ?? 0;
  const cacheMiss = usage.prompt_cache_miss_tokens ?? 0;
  const totalPrompt = cacheHit + cacheMiss;
  const cacheHitRate = totalPrompt > 0 ? ((cacheHit / totalPrompt) * 100).toFixed(1) : 'N/A';
  const reasoningTokens = usage.completion_tokens_details?.reasoning_tokens ?? null;
  const finalAnswerTokens = (usage.completion_tokens != null && reasoningTokens != null)
    ? usage.completion_tokens - reasoningTokens
    : null;

  console.log(`\n✅ 推理完成，耗时 ${elapsed}s`);
  console.log(`Prompt tokens: ${usage.prompt_tokens ?? '-'}  Completion tokens: ${usage.completion_tokens ?? '-'}`);
  console.log(`Total tokens: ${usage.total_tokens ?? '-'}`);
  if (reasoningTokens !== null) {
    console.log(`  └─ 其中：reasoning_tokens = ${reasoningTokens}  |  最终答案 tokens = ${finalAnswerTokens}`);
  }
  console.log(`Cache hit: ${cacheHit} tokens | Cache miss: ${cacheMiss} tokens | Hit rate: ${cacheHitRate}%`);
  if (res.truncated) console.log('⚠️  输出被截断');

  // 写入推理输出（JSON）
  const outputData = {
    questionId,
    question: questionText,
    group: '提高缓存命中率实验组（chunks-first 重排 + CoT）',
    model: LLM_MODEL,
    thinking: 'high',
    temperature: 0.6,
    maxTokens: 384000,
    elapsedSecs: parseFloat(elapsed),
    tokenUsage: {
      prompt_tokens: usage.prompt_tokens,
      completion_tokens: usage.completion_tokens,
      total_tokens: usage.total_tokens,
      prompt_cache_hit_tokens: cacheHit,
      prompt_cache_miss_tokens: cacheMiss,
      completion_tokens_details: {
        reasoning_tokens: reasoningTokens,
        final_answer_tokens: finalAnswerTokens,
      },
    },
    cacheHitRate: cacheHitRate,
    truncated: res.truncated,
    thinkingChain: res.reasoningText || '(no reasoning_content returned)',
    llmOutput: res.text,
    promptSource: `multipath-prompt-cot-${questionId}.txt (chunks-first 重排版)`,
  };

  const OUTPUT_JSON = path.join(OUT_DIR, `reasoning-output-${questionId}.json`);
  fs.writeFileSync(OUTPUT_JSON, JSON.stringify(outputData, null, 2), 'utf-8');
  console.log(`\n📄 结果已保存: ${OUTPUT_JSON}`);

  // 同时写入原始 prompt 副本（方便追溯）
  const PROMPT_COPY = path.join(OUT_DIR, `prompt-${questionId}.txt`);
  fs.copyFileSync(PROMPT_FILE, PROMPT_COPY);
  console.log(`📋 Prompt 副本: ${PROMPT_COPY}`);
}

main().catch((err) => {
  console.error('[CacheExp] 运行时错误:', err);
  process.exit(1);
});
