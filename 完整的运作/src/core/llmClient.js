import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// 原始 LLM 客户端配置
export const LLM_BASE_URL = process.env.LLM_BASE_URL || 'https://api.deepseek.com';
export const LLM_MODEL = process.env.LLM_MODEL || 'deepseek-v4-flash';
export const LLM_API_KEY = process.env.LLM_API_KEY || process.env.DEEPSEEK_API_KEY;

if (!LLM_API_KEY) {
  console.error('错误: 缺少 LLM_API_KEY 或 DEEPSEEK_API_KEY 环境变量');
  process.exit(1);
}

const DEFAULT_SNAPSHOT_DIR = path.join(__dirname, 'llm-snapshots');
const SNAPSHOT_DIR = process.env.LLM_SNAPSHOT_DIR
  ? path.resolve(process.env.LLM_SNAPSHOT_DIR)
  : DEFAULT_SNAPSHOT_DIR;
if (!fs.existsSync(SNAPSHOT_DIR)) fs.mkdirSync(SNAPSHOT_DIR, { recursive: true });
console.log(`[llmClient] 快照根目录: ${SNAPSHOT_DIR}`);

// 每题独立子目录：counter 按 (questionId 或 '__global__') 隔离，避免跨问题编号冲突
const counterCache = new Map();

function resolveSubdir(questionId) {
  const subdir = questionId ? path.join(SNAPSHOT_DIR, questionId) : SNAPSHOT_DIR;
  if (!fs.existsSync(subdir)) fs.mkdirSync(subdir, { recursive: true });
  return subdir;
}

function initCounter(questionId) {
  const key = questionId || '__global__';
  const subdir = resolveSubdir(questionId);
  let counter = 0;
  try {
    const existing = fs.readdirSync(subdir).filter((f) => /^call-\d{4}-request\.json$/.test(f));
    if (existing.length > 0) {
      counter = Math.max(...existing.map((f) => parseInt(f.match(/^call-(\d{4})/)[1], 10)));
      console.log(`[llmClient] [${key}] 已有快照，从 call-${String(counter).padStart(4, '0')} 继续编号`);
    } else {
      console.log(`[llmClient] [${key}] 全新子目录，从 call-0001 开始编号`);
    }
  } catch (_) {}
  counterCache.set(key, counter);
  return counter;
}

function nextCallMeta(questionId) {
  const key = questionId || '__global__';
  if (!counterCache.has(key)) initCounter(questionId);
  let counter = counterCache.get(key) + 1;
  counterCache.set(key, counter);
  const subdir = resolveSubdir(questionId);
  return {
    callId: `call-${String(counter).padStart(4, '0')}`,
    subdir,
    counter,
  };
}

// ============ 重试策略 ============
// 仅对瞬时错误重试：网络错误（fetch 抛错）+ HTTP 408/429/5xx
// 不重试：HTTP 4xx（除 408/429）+ JSON 解析错误
const RETRY_MAX_ATTEMPTS = parseInt(process.env.LLM_RETRY_MAX || '3', 10);     // 总尝试次数（含首次）
const RETRY_BASE_DELAY_MS = parseInt(process.env.LLM_RETRY_BASE_DELAY_MS || '1000', 10);
const RETRY_MAX_DELAY_MS = parseInt(process.env.LLM_RETRY_MAX_DELAY_MS || '10000', 10);

function isRetryable(err, res) {
  // 网络层错误（fetch 抛出的异常）
  if (err && err.message) {
    const msg = err.message.toLowerCase();
    if (
      msg.includes('fetch failed') ||
      msg.includes('econnreset') ||
      msg.includes('etimedout') ||
      msg.includes('econnrefused') ||
      msg.includes('enotfound') ||
      msg.includes('eai_again') ||
      msg.includes('socket hang up') ||
      msg.includes('aborted')
    ) return true;
  }
  // HTTP 层错误（Response.ok=false）
  if (res && typeof res.status === 'number') {
    if (res.status === 408 || res.status === 429) return true;
    if (res.status >= 500 && res.status <= 599) return true;
  }
  return false;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function backoffDelay(attempt) {
  // 指数退避 + 10% 抖动：1s, 2s, 4s ...
  const base = Math.min(RETRY_BASE_DELAY_MS * Math.pow(2, attempt - 1), RETRY_MAX_DELAY_MS);
  const jitter = base * 0.1 * Math.random();
  return Math.round(base + jitter);
}

async function attemptFetch(prompt, maxTokens) {
  const res = await fetch(`${LLM_BASE_URL}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${LLM_API_KEY}`
    },
    body: JSON.stringify({
      model: LLM_MODEL,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: maxTokens,
      temperature: 0.0,
      stream: false,
      reasoning_effort: 'none'
    })
  });
  if (!res.ok) {
    const errText = await res.text();
    const httpErr = new Error(`HTTP ${res.status}: ${errText}`);
    httpErr.status = res.status;
    httpErr.response = res;
    throw httpErr;
  }
  return await res.json();
}

