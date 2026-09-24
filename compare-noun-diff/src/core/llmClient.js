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
export const LLM_MODEL = process.env.LLM_MODEL || 'deepseek-flash';
export const LLM_API_KEY = process.env.LLM_API_KEY || process.env.OPENAI_API_KEY || '';

export const IS_V4_FLASH = LLM_MODEL.toLowerCase().includes('flash') ||
  LLM_MODEL.toLowerCase().includes('v4');
export const DEFAULT_MAX_TOKENS = IS_V4_FLASH ? 32768 : 8192;

if (!LLM_API_KEY) {
  console.error('缺少 API 密钥：请在 .env 中设置 LLM_API_KEY');
}

export async function callLLM(prompt, { maxTokens = DEFAULT_MAX_TOKENS, temperature = 0, retryCount = 0 } = {}) {
  const MAX_RETRIES = 3;
  const BASE_DELAY = 2000;

  const thinkingParam = IS_V4_FLASH
    ? { reasoning_effort: 'none' }
    : { thinking: { type: 'disabled' } };

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
      await new Promise(r => setTimeout(r, BASE_DELAY * Math.pow(2, retryCount)));
      return callLLM(prompt, { maxTokens, temperature, retryCount: retryCount + 1 });
    }
    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      throw new Error(`DeepSeek API ${response.status}: ${errText.slice(0, 300)}`);
    }
    const data = await response.json();
    const text = data.choices?.[0]?.message?.content || '';
    const finishReason = data.choices?.[0]?.finish_reason || '';
    return { text, usage: data.usage || null, truncated: finishReason === 'length' };
  } catch (err) {
    if (retryCount < MAX_RETRIES) {
      await new Promise(r => setTimeout(r, BASE_DELAY * Math.pow(2, retryCount)));
      return callLLM(prompt, { maxTokens, temperature, retryCount: retryCount + 1 });
    }
    console.error('LLM调用失败:', err.message);
    return null;
  }
}
