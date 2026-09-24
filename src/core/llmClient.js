import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// 原始 LLM 客户端配置
export const LLM_BASE_URL = process.env.LLM_BASE_URL || 'https://api.deepseek.com';
export const LLM_MODEL = process.env.LLM_MODEL || 'deepseek-flash';
export const LLM_API_KEY = process.env.LLM_API_KEY || process.env.DEEPSEEK_API_KEY;

if (!LLM_API_KEY) {
  console.error('错误: 缺少 LLM_API_KEY 或 DEEPSEEK_API_KEY 环境变量');
  process.exit(1);
}

const SNAPSHOT_DIR = path.join(process.cwd(), 'snapshots');
let callCounter = 0;

export async function callLLM(prompt, options = {}) {
  callCounter++;
  const callId = `call-${String(callCounter).padStart(4, '0')}`;
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

  const maxTokens = options.maxTokens || 32768;
  const maxRetries = options.maxRetries ?? 3;
  const baseRetryDelayMs = options.retryDelayMs ?? 2000;

  console.log(`\n[${callId}] LLM 调用开始...`);
  console.log(`  Prompt 长度: ${prompt.length} 字符`);
  console.log(`  Max tokens: ${maxTokens}`);
  console.log(`  重试策略: 最多 ${maxRetries} 次，初始退避 ${baseRetryDelayMs}ms（指数退避）`);

  // 保存请求快照
  const requestSnapshot = {
    callId,
    timestamp,
    promptLength: prompt.length,
    promptPreview: prompt.substring(0, 500) + (prompt.length > 500 ? '...' : ''),
    fullPrompt: prompt,
    options: { ...options, maxRetries, baseRetryDelayMs },
  };
  fs.writeFileSync(
    path.join(SNAPSHOT_DIR, `${callId}-request.json`),
    JSON.stringify(requestSnapshot, null, 2),
    'utf-8'
  );
  fs.writeFileSync(
    path.join(SNAPSHOT_DIR, `${callId}-prompt.txt`),
    prompt,
    'utf-8'
  );

  const t0 = Date.now();
  let response;
  let error;
  const retries = [];

  // ====== 重试循环（指数退避）======
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
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
        throw new Error(`HTTP ${res.status}: ${errText}`);
      }

      response = await res.json();
      error = null;

      if (attempt > 1) {
        console.log(`[${callId}] ✓ 第 ${attempt}/${maxRetries} 次尝试成功（共重试 ${attempt - 1} 次）`);
      }
      break; // 成功，退出重试循环
    } catch (err) {
      error = err.message;
      retries.push({
        attempt,
        error: err.message,
        elapsedMs: Date.now() - t0,
      });

      if (attempt < maxRetries) {
        const delay = baseRetryDelayMs * Math.pow(2, attempt - 1); // 2s → 4s → 8s
        console.warn(`[${callId}] ⚠️  第 ${attempt}/${maxRetries} 次尝试失败：${err.message}`);
        console.warn(`[${callId}]    ${delay}ms 后重试...`);
        await new Promise((r) => setTimeout(r, delay));
      } else {
        console.error(`[${callId}] ❌ 第 ${attempt}/${maxRetries} 次尝试也失败，不再重试`);
      }
    }
  }

  const elapsed = Date.now() - t0;

  // ====== 最终失败：返回 null，让 caller 决定是跳过还是重试 ======
  if (error) {
    console.error(`[${callId}] ❌ LLM 调用彻底失败：${maxRetries} 次重试后仍无法获取响应`);
    console.error(`[${callId}]    最后错误：${error}`);

    // 保存失败响应快照（保留现场，方便排查）
    const failSnapshot = {
      callId,
      timestamp,
      elapsed,
      success: false,
      error,
      retries,
      response: null,
      rawResponse: null,
    };
    fs.writeFileSync(
      path.join(SNAPSHOT_DIR, `${callId}-response.json`),
      JSON.stringify(failSnapshot, null, 2),
      'utf-8'
    );
    
    return null; // 返回 null，不抛异常（让 15 题循环继续）
  }

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

    console.log(`[${callId}] ✓ 完成 (${(elapsed/1000).toFixed(1)}s)${retries.length > 0 ? `（含 ${retries.length} 次重试）` : ''}`);
    console.log(`  Token: prompt=${result.usage?.prompt_tokens ?? '-'} completion=${result.usage?.completion_tokens ?? '-'} total=${result.usage?.total_tokens ?? '-'}`);
    
    // 缓存命中统计
    const cacheHit = result.usage?.prompt_cache_hit_tokens || 0;
    const cacheMiss = result.usage?.prompt_cache_miss_tokens || 0;
    if (cacheHit > 0 || cacheMiss > 0) {
      const hitRate = cacheHit + cacheMiss > 0 ? ((cacheHit / (cacheHit + cacheMiss)) * 100).toFixed(1) : '0.0';
      console.log(`  缓存: hit=${cacheHit} miss=${cacheMiss} (命中率=${hitRate}%)`);
    }
    
    console.log(`  输出长度: ${result.text.length} 字符`);
    if (result.truncated) console.log('  ⚠️  输出被截断');
  }

  // 保存响应快照
  const responseSnapshot = {
    callId,
    timestamp,
    elapsed,
    success: !!result,
    retries, // 始终输出 retries 字段（成功时为空数组）
    response: result,
    rawResponse: response
  };
  fs.writeFileSync(
    path.join(SNAPSHOT_DIR, `${callId}-response.json`),
    JSON.stringify(responseSnapshot, null, 2),
    'utf-8'
  );
  if (result?.text) {
    fs.writeFileSync(
      path.join(SNAPSHOT_DIR, `${callId}-output.txt`),
      result.text,
      'utf-8'
    );
  }

  return result;
}
