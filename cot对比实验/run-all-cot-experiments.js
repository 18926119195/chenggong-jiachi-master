/**
 * CoT 对比实验：批量运行所有 15 个问题的推理
 *
 * 设计目标：
 *   1. 每个问题都有独立的 LLM 输入快照（snake-input-<id>.txt）
 *   2. 每个问题都有独立的输出 JSON（reasoning-output-cot-<id>.json，已含缓存命中率）
 *   3. 每个问题都有独立的完整日志（logs/cot-run-<id>.log）
 *   4. 汇总报告（logs/cot-run-summary.json）聚合所有 15 个问题的耗时、token、缓存命中率
 *   5. 顺序执行（不并发），便于观察 prefix cache 在跨问题间的命中变化
 *
 * 隔离保证：
 *   - 每个问题写入的文件路径都包含 <id>，不会互相覆盖
 *   - 每个问题开始前检测是否已有产物，存在则跳过（支持断点续跑）
 *
 * 用法：
 *   node run-all-cot-experiments.js          # 跑全部 15 个
 *   node run-all-cot-experiments.js Z1-Q1     # 只跑指定单个（调试用）
 *   node run-all-cot-experiments.js --force   # 强制重跑全部（即使已有产物）
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { callLLM_CoT, LLM_BASE_URL, LLM_MODEL, LLM_API_KEY, DEFAULT_MAX_TOKENS } from './src-cot/llmClient-cot.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const COT_DIR       = __dirname;
const LOGS_DIR      = path.join(COT_DIR, 'logs');
const SNAPSHOTS_DIR = path.join(COT_DIR, 'snapshots');
const OUTPUT_DIR    = COT_DIR;
const SUMMARY_PATH  = path.join(LOGS_DIR, 'cot-run-summary.json');
const MD_SUMMARY    = path.join(LOGS_DIR, 'cot-run-summary.md');

// 确保目录存在
for (const d of [LOGS_DIR, SNAPSHOTS_DIR, OUTPUT_DIR]) {
  if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
}

// 15 个问题的 ID 列表（与 generated-prompts.txt 顺序一致）
const ALL_QUESTION_IDS = [
  'Z1-Q1', 'Z1-Q2', 'Z1-Q3', 'Z1-Q4',
  'Z2-Q1', 'Z2-Q2', 'Z2-Q3', 'Z2-Q4',
  'Z3-Q1', 'Z3-Q2', 'Z3-Q3',
  'Z4-Q1', 'Z4-Q2', 'Z4-Q3', 'Z4-Q4',
];

// 解析命令行
const args = process.argv.slice(2);
const FORCE = args.includes('--force');
const SINGLE = args.find(a => /^[A-Z]\d-Q\d$/.test(a));

const TARGET_IDS = SINGLE ? [SINGLE] : ALL_QUESTION_IDS;

// 从 candidate-texts-for-llm-cot.json 读取问题文本
const CANDIDATE_PATH = path.join(COT_DIR, 'candidate-texts-for-llm-cot.json');
const candidates = JSON.parse(fs.readFileSync(CANDIDATE_PATH, 'utf-8'));
const questionMap = new Map(candidates.map(c => [c.questionId, c]));

/**
 * 提取并保存缓存命中率数据
 */
function extractCacheInfo(usage) {
  const promptTokens = usage?.prompt_tokens ?? 0;
  // 兼容两种 DeepSeek 返回格式
  const cacheHit = usage?.prompt_cache_hit_tokens
                ?? usage?.prompt_tokens_details?.cached_tokens
                ?? 0;
  const cacheMiss = usage?.prompt_cache_miss_tokens
                 ?? Math.max(0, promptTokens - cacheHit);
  const cacheHitRatePct = promptTokens > 0
    ? +((cacheHit / promptTokens) * 100).toFixed(2)
    : 0;
  return { promptTokens, cacheHit, cacheMiss, cacheHitRatePct };
}

/**
 * 运行单个问题：返回 { ok, log, output }
 */
