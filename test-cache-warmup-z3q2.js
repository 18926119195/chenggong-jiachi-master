/**
 * 缓存预热测试：第一批全量 + 后续递减分批
 * 
 * 策略：
 * 1. 第1批：全量名词（1-N），建立完整缓存
 * 2. 第2批：前 N/2 个名词 → 命中第1批前缀缓存
 * 3. 第3批：前 N/4 个名词 → 命中第2批前缀缓存
 * ...
 * 
 * 测试问题：Z3-Q2
 * API Key: sk-e5031743b4e1475799d90df0f3252aa3
 */

import fs from 'fs';
import path from 'path';

// 临时覆盖 API key（仅本次测试）
process.env.DEEPSEEK_API_KEY = 'sk-e5031743b4e1475799d90df0f3252aa3';

import { callLLM } from './src/core/llmClient.js';

const NOUN_INDEX_PATH = path.join(process.cwd(), 'final-noun-index.json');
const QUESTIONS_PATH = path.join(process.cwd(), 'test-questions.json');
const OUTPUT_PATH = path.join(process.cwd(), 'cache-warmup-test-z3q2.json');

console.log('=== 缓存预热测试（递减分批策略）===\n');

const nounIndex = JSON.parse(fs.readFileSync(NOUN_INDEX_PATH, 'utf-8'));
const questions = JSON.parse(fs.readFileSync(QUESTIONS_PATH, 'utf-8'));
const question = questions.find(q => q.id === 'Z3-Q2');

if (!question) {
  console.error('未找到 Z3-Q2');
  process.exit(1);
}

console.log(`问题: ${question.question}`);
console.log(`全量名词数: ${nounIndex.nouns.length}\n`);

function buildCoarsePrompt(questionText, nounList) {
  const list = nounList.map((n, i) => `【【${i + 1}】】${n.surface}`).join('\n');
  return `问题: ${questionText}

从下列名词中，选出所有对回答这个问题可能有帮助的词。只回答相关词的机器符号，例如：【【1】】【【5】】【【17】】
如果没有任何相关词，回答：NONE

词语列表：
${list}

相关词编号：`;
}

async function runTest() {
  const results = [];
  
  // 生成递减分批计划
  const batches = [];
  let currentSize = nounIndex.nouns.length;
  let batchNum = 1;
  
  while (currentSize >= 10) {
    batches.push({
      batchNum,
      size: currentSize,
      nouns: nounIndex.nouns.slice(0, currentSize),
    });
    batchNum++;
    currentSize = Math.floor(currentSize / 2);
  }
  
  console.log(`生成 ${batches.length} 个递减批次:`);
  batches.forEach(b => {
    console.log(`  批次${b.batchNum}: ${b.size} 个名词`);
  });
  console.log('');
  
  // 依次调用
  for (const batch of batches) {
    console.log(`\n--- 批次${batch.batchNum} (${batch.size}个名词) ---`);
    const prompt = buildCoarsePrompt(question.question, batch.nouns);
    const promptTokens = Math.ceil(prompt.length / 3.5);
    console.log(`  Prompt长度: ${prompt.length} 字符 (~${promptTokens} tokens)`);
    
    const t0 = Date.now();
    const res = await callLLM(prompt, { maxTokens: 8192 });
    const elapsed = Date.now() - t0;
    
    if (!res) {
      console.log(`  ❌ 调用失败`);
      results.push({ batchNum: batch.batchNum, size: batch.size, error: 'API调用失败' });
      continue;
    }
    
    const cacheHit = res.usage?.prompt_cache_hit_tokens || 0;
    const cacheMiss = res.usage?.prompt_cache_miss_tokens || 0;
    const cacheTotal = cacheHit + cacheMiss;
    const cacheRate = cacheTotal > 0 ? (cacheHit / cacheTotal * 100).toFixed(2) : '0.00';
    
    console.log(`  ✓ 耗时: ${(elapsed/1000).toFixed(1)}s`);
    console.log(`  缓存: hit=${cacheHit}, miss=${cacheMiss}, 命中率=${cacheRate}%`);
    console.log(`  输出长度: ${res.text?.length || 0} 字符`);
    
    results.push({
      batchNum: batch.batchNum,
      size: batch.size,
      promptLength: prompt.length,
      elapsedMs: elapsed,
      usage: res.usage,
      cacheHitRate: parseFloat(cacheRate),
      outputLength: res.text?.length || 0,
      truncated: res.truncated || false,
    });
  }
  
  // 保存结果
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify({
    question: question.question,
    questionId: question.id,
    strategy: 'descending-batch-warmup',
    totalNouns: nounIndex.nouns.length,
    batches: results,
    timestamp: new Date().toISOString(),
  }, null, 2), 'utf-8');
  
  console.log(`\n\n=== 测试完成 ===`);
  console.log(`结果已保存: ${OUTPUT_PATH}`);
  console.log(`\n缓存命中率汇总:`);
  results.forEach(r => {
    console.log(`  批次${r.batchNum} (${r.size}词): ${r.cacheHitRate}%`);
  });
}

runTest().catch(err => {
  console.error(err);
  process.exit(1);
});
