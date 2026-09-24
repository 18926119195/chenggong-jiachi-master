/**
 * s1 LLM 补缺脚本（高速并行版）
 *
 * 策略：
 * 1. 从 s0-quality-report.json 读取残留区间（residuals）
 * 2. **批量合并**：将多个短截断合并到一个LLM请求中（减少网络往返）
 * 3. **并行批处理**：多个批次同时调用LLM（提速）
 * 4. **保留位置索引**：每个提取的名词记录其在纯文表中的精确偏移量
 * 5. **输出带位置的名词表**：供后续检索直接定位
 *
 * 用法：
 *   node s1-llm-fill.js
 *
 * 标记协议：每个截断在 prompt 里用【【N】】包裹，LLM 引用时也用【【N】】（机器可解析的 token），
 * 与 recall-nouns-llm.js 保持一致。
 */

import fs from 'fs';
import path from 'path';
import { buildPureTextTable } from './src/core/pureTextTable.js';
import { callLLM } from './src/core/llmClient.js';

const REPORT_PATH = process.env.REPORT_PATH || path.join(process.cwd(), 's0-quality-report.json');
const S0_HITS_PATH = process.env.S0_HITS_PATH || path.join(process.cwd(), 's0-hits.json');
const DOCUVERSE_PATH = process.env.DOCUVERSE_PATH || path.join(process.cwd(), 'docuverse_cartographies_squizoanalythiques_Fe_lix_Guattari_1789114122714.docuverse.json');
const OUTPUT_PATH = process.env.OUTPUT_PATH || path.join(process.cwd(), 's1-nouns-with-offsets.json');

// ---------- 并行控制 ----------
const CONCURRENCY = parseInt(process.env.LLM_CONCURRENCY || '5', 10); // 同时调用5个LLM请求
const BATCH_SIZE = parseInt(process.env.BATCH_SIZE || '8', 10); // 每个请求合并8个截断
const LIMIT = process.env.LIMIT ? parseInt(process.env.LIMIT, 10) : Infinity; // 测试用：限制处理的截断总数
const MAX_TOKENS_PER_CALL = 32768; // V4-Flash 上限 384K；设为 32K 安全阈值（省成本）

// ---------- 纯文表构建逻辑已提取到 src/core/pureTextTable.js（四个脚本共用）----------

// ---------- LLM 调用改用 src/core/llmClient.js（统一 .env、thinking=disabled、usage/truncated 检测）----------

// ---------- 批量提示词构建（多个截断合并） ----------
// 机器符码【【N】】（N=1..batchSize）让 LLM 用 token 引用截断，比写 JSON 键名更鲁棒。
// 对应 recall-nouns-llm.js 的【【N】】协议，输出层解析也能复用同套宽松匹配。
// 注意：不输出 chunkKey 等元数据，省 token 注意力窗口。
function buildBatchPrompt(truncations) {
  const sections = truncations.map((trunc, idx) => {
    return `【【${idx + 1}】】\n${trunc.text}`;
  }).join('\n');

  return `你是一个精确的语言学名词提取器。请从以下文本截断中提取**所有名词性成分**（名词、专有名词、名词短语）。

**要求**：
- 只提取名词及名词短语
- 不要提取纯动词、形容词、副词、连接词
- 保持原文形式（含重音符号、大小写）
- 用【【N】】引用截断编号

**输出格式**：
【【1】】名词1, 名词2
【【2】】名词3
（无名词时直接跳过该行，不要写 NONE 或留空）

**待处理截断**：

${sections}`;
}

// ---------- Token 估算（简单字符比估算，不依赖外部 encoder） ----------
// DeepSeek / GPT 族：1 token ≈ 4 字符（中文），prompt 保守按 3.5 字符/token
const CHARS_PER_TOKEN = 3.5;
const MAX_PROMPT_TOKENS = 2500; // 保守留 2.5K tokens 给输入 prompt（进一步缩小单批体积，多切批次而非扩大 max_tokens）