async function runOne(questionId, indexInBatch, totalInBatch) {
  const promptPath = path.join(COT_DIR, `multipath-prompt-cot-${questionId}.txt`);
  const outputPath = path.join(OUTPUT_DIR, `reasoning-output-cot-${questionId}.json`);
  const logPath    = path.join(LOGS_DIR, `cot-run-${questionId}.log`);
  const snapshotIn = path.join(SNAPSHOTS_DIR, `cot-input-${questionId}.txt`);

  // ── 跳过已存在产物（除非 --force） ──
  if (!FORCE && fs.existsSync(outputPath) && fs.existsSync(logPath)) {
    return {
      ok: true,
      skipped: true,
      questionId,
      reason: '产物已存在（使用 --force 重跑）',
    };
  }

  if (!fs.existsSync(promptPath)) {
    const err = `找不到 ${promptPath}，请先运行 generate-full-prompt.js`;
    fs.writeFileSync(logPath, `[${new Date().toISOString()}] ❌ ${err}\n`, 'utf-8');
    return { ok: false, questionId, error: err };
  }

  const prompt = fs.readFileSync(promptPath, 'utf-8');
  const entry = questionMap.get(questionId);
  // 优先从 candidate 读，否则直接从 prompt 中解析 "问题：xxx"
  let questionText = entry?.question;
  if (!questionText || questionText === questionId) {
    const m = prompt.match(/^问题[：:]\s*(.+?)$/m);
    questionText = m ? m[1].trim() : questionId;
  }
  const totalChunks = entry?.chunks?.length || (prompt.match(/【【\d+】】/g) || []).length;

  // ── 写入输入快照（运行时实际发送的内容） ──
  fs.writeFileSync(snapshotIn, prompt, 'utf-8');

  // ── 构造完整日志（log = 控制台输出的逐字副本 + 元数据） ──
  const logLines = [];
  const log = (msg = '') => {
    const stamped = `[${new Date().toISOString()}] ${msg}`;
    logLines.push(stamped);
    process.stdout.write(stamped + '\n');
  };
  // 不带时间戳的 plain（用于在已经带时间戳的字符串后追加内容）
  const logRaw = (msg = '') => {
    logLines.push(msg);
    process.stdout.write(msg + '\n');
  };

  log('='.repeat(80));
  log(`CoT 实验运行日志  [${indexInBatch + 1}/${totalInBatch}]`);
  log('='.repeat(80));
  log(`Question ID    : ${questionId}`);
  log(`Question       : ${questionText}`);
  log(`LLM Model      : ${LLM_MODEL}    (Flash V4 / V4.1-Flash)`);
  log(`Endpoint       : ${LLM_BASE_URL}/chat/completions`);
  log(`Max Tokens     : ${DEFAULT_MAX_TOKENS}`);
  log(`Temperature    : 0.6`);
  log(`Reasoning      : reasoning_effort='high' + thinking.type='enabled'`);
  log(`Prompt 长度    : ${prompt.length.toLocaleString()} 字符 (~${Math.round(prompt.length / 3.8).toLocaleString()} tokens)`);
  log(`可用 chunk 数  : ${totalChunks}`);
  log(`实际使用 chunk : ${totalChunks}（全量）`);
  log(`输入快照路径   : ${snapshotIn}`);
  log(`输出 JSON 路径 : ${outputPath}`);
  log(`本日志路径     : ${logPath}`);
  log('');

  // ── 记录 HTTP 请求细节 ──
  log('--- HTTP REQUEST ---');
  log(`POST ${LLM_BASE_URL}/chat/completions`);
  log(`Headers: { "Content-Type": "application/json", "Authorization": "Bearer ${LLM_API_KEY.slice(0, 8)}...${LLM_API_KEY.slice(-4)}" }`);
  log('Body:');
  log(JSON.stringify({
    model: LLM_MODEL,
    temperature: 0.6,
    max_tokens: DEFAULT_MAX_TOKENS,
    reasoning_effort: 'high',
    extra_body: { thinking: { type: 'enabled' } },
    messages: [{ role: 'user', content: `<${prompt.length} 字符 / ~${Math.round(prompt.length / 3.8)} tokens, 详见 ${snapshotIn}>` }],
  }, null, 2));
  log('');
  log(`⏳ 等待 DeepSeek 响应...`);

  const t0 = Date.now();
  const res = await callLLM_CoT(prompt);
  const elapsedMs = Date.now() - t0;
  const elapsedSec = (elapsedMs / 1000).toFixed(1);

  if (!res) {
    log(`❌ LLM 调用失败（已重试 3 次）`);
    fs.writeFileSync(logPath, logLines.join('\n') + '\n', 'utf-8');
    return { ok: false, questionId, error: 'LLM 调用失败' };
  }

  // ── 记录 HTTP 响应细节 ──
  const usage = res.usage || {};
  const cache = extractCacheInfo(usage);
  log(`✅ 响应到达（耗时 ${elapsedSec}s）`);
  log('');
  log('--- HTTP RESPONSE (usage 部分) ---');
  log(JSON.stringify(usage, null, 2));
  log('');
  log('--- 缓存命中率分析 ---');
  log(`prompt_tokens              : ${cache.promptTokens.toLocaleString()}`);
  log(`prompt_cache_hit_tokens    : ${cache.cacheHit.toLocaleString()}`);
  log(`prompt_cache_miss_tokens   : ${cache.cacheMiss.toLocaleString()}`);
  log(`cache hit rate             : ${cache.cacheHitRatePct}%`);
  log(`completion_tokens          : ${(usage.completion_tokens ?? 0).toLocaleString()}`);
  log(`  ├ reasoning_tokens (思考): ${(usage.completion_tokens_details?.reasoning_tokens ?? 0).toLocaleString()}`);
  log(`  └ 实际可见输出            : ${((usage.completion_tokens ?? 0) - (usage.completion_tokens_details?.reasoning_tokens ?? 0)).toLocaleString()}`);
  log(`total_tokens               : ${(usage.total_tokens ?? 0).toLocaleString()}`);
  log(`finish_reason              : ${res.truncated ? 'length (截断)' : 'stop (正常)'}`);
  log(`输出字符数                 : ${res.text.length.toLocaleString()}`);
  log('');

  // ── 保存输出 JSON ──
  const output = {
    questionId,
    question: questionText,
    group: '实验组一（纯文表+CoT）',
    model: LLM_MODEL,
    endpoint: LLM_BASE_URL,
    thinking: 'high',
    materialSource: '纯文表全部chunk（不经noun recall）',
    totalChunksAvailable: totalChunks,
    chunksUsedInPrompt: totalChunks,
    elapsedSecs: parseFloat(elapsedSec),
    elapsedMs,
    promptLengthChars: prompt.length,
    tokenUsage: usage,
    cache: cache,
    truncated: res.truncated,
    systemFingerprint: res.usage?.system_fingerprint || null,
    llmOutput: res.text,
  };
  fs.writeFileSync(outputPath, JSON.stringify(output, null, 2), 'utf-8');

  log(`✅ 已保存输出 JSON: ${outputPath}`);
  log(`✅ 已保存完整日志: ${logPath}`);

  // ── 落盘日志 ──
  fs.writeFileSync(logPath, logLines.join('\n') + '\n', 'utf-8');

  return {
    ok: true,
    questionId,
    elapsedMs,
    cache,
    usage,
    promptLengthChars: prompt.length,
    outputChars: res.text.length,
    truncated: res.truncated,
    snapshotPath: snapshotIn,
    outputPath,
    logPath,
  };
}

