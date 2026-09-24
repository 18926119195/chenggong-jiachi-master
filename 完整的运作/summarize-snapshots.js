/**
 * 汇总每题 LLM 调用快照（含缓存命中信息）
 *
 * 输入：问题一/snapshots/{questionId}/call-*-response.json
 * 输出：
 *   - 问题一/snapshots/{questionId}/llm-calls-summary.csv  （每题 CSV）
 *   - 问题一/snapshots/{questionId}/llm-calls-summary.json （每题 JSON）
 *   - 问题一/snapshots/llm-calls-summary-all.csv           （全部题目汇总）
 *   - 问题一/snapshots/llm-calls-summary-all.json          （全部题目汇总）
 *
 * 字段：callId, timestamp, success, elapsedMs, promptLength,
 *       promptTokens, completionTokens, totalTokens,
 *       cachedTokens, cacheHitTokens, cacheMissTokens,
 *       cacheHitRate, finishReason, truncated, outputLength, error
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// 支持环境变量覆盖，默认在 完整的运作 同级的 问题一/snapshots
const DEFAULT_SNAPSHOTS_DIR = path.join(__dirname, '..', '问题一', 'snapshots');
const SNAPSHOTS_DIR = process.env.SNAPSHOTS_DIR
  ? path.resolve(process.env.SNAPSHOTS_DIR)
  : DEFAULT_SNAPSHOTS_DIR;

if (!fs.existsSync(SNAPSHOTS_DIR)) {
  console.error(`未找到快照目录: ${SNAPSHOTS_DIR}`);
  process.exit(1);
}

const CSV_HEADER = [
  'callId', 'timestamp', 'success', 'elapsedMs', 'promptLength',
  'promptTokens', 'completionTokens', 'totalTokens',
  'cachedTokens', 'cacheHitTokens', 'cacheMissTokens', 'cacheHitRatePct',
  'finishReason', 'truncated', 'outputLength', 'error',
];

function readResponseFile(filePath) {
  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    const obj = JSON.parse(raw);
    return obj;
  } catch (e) {
    return { error: `parse_failed: ${e.message}` };
  }
}

function readRequestMeta(filePath) {
  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    const obj = JSON.parse(raw);
    return {
      promptLength: obj.promptLength ?? 0,
      timestamp: obj.timestamp ?? '',
    };
  } catch (_) {
    return { promptLength: 0, timestamp: '' };
  }
}

function extractCallRow(questionId, callId) {
  const dir = path.join(SNAPSHOTS_DIR, questionId);
  // callId 形如 "0001"（不含 "call-" 前缀）；文件名是 "call-0001-response.json"
  const respPath = path.join(dir, `call-${callId}-response.json`);
  const reqPath = path.join(dir, `call-${callId}-request.json`);

  if (!fs.existsSync(respPath)) {
    return null;
  }

  const resp = readResponseFile(respPath);
  const req = fs.existsSync(reqPath) ? readRequestMeta(reqPath) : { promptLength: 0, timestamp: '' };
  const usage = resp.response?.usage || {};
  const promptTokens = usage.prompt_tokens ?? 0;
  const completionTokens = usage.completion_tokens ?? 0;
  const totalTokens = usage.total_tokens ?? 0;
  const cachedTokens = usage.prompt_tokens_details?.cached_tokens ?? usage.prompt_cache_hit_tokens ?? 0;
  const cacheHitTokens = usage.prompt_cache_hit_tokens ?? cachedTokens;
  const cacheMissTokens = usage.prompt_cache_miss_tokens ?? Math.max(0, promptTokens - cacheHitTokens);
  const cacheHitRatePct = promptTokens > 0 ? +((cacheHitTokens / promptTokens) * 100).toFixed(2) : 0;
  const outputLength = (resp.response?.text || '').length;

  return {
    callId,
    timestamp: resp.timestamp || req.timestamp,
    success: resp.success ?? false,
    elapsedMs: resp.elapsed ?? 0,
    promptLength: req.promptLength,
    promptTokens,
    completionTokens,
    totalTokens,
    cachedTokens,
    cacheHitTokens,
    cacheMissTokens,
    cacheHitRatePct,
    finishReason: resp.response?.finishReason ?? '',
    truncated: resp.response?.truncated ?? false,
    outputLength,
    error: resp.error ?? '',
  };
}

function toCsv(rows) {
  const lines = [CSV_HEADER.join(',')];
  for (const r of rows) {
    const cells = CSV_HEADER.map((h) => {
      const v = r[h];
      if (v === null || v === undefined) return '';
      const s = String(v);
      if (s.includes(',') || s.includes('"') || s.includes('\n')) {
        return `"${s.replace(/"/g, '""')}"`;
      }
      return s;
    });
    lines.push(cells.join(','));
  }
  return lines.join('\n');
}

function aggregate(rows) {
  const totals = {
    calls: rows.length,
    successful: rows.filter((r) => r.success).length,
    failed: rows.filter((r) => !r.success).length,
    truncated: rows.filter((r) => r.truncated).length,
    totalPromptTokens: rows.reduce((a, r) => a + r.promptTokens, 0),
    totalCompletionTokens: rows.reduce((a, r) => a + r.completionTokens, 0),
    totalTokens: rows.reduce((a, r) => a + r.totalTokens, 0),
    totalCachedTokens: rows.reduce((a, r) => a + r.cachedTokens, 0),
    totalCacheHitTokens: rows.reduce((a, r) => a + r.cacheHitTokens, 0),
    totalCacheMissTokens: rows.reduce((a, r) => a + r.cacheMissTokens, 0),
    totalElapsedMs: rows.reduce((a, r) => a + r.elapsedMs, 0),
    totalOutputChars: rows.reduce((a, r) => a + r.outputLength, 0),
  };
  totals.overallCacheHitRatePct = totals.totalPromptTokens > 0
    ? +((totals.totalCacheHitTokens / totals.totalPromptTokens) * 100).toFixed(2)
    : 0;
  return totals;
}

function listCallIds(questionId) {
  const dir = path.join(SNAPSHOTS_DIR, questionId);
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter((f) => /^call-\d{4}-response\.json$/.test(f))
    .map((f) => f.match(/^call-(\d{4})/)[1])
    .sort();
}

function processQuestion(questionId) {
  const callIds = listCallIds(questionId);
  const rows = [];
  for (const cid of callIds) {
    const row = extractCallRow(questionId, cid);
    if (row) rows.push(row);
  }
  rows.sort((a, b) => a.callId.localeCompare(b.callId));

  const csv = toCsv(rows);
  const agg = aggregate(rows);

  const jsonSummary = {
    questionId,
    generatedAt: new Date().toISOString(),
    aggregate: agg,
    calls: rows,
  };

  const dir = path.join(SNAPSHOTS_DIR, questionId);
  fs.writeFileSync(path.join(dir, 'llm-calls-summary.csv'), csv, 'utf-8');
  fs.writeFileSync(path.join(dir, 'llm-calls-summary.json'), JSON.stringify(jsonSummary, null, 2), 'utf-8');

  return { rows, agg };
}

function main() {
  const questions = fs.readdirSync(SNAPSHOTS_DIR, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort();

  console.log(`找到 ${questions.length} 个问题目录`);

  const allRows = [];
  const allAgg = [];

  for (const qid of questions) {
    const { rows, agg } = processQuestion(qid);
    allRows.push(...rows.map((r) => ({ ...r, questionId: qid })));
    allAgg.push({ questionId: qid, ...agg });
    console.log(
      `  [${qid}] calls=${agg.calls}, ok=${agg.successful}, fail=${agg.failed}, ` +
      `prompt=${agg.totalPromptTokens}, completion=${agg.totalCompletionTokens}, ` +
      `cached=${agg.totalCachedTokens} (${agg.overallCacheHitRatePct}%)`
    );
  }

  // 全部题目汇总
  const allCsv = toCsv(allRows);
  const grandTotal = aggregate(allRows);
  const grandJson = {
    generatedAt: new Date().toISOString(),
    questionCount: questions.length,
    perQuestion: allAgg,
    grandTotal,
    calls: allRows,
  };

  fs.writeFileSync(path.join(SNAPSHOTS_DIR, 'llm-calls-summary-all.csv'), allCsv, 'utf-8');
  fs.writeFileSync(path.join(SNAPSHOTS_DIR, 'llm-calls-summary-all.json'), JSON.stringify(grandJson, null, 2), 'utf-8');

  console.log(`\n===== 全部汇总 =====`);
  console.log(`  题目数: ${questions.length}`);
  console.log(`  总调用: ${grandTotal.calls}`);
  console.log(`  成功: ${grandTotal.successful} / 失败: ${grandTotal.failed} / 截断: ${grandTotal.truncated}`);
  console.log(`  输入 tokens: ${grandTotal.totalPromptTokens}`);
  console.log(`  输出 tokens: ${grandTotal.totalCompletionTokens}`);
  console.log(`  缓存命中 tokens: ${grandTotal.totalCacheHitTokens} (${grandTotal.overallCacheHitRatePct}%)`);
  console.log(`  总耗时: ${(grandTotal.totalElapsedMs / 1000).toFixed(1)}s`);
  console.log(`\n输出文件:`);
  for (const qid of questions) {
    console.log(`  问题一/snapshots/${qid}/llm-calls-summary.{csv,json}`);
  }
  console.log(`  问题一/snapshots/llm-calls-summary-all.{csv,json}`);
}

main();