function estimatePromptTokens(text) {
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

// ---------- Token 预算感知分批 ----------
// 每批截断合并后估算 token 不超过 MAX_PROMPT_TOKENS，超了就减少截断数量。
// 与 BATCH_SIZE 环境变量配合：BATCH_SIZE 控制截断数量上限，token 预算作为硬上限。
function splitIntoTokenBoundedBatches(truncations) {
  const batches = [];
  let currentBatch = [];
  let currentPromptTokens = 0;

  for (const trunc of truncations) {
    const sectionText = `【【${currentBatch.length + 1}】】\n${trunc.text}`;
    const additionalTokens = estimatePromptTokens(sectionText);
    const estimatedTotal = currentPromptTokens + additionalTokens;

    if (currentBatch.length > 0 && estimatedTotal > MAX_PROMPT_TOKENS) {
      // 当前 batch 已满，启动新 batch
      batches.push([...currentBatch]);
      currentBatch = [trunc];
      currentPromptTokens = estimatePromptTokens(`【【1】】\n${trunc.text}`);
    } else {
      currentBatch.push(trunc);
      currentPromptTokens += additionalTokens;
    }
  }

  if (currentBatch.length > 0) {
    batches.push(currentBatch);
  }

  return batches;
}

// ---------- 解析批量LLM输出（参考 recall-nouns-llm.js 的宽松匹配策略） ----------
// 三层解析策略：
//   1. JSON 格式（识别 i / trunc_id / id / index，引用形如【【N】】或纯数字）
//   2. 行式【【N】】noun1, noun2（最常见的输出形态）
//   3. 扫描所有【【N】】，把两个【【N】】之间的 token 当名词列表
function parseBatchLLMOutput(rawOutput, batchSize, batchIdForDebug) {
  if (!rawOutput || typeof rawOutput !== 'string') return [];
  const text = rawOutput.trim();

  // 显式否定信号
  if (/^【【\s*】\s*】$/.test(text)) return [];

  const results = [];
  const seen = new Set();

  function pushEntry(truncId, nouns) {
    if (seen.has(truncId)) return;
    if (truncId < 1 || truncId > batchSize) return;
    seen.add(truncId);
    const clean = (Array.isArray(nouns) ? nouns : [nouns])
      .map((n) => (typeof n === 'string' ? n.trim() : ''))
      .filter((n) => n.length >= 2);
    results.push({ trunc_id: truncId, nouns: clean });
  }

  function parseRefValue(ref) {
    // 兼容 "【【3】】" / "3" / 3
    if (typeof ref === 'number') return ref;
    if (typeof ref !== 'string') return NaN;
    const m = ref.match(/(\d+)/);
    return m ? parseInt(m[1], 10) : NaN;
  }

  // ---- 策略 1: JSON ----
  const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  let jsonText = codeBlockMatch ? codeBlockMatch[1] : '';
  if (!jsonText) {
    const arrMatch = text.match(/\[[\s\S]*\]/);
    if (arrMatch) jsonText = arrMatch[0];
  }

  if (jsonText) {
    try {
      let fixed = jsonText.trim();
      // 自动修复 JSON：补齐缺失的闭合括号
      const openBrackets = (fixed.match(/\[/g) || []).length;
      const closeBrackets = (fixed.match(/\]/g) || []).length;
      const openBraces = (fixed.match(/\{/g) || []).length;
      const closeBraces = (fixed.match(/\}/g) || []).length;
      if (openBrackets > closeBrackets) {
        if (openBraces > closeBraces) fixed += '}';
        fixed += ']';
      }
      const parsed = JSON.parse(fixed);
      if (Array.isArray(parsed)) {
        for (const item of parsed) {
          if (!item || typeof item !== 'object') continue;
          const ref = item.i ?? item.trunc_id ?? item.id ?? item.index;
          const truncId = parseRefValue(ref);
          if (!Number.isFinite(truncId)) continue;
          const nouns = item.nouns ?? item.w ?? item.words ?? [];
          pushEntry(truncId, nouns);
        }
        if (results.length > 0) return results;
      }
    } catch (err) {
      // 继续 fallback
    }
  }

  // ---- 策略 2: 行式【【N】】noun1, noun2 ----
  // 支持两种变体：【【N】】名词1, 名词2 / 【【N】】：名词1, 名词2
  for (const m of text.matchAll(/【+(\d+)】+[^\n]*?[:：]\s*([^\n]+)/g)) {
    const truncId = parseInt(m[1], 10);
    const nouns = m[2]
      .split(/[,，;；\n|]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    pushEntry(truncId, nouns);
  }

  // ---- 策略 3: 扫所有【【N】】，把相邻内容当名词列表 ----
  if (results.length === 0) {
    const refs = [...text.matchAll(/【+(\d+)】+/g)];
    for (let i = 0; i < refs.length; i++) {
      const truncId = parseInt(refs[i][1], 10);
      if (truncId < 1 || truncId > batchSize) continue;
      const start = refs[i].index + refs[i][0].length;
      const end = i + 1 < refs.length ? refs[i + 1].index : text.length;
      const between = text.slice(start, end);
      const tokens = between
        .split(/[,，;；\s\n|·•]+/)
        .map((s) => s.trim().replace(/^[:：\.\-]+|[:：\.\-]+$/g, ''))
        .filter((s) => s.length >= 2);
      pushEntry(truncId, tokens);
    }
  }

  if (results.length === 0) {
    console.warn(`[批次 ${batchIdForDebug}] LLM输出无法解析（JSON/行式/【【N】】均失败），返回空结果`);
    console.warn('原始输出:', rawOutput.slice(0, 500));
  }

  return results;
}

// ---------- 停用词表（共享常量）---------- 
const STOPWORDS = [
  // 冠词
  'ou', 'et', 'de', 'des', 'le', 'la', 'les', 'un', 'une', 'du', 'au', 'aux',
  // 关系代词/疑问代词
  'qui', 'que', 'quoi', 'dont', 'où', 'quel', 'quelle', 'quels', 'quelles',
  // 人称代词
  'je', 'tu', 'il', 'elle', 'nous', 'vous', 'ils', 'elles', 'on',
  'me', 'te', 'se', 'lui', 'leur', 'leurs', 'moi', 'toi',
  // 指示代词/限定词
  'ce', 'cette', 'ces', 'cet', 'celui', 'celle', 'ceux', 'celles',
  // 所有格
  'mon', 'ma', 'mes', 'ton', 'ta', 'tes', 'son', 'sa', 'ses',
  'notre', 'nos', 'votre', 'vos',
  // 介词
  'par', 'pour', 'dans', 'avec', 'sans', 'sous', 'sur', 'chez', 'vers', 'entre',
  // 副词
  'plus', 'moins', 'bien', 'mal', 'tout', 'très', 'pas', 'non', 'même', 'aussi',
  'encore', 'déjà', 'toujours', 'jamais', 'ici', 'là',
  // 常用动词
  'est', 'sont', 'être', 'avoir', 'a', 'ont', 'fait', 'font', 'dit', 'disent',
  'peut', 'peuvent', 'doit', 'doivent', 'va', 'vont', 'était', 'étaient',
  // 连词/连接副词
  'mais', 'donc', 'or', 'ni', 'car', 'ainsi', 'alors', 'comme', 'puis',
  'cependant', 'pourtant', 'néanmoins', 'toutefois', 'lorsque', 'quand',
  'si', 'comment', 'pourquoi', 'partir',
  // 代词缩合/常见代词
  'cela', 'ceci', 'ça', 'rien', 'personne', 'quelque', 'quelques', 'quelqu\'un',
  'chaque', 'chacun', 'chacune', 'certains', 'certaines', 'certain', 'certaine',
  'autre', 'autres', 'tel', 'telle', 'tels', 'telles', 'seul', 'seule', 'seuls', 'seules',
  // 常见带元音省略形式（d'un、d'une、qu'、l'、n' 等缩合）
  'd\'un', 'd\'une', 'd\'autres', 'd\'autre', 'qu\'', 'qu\'il', 'qu\'elle',
  'l\'autre', 'l\'un', 'l\'une', 'lui-même', 'elle-même', 'eux-mêmes',
  // 形容词性泛化词（过于宽泛，非具体名词）
  'possible', 'possibles', 'nécessaire', 'nécessaires', 'seconde', 'second',
  'etc', 'avant', 'après', 'depuis', 'pendant', 'durant',
  // 英语
  'of', 'the', 'a', 'an', 'and', 'or', 'to', 'in', 'on', 'at', 'by', 'for', 'with',
  'he', 'she', 'it', 'we', 'they', 'his', 'her', 'its', 'our', 'their',
  'is', 'are', 'was', 'were', 'be', 'been', 'have', 'has', 'had',
  // 其他
  'pl', 'pré', 'ex'
];

const COMMON_PREFIXES = ['pré-', 'anti-', 'ex-', 'post-', 'néo-', 'proto-', 'pseudo-', 're-', 'sub-', 'super-'];

// ---------- 名词质量过滤规则（输出端，LLM 返回后应用）---------- 
function isValidNoun(noun) {
  const trimmed = noun.trim();
  
  // 规则1: 长度过短（<3字符），除非是全大写缩写
  if (trimmed.length < 3 && !/^[A-Z]{2,}$/.test(trimmed)) {
    return false;
  }
  
  // 规则2: 纯标点或数字
  if (/^[\d\s\p{P}]+$/u.test(trimmed)) {
    return false;
  }
  
  // 规则3: 常见前缀（法语/英语）
  if (COMMON_PREFIXES.some(prefix => trimmed.toLowerCase() === prefix.slice(0, -1))) {
    return false;
  }
  
  // 规则4: 停用词扩展（法语/英语常见虚词、代词、介词、副词、动词）
  if (STOPWORDS.includes(trimmed.toLowerCase())) {
    return false;
  }
  
  // 规则5: 单字母（除非大写）
  if (trimmed.length === 1 && !/[A-Z]/.test(trimmed)) {
    return false;
  }
  
  return true;
}

// ---------- 残文预过滤规则（输入端，送入 LLM 前应用，复用上述规则判断残文是否值得处理）---------- 
function shouldProcessResidual(residualText) {
  const trimmed = residualText.trim();
  
  // 规则1: 长度过短（<8字符）：太短的残文大概率是标点或虚词碎片
  if (trimmed.length < 8) {
    return false;
  }
  
  // 规则2: 纯标点或数字
  if (/^[\d\s\p{P}]+$/u.test(trimmed)) {
    return false;
  }
  
  // 规则3: 以停用词开头且后续无实质内容（停用词+标点/空格结尾）
  // 例如："de ", "le ", ", associée à une"
  const firstWord = trimmed.split(/[\s,;:!?\.]+/)[0].toLowerCase();
  if (STOPWORDS.includes(firstWord)) {
    // 如果首词是停用词，检查后续是否有非停用词的实质内容
    const tokens = trimmed.split(/[\s,;:!?\.]+/).map(t => t.toLowerCase()).filter(t => t.length >= 2);
    const hasValidToken = tokens.some(token => !STOPWORDS.includes(token) && !/^[\d\p{P}]+$/u.test(token));
    if (!hasValidToken) {
      return false;
    }
  }
  
  // 规则4: 纯虚词组合（所有token都是停用词/标点）
  const words = trimmed.split(/[\s,;:!?\.]+/).filter(w => w.length >= 2);
  if (words.length > 0) {
    const allStopwords = words.every(w => STOPWORDS.includes(w.toLowerCase()) || /^[\d\p{P}]+$/u.test(w));
    if (allStopwords) {
      return false;
    }
  }
  
  // 规则5: 只有单个常见前缀（如 "pré-", "anti-" 等）
  if (COMMON_PREFIXES.some(prefix => trimmed.toLowerCase() === prefix || trimmed.toLowerCase() === prefix.slice(0, -1))) {
    return false;
  }
  
  return true;
}

// ---------- 在单个 chunk 文本内定位名词偏移量（仅在截断原始区间内匹配，防污染检查） ----------
// 搜索范围严格限定在 [truncStart, truncEnd) 这个截断原始区间内。
// 理由：
//   - LLM 是针对这个截断给出的名词，超出截断范围的匹配可能命中 chunk 里其他上下文的
//     同名词，造成位置误配（precision 优先于 recall）。
//   - 找不到就应该丢弃该词，而不是靠扩大搜索范围硬凑出偏移量。
function locateNounInChunkText(noun, chunkText, truncStart, truncEnd, s0HitIntervalsInChunk = []) {
  // 质量过滤：直接拒绝低质量名词
  if (!isValidNoun(noun)) {
    return [];
  }

  const needle = noun.toLowerCase().trim();
  const offsets = [];

  const searchRegion = chunkText.slice(truncStart, truncEnd);
  const searchRegionLower = searchRegion.toLowerCase();

  let from = 0;
  while (from < searchRegionLower.length) {
    const at = searchRegionLower.indexOf(needle, from);
    if (at < 0) break;

    const localStart = truncStart + at;
    const localEnd = localStart + needle.length;

    // 防污染检查：如果这个位置与该 chunk 内 s0 已命中区间重叠，跳过（避免重复提取s0已覆盖的词）
    const overlapsS0 = s0HitIntervalsInChunk.some((interval) => {
      return !(localEnd <= interval.start || localStart >= interval.end);
    });

    if (!overlapsS0) {
      offsets.push({ start: localStart, end: localEnd });
    }

    from = at + needle.length;
  }

  return offsets;
}

// ---------- 并行批处理 ----------
// 改用 src/core/llmClient.js 的 callLLM：返回 { text, usage, truncated }
//   - usage.prompt_tokens / completion_tokens 用于整批 token 统计
//   - truncated=true (finish_reason='length') 意味着 batch 太大被截断，会丢部分截断
async function processBatchesParallel(batches, concurrency) {
  const results = [];
  const queue = [...batches];
  let completed = 0;

  const workers = Array.from({ length: concurrency }, async (_, workerId) => {
    while (queue.length > 0) {
      const batch = queue.shift();
      if (!batch) break;

      try {
        const prompt = buildBatchPrompt(batch.truncations);
        const res = await callLLM(prompt, { maxTokens: MAX_TOKENS_PER_CALL, temperature: 0 });
        if (!res) throw new Error('LLM 返回 null（重试耗尽）');

        const text = res.text || '';
        const parsed = parseBatchLLMOutput(text, batch.truncations.length, batch.batchId);

        completed++;
        const truncWarn = res.truncated
          ? ' ⚠️ 截断! 该批次 max_tokens 用尽，部分截断可能未返回'
          : '';
        const tok = res.usage
          ? ` (prompt=${res.usage.prompt_tokens ?? '-'} completion=${res.usage.completion_tokens ?? '-'} total=${res.usage.total_tokens ?? '-'})`
          : '';
        console.log(`[Worker ${workerId}] 批次 ${batch.batchId} 完成 (${completed}/${batches.length})${tok}${truncWarn}`);

        results.push({
          batchId: batch.batchId,
          parsed,
          ok: true,
          usage: res.usage || null,
          truncated: !!res.truncated,
        });
      } catch (err) {
        console.error(`[Worker ${workerId}] 批次 ${batch.batchId} 失败:`, err.message);
        results.push({ batchId: batch.batchId, ok: false, error: err.message });
      }
    }
  });

  await Promise.all(workers);
  return results;
}

// ---------- 主流程 ----------
async function main() {
  // API key 校验已下沉到 src/core/llmClient.js（启动时自动读 .env）

  console.log('========== s1 LLM 补缺 ==========');
  console.log(`LLM: ${process.env.LLM_BASE_URL || 'https://api.deepseek.com'} / ${process.env.LLM_MODEL || 'deepseek-chat'} (thinking=disabled)`);
  console.log(`并发: ${CONCURRENCY}, token预算上限: ${MAX_PROMPT_TOKENS}/批\n`);

  // 1. 读取 s0 质量报告（现在读取全部残留区间 residuals，不再是分类过滤后的 missedNounSamples）
  const report = JSON.parse(fs.readFileSync(REPORT_PATH, 'utf-8'));
  const missedNounSamples = report.residuals || [];

  if (missedNounSamples.length === 0) {
    console.log('无剩余残留区间，无需补缺');
    process.exit(0);
  }

  // 1.1. 读取 s0 命中位置表（用于去重防污染，现在按 chunkKey 分组）
  let s0HitIntervals = [];
  try {
    const s0Hits = JSON.parse(fs.readFileSync(S0_HITS_PATH, 'utf-8'));
    s0HitIntervals = s0Hits.hitsByChunk || [];
    console.log(`加载 s0 命中位置表: ${s0HitIntervals.length} 个 chunk，用于防污染去重\n`);
  } catch (err) {
    console.warn(`⚠️  无法加载 s0-hits.json (${err.message})，跳过防污染检查\n`);
  }

  // 1.2. 残文预过滤：在送入 LLM 前过滤掉纯虚词碎片（复用输出端过滤规则）
  const preFiltered = missedNounSamples.filter(trunc => shouldProcessResidual(trunc.text));
  const filteredOutCount = missedNounSamples.length - preFiltered.length;
  
  console.log(`读取剩余残留区间: ${missedNounSamples.length} 个截断`);
  console.log(`  预过滤（虚词碎片）: 过滤掉 ${filteredOutCount} 个 (${(filteredOutCount / missedNounSamples.length * 100).toFixed(1)}%)，保留 ${preFiltered.length} 个\n`);
  
  const truncationsToProcess = Number.isFinite(LIMIT) ? preFiltered.slice(0, LIMIT) : preFiltered;
  console.log(`本次处理: ${truncationsToProcess.length} 个截断\n`);

  // 2. 构建纯文表（按 chunk 存储，无全局拼接）
  const docuverse = JSON.parse(fs.readFileSync(DOCUVERSE_PATH, 'utf-8'));
  const pureTextTable = buildPureTextTable(docuverse.bookIndex);
  const chunkEntries = pureTextTable.entries;
  const chunkTextByKey = new Map(chunkEntries.map((e) => [e.chunkKey, e.text]));
  console.log(`纯文表构建完成: ${chunkEntries.length} 个 chunk\n`);

  // s0 命中区间按 chunkKey 分组（validate-s0-quality.js 已输出 hitsByChunk 结构）
  const s0HitsByChunk = new Map();
  for (const group of s0HitIntervals) {
    if (group.chunkKey) s0HitsByChunk.set(group.chunkKey, group.hits || []);
  }

  // 3. Token 预算感知分批（优先满足 MAX_PROMPT_TOKENS，硬上限；BATCH_SIZE 作为截断数量软上限）
  const tokenBoundedBatches = splitIntoTokenBoundedBatches(truncationsToProcess);
  const batches = tokenBoundedBatches.map((truncations, i) => ({
    batchId: i + 1,
    truncations,
  }));

  const estTotalTokens = batches.reduce((sum, b) => sum + estimatePromptTokens(buildBatchPrompt(b.truncations)), 0);
  const maxInBatch = Math.max(...batches.map((b) => b.truncations.length));
  const minInBatch = Math.min(...batches.map((b) => b.truncations.length));

  console.log(`分批完成: ${batches.length} 批（截断数 ${minInBatch}-${maxInBatch}/批，估算总 prompt tokens ≈ ${estTotalTokens}）\n`);
  console.log('开始并行调用LLM...\n');

  // 4. 并行处理
  const startTime = Date.now();
  const batchResults = await processBatchesParallel(batches, CONCURRENCY);
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  // ---- token 统计汇总 ----
  let totalPromptTokens = 0;
  let totalCompletionTokens = 0;
  let truncatedBatches = 0;
  let failedBatches = 0;
  for (const r of batchResults) {
    if (!r.ok) { failedBatches++; continue; }
    if (r.truncated) truncatedBatches++;
    if (r.usage) {
      totalPromptTokens += r.usage.prompt_tokens || 0;
      totalCompletionTokens += r.usage.completion_tokens || 0;
    }
  }
  console.log(`\nLLM调用完成，耗时 ${elapsed}s`);
  console.log(`  token: prompt=${totalPromptTokens} completion=${totalCompletionTokens} total=${totalPromptTokens + totalCompletionTokens}`);
  if (truncatedBatches > 0) {
    console.log(`  ⚠️  ${truncatedBatches}/${batchResults.length} 批次被 max_tokens 截断（建议减小 LLM_BATCH_SIZE）`);
  }
  if (failedBatches > 0) {
    console.log(`  ✗ ${failedBatches}/${batchResults.length} 批次失败`);
  }
  console.log('');

  // 5. 聚合结果：解析名词并在 chunk 局部文本内定位偏移量
  const s1Nouns = new Map(); // id -> { surface, offsets: [{chunkKey, start, end, page}], sourceTruncIds: [] }

  for (const batchResult of batchResults) {
    if (!batchResult.ok) continue;

    const batch = batches.find((b) => b.batchId === batchResult.batchId);
    if (!batch) continue;

    for (const item of batchResult.parsed) {
      const truncIndex = item.trunc_id - 1;
      if (truncIndex < 0 || truncIndex >= batch.truncations.length) continue;

      const trunc = batch.truncations[truncIndex];
      const chunkKey = trunc.chunkKey;
      const chunkText = chunkTextByKey.get(chunkKey);
      if (!chunkText) {
        console.warn(`截断所属 chunk ${chunkKey} 未在纯文表中找到，跳过`);
        continue;
      }

      const s0HitIntervalsInChunk = s0HitsByChunk.get(chunkKey) || [];

      for (const noun of item.nouns) {
        const id = noun.toLowerCase().trim().replace(/\s+/g, '_');
        if (id.length < 2) continue;

        const offsets = locateNounInChunkText(
          noun, 
          chunkText, 
          trunc.start, 
          trunc.end, 
          s0HitIntervalsInChunk
        );

        if (offsets.length === 0) {
          console.warn(`名词"${noun}"在 chunk ${chunkKey} 内未找到位置或与s0重叠`);
          continue;
        }

        if (!s1Nouns.has(id)) {
          s1Nouns.set(id, {
            id,
            surface: noun,
            offsets: [],
            sourceTruncIds: [],
          });
        }

        const entry = s1Nouns.get(id);
        // 附加 chunkKey 和 page 到每个 offset
        entry.offsets.push(...offsets.map(off => ({
          chunkKey,
          start: off.start,
          end: off.end,
          page: trunc.page,
        })));
        entry.sourceTruncIds.push(`${chunkKey}-${trunc.start}`);
      }
    }
  }

  // 6. 去重 offsets
  for (const entry of s1Nouns.values()) {
    const uniqueOffsets = new Map();
    for (const offset of entry.offsets) {
      const key = `${offset.chunkKey}-${offset.start}-${offset.end}`;
      uniqueOffsets.set(key, offset);
    }
    entry.offsets = [...uniqueOffsets.values()].sort((a, b) => 
      a.chunkKey.localeCompare(b.chunkKey) || a.start - b.start
    );
    entry.sourceTruncIds = [...new Set(entry.sourceTruncIds)].sort();
  }

  const s1Entries = [...s1Nouns.values()].sort((a, b) => b.offsets.length - a.offsets.length || a.id.localeCompare(b.id));

  // 7. 输出报告
  const output = {
    meta: {
      source: 's1 LLM补缺',
      llmProvider: 'openai-compatible',
      llmBaseUrl: process.env.LLM_BASE_URL || 'https://api.deepseek.com',
      model: process.env.LLM_MODEL || 'deepseek-chat',
      thinking: 'disabled',
      concurrency: CONCURRENCY,
      maxPromptTokensPerBatch: MAX_PROMPT_TOKENS,
      maxTokensPerCall: MAX_TOKENS_PER_CALL,
      charsPerToken: CHARS_PER_TOKEN,
      tokenUsage: {
        promptTokens: totalPromptTokens,
        completionTokens: totalCompletionTokens,
        totalTokens: totalPromptTokens + totalCompletionTokens,
      },
      batchStats: {
        total: batchResults.length,
        ok: batchResults.filter((r) => r.ok).length,
        failed: failedBatches,
        truncated: truncatedBatches,
      },
      chunkCount: chunkEntries.length,
      inputTruncations: truncationsToProcess.length,
      totalResiduals: missedNounSamples.length,
      outputNouns: s1Entries.length,
      totalOffsets: s1Entries.reduce((sum, e) => sum + e.offsets.length, 0),
      elapsedSeconds: parseFloat(elapsed),
      s0ChunkGroupCount: s0HitsByChunk.size,
      deduplicationInfo: s0HitsByChunk.size > 0 
        ? `已过滤与 s0 重叠的位置（基于 ${s0HitsByChunk.size} 个 chunk 的命中区间）`
        : '未加载 s0-hits.json，未执行防污染过滤',
    },
    nouns: s1Entries,
  };

  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 2), 'utf-8');

  console.log('========== 补缺完成 ==========');
  console.log(`补缺名词数: ${s1Entries.length} 个`);
  console.log(`总命中位置: ${output.meta.totalOffsets} 处`);
  console.log(`平均每词命中: ${(output.meta.totalOffsets / Math.max(s1Entries.length, 1)).toFixed(1)} 处`);
  console.log(`防污染: ${output.meta.deduplicationInfo}`);
  console.log(`输出文件: ${OUTPUT_PATH}`);
  console.log(`\n前10个补缺名词（按命中位置数排序）:`);
  s1Entries.slice(0, 10).forEach((e, i) => {
    console.log(`  ${i + 1}. ${e.surface} (命中${e.offsets.length}处)`);
  });
}

main().catch((err) => {
  console.error('执行失败:', err);
  process.exit(1);
});