/**
 * 汇总并落盘报告
 */
function writeSummary(results) {
  const summary = {
    batchRunAt: new Date().toISOString(),
    model: LLM_MODEL,
    endpoint: LLM_BASE_URL,
    totalQuestions: results.length,
    successCount: results.filter(r => r.ok && !r.skipped).length,
    skippedCount: results.filter(r => r.skipped).length,
    failedCount: results.filter(r => !r.ok).length,
    totalElapsedMs: results.reduce((s, r) => s + (r.elapsedMs || 0), 0),
    questions: results,
  };

  fs.writeFileSync(SUMMARY_PATH, JSON.stringify(summary, null, 2), 'utf-8');

  // ── 友好可读 Markdown 汇总 ──
  const md = [];
  md.push('# CoT 批量实验汇总报告\n');
  md.push(`- **运行时间**: ${summary.batchRunAt}`);
  md.push(`- **模型**: \`${summary.model}\` (Flash V4)`);
  md.push(`- **Endpoint**: \`${summary.endpoint}/chat/completions\``);
  md.push(`- **总问题数**: ${summary.totalQuestions}`);
  md.push(`  - 成功: ${summary.successCount}`);
  md.push(`  - 跳过（已有产物）: ${summary.skippedCount}`);
  md.push(`  - 失败: ${summary.failedCount}`);
  md.push(`- **总耗时**: ${(summary.totalElapsedMs / 1000).toFixed(1)}s (${(summary.totalElapsedMs / 60000).toFixed(2)} min)`);
  md.push('');

  md.push('## 各问题详细数据\n');
  md.push('| # | 问题ID | 输入字符 | 输入tokens | cache hit | 命中率 | completion | 实际输出字符 | 耗时(s) | 状态 |');
  md.push('|---|--------|---------:|-----------:|----------:|-------:|-----------:|-------------:|--------:|------|');

  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    if (!r.ok) {
      md.push(`| ${i+1} | ${r.questionId} | - | - | - | - | - | - | - | ❌ ${r.error || '失败'} |`);
      continue;
    }
    if (r.skipped) {
      md.push(`| ${i+1} | ${r.questionId} | - | - | - | - | - | - | - | ⏭️ ${r.reason} |`);
      continue;
    }
    md.push(`| ${i+1} | ${r.questionId} | ${r.promptLengthChars.toLocaleString()} | ${r.cache.promptTokens.toLocaleString()} | ${r.cache.cacheHit.toLocaleString()} | ${r.cache.cacheHitRatePct}% | ${(r.usage?.completion_tokens ?? 0).toLocaleString()} | ${r.outputChars.toLocaleString()} | ${(r.elapsedMs/1000).toFixed(1)} | ${r.truncated ? '⚠️ 截断' : '✅'} |`);
  }

  md.push('');
  md.push('## 输出路径模板\n');
  md.push('```');
  md.push('cot对比实验/');
  md.push('├── logs/');
  md.push('│   ├── cot-run-<id>.log           # 每个问题的完整运行日志');
  md.push('│   ├── cot-run-summary.json       # 汇总数据（JSON）');
  md.push('│   └── cot-run-summary.md         # 本文件');
  md.push('├── snapshots/');
  md.push('│   └── cot-input-<id>.txt         # 每个问题实际发送的 prompt（运行时快照）');
  md.push('└── reasoning-output-cot-<id>.json # 每个问题的 LLM 输出 + 缓存命中率');
  md.push('```');

  fs.writeFileSync(MD_SUMMARY, md.join('\n'), 'utf-8');
}

