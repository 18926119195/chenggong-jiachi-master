/**
 * CoT 对比实验专用 LLM 客户端
 *
 * 与 src/core/llmClient.js 的唯一区别：
 *   reasoning_effort: 'none'  →  'high' + thinking type=enabled
 *
 * 用于实验组一（CoT）的名词召回和推理阶段。
 */

import fs from 'fs';
import path from 'path';

function loadDotEnv() {
  const envPath = path.join(process.cwd(), '.env');
  if (!fs.existsSync(envPath)) return;
  const content = fs.readFileSync(envPath, 'utf-8');
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

loadDotEnv();

export const LLM_BASE_URL = process.env.LLM_BASE_URL || 'https://api.deepseek.com';
export const LLM_MODEL = process.env.LLM_MODEL || 'deepseek-flash';   // DeepSeek-V4.1-Flash（默认即 Flash V4，不再回退到 V4-Pro）
export const LLM_API_KEY = process.env.LLM_API_KEY || process.env.OPENAI_API_KEY || '';

export const DEFAULT_MAX_TOKENS = 384000;

/**
 * 对齐官网 chat.deepseek.com 默认行为（基于 Flash V4）：
 *   temperature = 0.6（Flash V4 默认温度）
 *   max_tokens = 384000（Flash V4 上限输出）
 *   reasoning_effort = 'high'（DeepThink 模式）
 *   thinking = { type: 'enabled' }
 *
 * 注：之前默认是 'deepseek-v4-pro'，已统一改为 'deepseek-flash'（Flash V4），
 *    与 .env 中的 LLM_MODEL 配置保持一致，且更经济（Flash 比 Pro 便宜约 4 倍）。
 */

if (!LLM_API_KEY) {
  console.error('[CoT] 缺少 API 密钥：请在 .env 中设置 LLM_API_KEY');
}

/**
 * CoT 版 LLM 调用（实验组一专用）
 *
 * deepseek-flash（Flash V4）+ reasoning_effort='high' + thinking type=enabled
 *
 * @param {string} prompt - 用户 prompt
 * @param {object} opts   - { maxTokens, temperature, retryCount }
 */
export async function callLLM_CoT(prompt, { maxTokens = DEFAULT_MAX_TOKENS, temperature = 0.6, retryCount = 0 } = {}) {
  const MAX_RETRIES = 3;
  const BASE_DELAY = 2000;

  // 顶级 CoT：deepseek-flash（Flash V4）+ reasoning_effort='high' + thinking type=enabled
  const thinkingParam = {
    reasoning_effort: 'high',
    extra_body: { thinking: { type: 'enabled' } },
  };

  try {
    const response = await fetch(`${LLM_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${LLM_API_KEY}` },
      body: JSON.stringify({
        model: LLM_MODEL,
        temperature,
        max_tokens: maxTokens,
        ...thinkingParam,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (response.status === 429 && retryCount < MAX_RETRIES) {
      await new Promise((r) => setTimeout(r, BASE_DELAY * Math.pow(2, retryCount)));
      return callLLM_CoT(prompt, { maxTokens, temperature, retryCount: retryCount + 1 });
    }

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      throw new Error(`DeepSeek API ${response.status}: ${errText.slice(0, 300)}`);
    }

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content || '';
    const reasoningText = data.choices?.[0]?.message?.reasoning_content || '';
    const finishReason = data.choices?.[0]?.finish_reason || '';
    return { text, reasoningText, usage: data.usage || null, truncated: finishReason === 'length' };

  } catch (err) {
    if (retryCount < MAX_RETRIES) {
      await new Promise((r) => setTimeout(r, BASE_DELAY * Math.pow(2, retryCount)));
      return callLLM_CoT(prompt, { maxTokens, temperature, retryCount: retryCount + 1 });
    }
    console.error('[CoT] LLM调用失败:', err.message);
    return null;
  }
}