export async function callLLM(prompt, options = {}) {
  const questionId = options.questionId || null;
  const { callId, subdir } = nextCallMeta(questionId);
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

  const maxTokens = options.maxTokens || 32768;

  console.log(`\n[${callId}] LLM 调用开始...`);
  console.log(`  QuestionId: ${questionId || '(global)'}`);
  console.log(`  子目录: ${subdir}`);
  console.log(`  Prompt 长度: ${prompt.length} 字符`);
  console.log(`  Max tokens: ${maxTokens}`);
  console.log(`  重试策略: 最多 ${RETRY_MAX_ATTEMPTS} 次（仅网络错误/5xx/408/429）`);

  // 保存请求快照
  const requestSnapshot = {
    callId,
    questionId,
    timestamp,
    promptLength: prompt.length,
    promptPreview: prompt.substring(0, 500) + (prompt.length > 500 ? '...' : ''),
    fullPrompt: prompt,
    options: { ...options, questionId: undefined },
    retryPolicy: {
      maxAttempts: RETRY_MAX_ATTEMPTS,
      baseDelayMs: RETRY_BASE_DELAY_MS,
      maxDelayMs: RETRY_MAX_DELAY_MS,
    },
  };
  fs.writeFileSync(
    path.join(subdir, `${callId}-request.json`),
    JSON.stringify(requestSnapshot, null, 2),
    'utf-8'
  );
  fs.writeFileSync(
    path.join(subdir, `${callId}-prompt.txt`),
    prompt,
    'utf-8'
  );

  const t0 = Date.now();
  const attempts = []; // 每一次尝试的记录
  let response = null;
  let error = null;
  let finalAttempt = 0;

  for (let attempt = 1; attempt <= RETRY_MAX_ATTEMPTS; attempt++) {
    finalAttempt = attempt;
    const attemptT0 = Date.now();
    const attemptRecord = { attempt, startedAt: new Date().toISOString(), error: null, httpStatus: null };
    try {
      response = await attemptFetch(prompt, maxTokens);
      attemptRecord.elapsedMs = Date.now() - attemptT0;
      attempts.push(attemptRecord);
      console.log(`[${callId}] ✓ 第 ${attempt}/${RETRY_MAX_ATTEMPTS} 次成功 (${(attemptRecord.elapsedMs / 1000).toFixed(1)}s)`);
      break; // 成功则跳出
    } catch (err) {
      attemptRecord.error = err.message;
      attemptRecord.httpStatus = err.status ?? null;
      attemptRecord.elapsedMs = Date.now() - attemptT0;
      attempts.push(attemptRecord);
      const retryable = isRetryable(err, err.response);
      console.error(`[${callId}] ❌ 第 ${attempt}/${RETRY_MAX_ATTEMPTS} 次失败: ${err.message}` +
        (retryable && attempt < RETRY_MAX_ATTEMPTS ? `（可重试，${RETRY_MAX_ATTEMPTS - attempt} 次机会）` : ''));
      if (!retryable || attempt >= RETRY_MAX_ATTEMPTS) {
        error = err.message;
        break;
      }
      const delay = backoffDelay(attempt);
      console.log(`[${callId}] ⏳ 等待 ${delay}ms 后重试...`);
      await sleep(delay);
    }
  }

  const elapsed = Date.now() - t0;

  // 解析响应
  let result = null;
  if (response && response.choices && response.choices[0]) {
    const choice = response.choices[0];
    result = {
      text: choice.message?.content || '',
      usage: response.usage,
      truncated: choice.finish_reason === 'length',
      finishReason: choice.finish_reason
    };

    console.log(`[${callId}] ✓ 完成 (总计 ${(elapsed/1000).toFixed(1)}s, 尝试 ${attempts.length} 次)`);
    console.log(`  Token: prompt=${result.usage?.prompt_tokens ?? '-'} completion=${result.usage?.completion_tokens ?? '-'} total=${result.usage?.total_tokens ?? '-'}`);
    console.log(`  输出长度: ${result.text.length} 字符`);
    if (result.truncated) console.log('  ⚠️  输出被截断');
  }

  // 保存响应快照（含重试记录）
  const responseSnapshot = {
    callId,
    questionId,
    timestamp,
    elapsed,
    success: !!result,
    error,
    attempts: finalAttempt,
    retries: finalAttempt - 1,
    retryHistory: attempts,
    response: result,
    rawResponse: response,
  };
  fs.writeFileSync(
    path.join(subdir, `${callId}-response.json`),
    JSON.stringify(responseSnapshot, null, 2),
    'utf-8'
  );
  if (result?.text) {
    fs.writeFileSync(
      path.join(subdir, `${callId}-output.txt`),
      result.text,
      'utf-8'
    );
  }

  return result;
}