/**
 * 主流程
 */
async function main() {
  console.log('='.repeat(80));
  console.log(`[CoT 批量实验] 模型: ${LLM_MODEL} (Flash V4) | endpoint: ${LLM_BASE_URL}`);
  console.log(`[CoT 批量实验] 问题数: ${TARGET_IDS.length} | 模式: ${FORCE ? '强制重跑' : '断点续跑'}`);
  console.log('='.repeat(80));

  const results = [];
  const batchT0 = Date.now();

  for (let i = 0; i < TARGET_IDS.length; i++) {
    const qid = TARGET_IDS[i];
    console.log(`\n${'─'.repeat(80)}\n[${i+1}/${TARGET_IDS.length}] 开始运行 ${qid}\n${'─'.repeat(80)}`);
    try {
      const r = await runOne(qid, i, TARGET_IDS.length);
      results.push(r);
      if (r.skipped) {
        console.log(`⏭️  ${qid}: ${r.reason}`);
      } else if (r.ok) {
        console.log(`✅ ${qid}: 完成（${(r.elapsedMs/1000).toFixed(1)}s, cache hit=${r.cache.cacheHitRatePct}%）`);
      } else {
        console.log(`❌ ${qid}: ${r.error}`);
      }
    } catch (err) {
      console.error(`❌ ${qid}: 异常 - ${err.message}`);
      results.push({ ok: false, questionId: qid, error: err.message });
    }
  }

  const batchElapsed = ((Date.now() - batchT0) / 1000).toFixed(1);
  console.log('\n' + '='.repeat(80));
  console.log(`[CoT 批量实验] 全部完成，总耗时 ${batchElapsed}s`);
  console.log('='.repeat(80));

  writeSummary(results);
  console.log(`\n📊 汇总报告已保存:`);
  console.log(`   JSON: ${SUMMARY_PATH}`);
  console.log(`   MD  : ${MD_SUMMARY}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
