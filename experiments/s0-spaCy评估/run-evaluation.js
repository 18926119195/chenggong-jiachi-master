/**
 * s0 阶段 spaCy 抽取质量评估实验
 * 
 * 实验目标：
 * 1. 测试 spaCy 法语模型（fr_core_news_sm）的名词抽取效果
 * 2. 分析是否需要停用词过滤
 * 3. 评估覆盖率、误抽率和漏检率
 * 
 * 不污染主流程：在独立文件夹生成输出文件
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const EXPERIMENT_DIR = __dirname;

// ============ 纯文表构建（内联，避免路径问题）===========

function stripHtmlTags(text) {
  return text
    .replace(/<\/?(?:div|table|tr|td|th|thead|tbody|sup|sub|span|p|br)\b[^>]*>/gi, '')
    .replace(/<[^>]+>/g, '');
}

function stripLatexResidue(text) {
  return text
    .replace(/\$\$[^$]*\$\$/g, ' ')
    .replace(/\$[^$\n]*\$/g, ' ')
    .replace(/\\[a-zA-Z]+(?:\{[^{}]*\})*/g, ' ')
    .replace(/\\+/g, ' ')
    .replace(/[\^_]\{[^{}]*\}/g, ' ')
    .replace(/\s{2,}/g, ' ');
}

function atomSearchText(chunk) {
  const text = chunk.faces?.text?.content?.trim();
  if (text && text.length >= 8) return stripLatexResidue(stripHtmlTags(text));
  const raw = (chunk.content || '').trim();
  if (raw && !raw.startsWith('[FIG:') && raw.length >= 8) return stripLatexResidue(stripHtmlTags(raw));
  if (text) return stripLatexResidue(stripHtmlTags(text));
  const note = (chunk.faces?.fig?.note || '').trim();
  return stripLatexResidue(stripHtmlTags(
    note
      .replace(/请依据可见版面回答[^。]*。?/g, '')
      .replace(/勿编造未提供的文字[^。]*。?/g, '')
      .replace(/无文字层\/未OCR[^。]*。?/g, '')
      .trim(),
  ));
}

function isRetrievableAtom(chunk) {
  const t = atomSearchText(chunk);
  if (t.length < 4) return false;
  if (chunk.kind === 'fig' && t.length < 24 && !chunk.faces?.text) return false;
  if (chunk.kind === 'fig' && !chunk.faces?.text) {
    const rawNote = chunk.faces?.fig?.note || '';
    if (/无文字层|未OCR/.test(rawNote)) return false;
  }
  return true;
}

function buildPureTextTable(bookIndex) {
  const entries = [];
  for (const chunk of bookIndex.chunks) {
    if (!isRetrievableAtom(chunk)) continue;
    const text = atomSearchText(chunk).trim();
    if (!text) continue;
    entries.push({ chunkKey: chunk.key, page: chunk.page, text });
  }
  return { entries };
}

const SPACY_URL = 'http://localhost:5001/extract_nouns';
const DOCUVERSE_PATH = 'C:\\Users\\Administrator\\Desktop\\docuverse_cartographies_squizoanalythiques_Fe_lix_Guattari_1789114122714.docuverse.json';

// ============ 1. 加载语料 ============
console.log('='.repeat(60));
console.log('s0 阶段 spaCy 抽取质量评估实验');
console.log('='.repeat(60));
console.log('\n[1/5] 读取语料...');

if (!fs.existsSync(DOCUVERSE_PATH)) {
  console.error('错误：docuverse 文件不存在');
  process.exit(1);
}

const raw = fs.readFileSync(DOCUVERSE_PATH, 'utf-8');
const data = JSON.parse(raw);

if (data.kind !== 'docuverse-corpus' || !data.bookIndex?.chunks) {
  console.error('错误：无效的 docuverse-corpus 文件');
  process.exit(1);
}

// ============ 2. 构建纯文表 ============
console.log('[2/5] 构建纯文表...');
const pureTextTable = buildPureTextTable(data.bookIndex);
const entries = pureTextTable.entries;
console.log(`  - chunks 总数: ${entries.length}`);

// ============ 3. 调用 spaCy 抽取 ============
console.log('[3/5] 调用 spaCy 抽取名词...');

const allNouns = [];
const CONCURRENCY = 10;
let processed = 0;
let failedChunks = 0;

const processChunk = async (entry) => {
  try {
    const spacyRes = await fetch(SPACY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: entry.text,
        include_proper_nouns: true,
        include_nouns: true,
        min_length: 2,
      }),
    });
    
    if (!spacyRes.ok) {
      throw new Error(`HTTP ${spacyRes.status}`);
    }
    
    const spacyResult = await spacyRes.json();
    
    const chunkNouns = [
      ...spacyResult.nouns.map((n) => ({
        surface: n.surface,
        pos: n.pos,
        tag: n.tag,
        chunkKey: entry.chunkKey,
        page: entry.page,
        start: n.start,
        end: n.end,
      })),
      ...spacyResult.noun_phrases.map((p) => ({
        surface: p.surface,
        pos: p.pos,
        tag: p.tag,
        chunkKey: entry.chunkKey,
        page: entry.page,
        start: p.start,
        end: p.end,
      })),
    ];
    
    return { success: true, nouns: chunkNouns };
  } catch (err) {
    return { success: false, nouns: [], error: err.message };
  }
};

// 并发处理
const results = [];
for (let i = 0; i < entries.length; i += CONCURRENCY) {
  const batch = entries.slice(i, i + CONCURRENCY);
  const batchResults = await Promise.all(batch.map(processChunk));
  
  for (const result of batchResults) {
    if (result.success) {
      allNouns.push(...result.nouns);
    } else {
      failedChunks++;
    }
    processed++;
  }
  
  process.stdout.write(`\r  进度: ${processed}/${entries.length} chunks (失败: ${failedChunks})`);
}

console.log(`\n  抽取完成: ${allNouns.length} 个名词/短语`);

// ============ 4. 统计分析 ============
console.log('[4/5] 统计分析...');

// 4.1 按 POS 分布统计
const posDistribution = {};
const tagDistribution = {};
for (const noun of allNouns) {
  posDistribution[noun.pos] = (posDistribution[noun.pos] || 0) + 1;
  tagDistribution[noun.tag] = (tagDistribution[noun.tag] || 0) + 1;
}

// 4.2 词长分布
const lengthDistribution = { '1-3': 0, '4-6': 0, '7-10': 0, '11+': 0 };
for (const noun of allNouns) {
  const len = noun.surface.length;
  if (len <= 3) lengthDistribution['1-3']++;
  else if (len <= 6) lengthDistribution['4-6']++;
  else if (len <= 10) lengthDistribution['7-10']++;
  else lengthDistribution['11+']++;
}

// 4.3 覆盖率计算
const nounsByChunk = new Map();
for (const n of allNouns) {
  if (!nounsByChunk.has(n.chunkKey)) nounsByChunk.set(n.chunkKey, []);
  nounsByChunk.get(n.chunkKey).push(n);
}

let totalChars = 0;
let hitChars = 0;

function buildHitMask(chunkText, nouns) {
  const hitMask = new Array(chunkText.length).fill(false);
  for (const n of nouns) {
    if (n.start >= 0 && n.end <= chunkText.length && n.start < n.end) {
      for (let i = n.start; i < n.end; i++) hitMask[i] = true;
    }
  }
  return hitMask;
}

for (const entry of entries) {
  totalChars += entry.text.length;
  const chunkNouns = nounsByChunk.get(entry.chunkKey) || [];
  const hitMask = buildHitMask(entry.text, chunkNouns);
  hitChars += hitMask.filter(Boolean).length;
}

const coverage = totalChars > 0 ? (hitChars / totalChars * 100).toFixed(2) : 0;

// 4.4 提取剩余文（未命中区域）
const FRENCH_FUNCTION_WORDS = new Set([
  'le', 'la', 'les', 'l', 'un', 'une', 'des', 'du', 'au', 'aux',
  'de', 'à', 'a', 'en', 'sur', 'sous', 'dans', 'par', 'pour', 'avec', 'sans',
  'vers', 'chez', 'entre', 'depuis', 'pendant', 'devant', 'derrière', 'jusque', 'jusqu',
  'contre', 'selon', 'malgré', 'outre', 'parmi', 'hors',
  'et', 'ou', 'ni', 'mais', 'donc', 'car', 'or', 'que', 'qu', 'si', 's',
  'comme', 'quand', 'lorsque', 'puisque', 'quoique',
  'qui', 'quoi', 'dont', 'où', 'ce', 'cet', 'cette', 'ces', 'celui', 'celle', 'ceux', 'celles',
  'il', 'elle', 'ils', 'elles', 'on', 'nous', 'vous', 'je', 'tu', 'te', 't', 'me', 'm',
  'lui', 'leur', 'leurs', 'son', 'sa', 'ses', 'notre', 'nos', 'votre', 'vos', 'mon', 'ma', 'mes',
  'y', 'en', 'se', 'soi',
  'd', 'n', 'j', 'c',
  'est', 'sont', 'être', 'a', 'ont', 'avoir', 'fut', 'était', 'étaient',
  'ne', 'pas', 'plus', 'moins', 'très', 'bien', 'aussi', 'ainsi', 'alors', 'donc',
  'là', 'ici', 'déjà', 'encore', 'toujours', 'jamais', 'peu', 'trop',
]);

function tokenizeResidual(text) {
  return text.toLowerCase().split(/[^a-zàâäéèêëïîôöùûüçœæ]+/i).filter(t => t.length > 0);
}

function isAllFunctionWords(text) {
  const tokens = tokenizeResidual(text);
  if (tokens.length === 0) return true;
  return tokens.every(t => FRENCH_FUNCTION_WORDS.has(t));
}

function extractResiduals(chunkText, hitMask, minLen = 3) {
  const residuals = [];
  let i = 0;
  while (i < chunkText.length) {
    if (!hitMask[i]) {
      let j = i;
      while (j < chunkText.length && !hitMask[j]) j++;
      const text = chunkText.slice(i, j).trim();
      if (text.length >= minLen && !isAllFunctionWords(text)) {
        residuals.push(text);
      }
      i = j;
    } else {
      i++;
    }
  }
  return residuals;
}

let residualCount = 0;
let residualChars = 0;
const allResidualTexts = [];

for (const entry of entries) {
  const chunkNouns = nounsByChunk.get(entry.chunkKey) || [];
  const hitMask = buildHitMask(entry.text, chunkNouns);
  const residuals = extractResiduals(entry.text, hitMask, 3);
  residualCount += residuals.length;
  for (const r of residuals) {
    residualChars += r.length;
    allResidualTexts.push(r);
  }
}

// ============ 5. 输出报告 ============
console.log('[5/5] 生成报告...\n');

const report = {
  experiment: 's0-spaCy评估',
  timestamp: new Date().toISOString(),
  source: path.basename(DOCUVERSE_PATH),
  stats: {
    totalChunks: entries.length,
    totalChars: totalChars,
    failedChunks: failedChunks,
    extractedNouns: allNouns.length,
    posDistribution: posDistribution,
    tagDistribution: tagDistribution,
    lengthDistribution: lengthDistribution,
  },
  coverage: {
    hitChars: hitChars,
    coverage: parseFloat(coverage),
    residualCount: residualCount,
    residualChars: residualChars,
    residualRatio: totalChars > 0 ? (residualChars / totalChars * 100).toFixed(2) : 0,
  },
  samples: {
    // 抽样：随机取 50 个名词
    nouns: allNouns.slice(0, 50).map(n => ({
      surface: n.surface,
      pos: n.pos,
      tag: n.tag,
      length: n.surface.length,
    })),
    // 随机取 20 个剩余文
    residuals: allResidualTexts.slice(0, 20),
  },
};

// 保存报告
const reportPath = path.join(EXPERIMENT_DIR, 's0-evaluation-report.json');
fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf-8');

// 打印摘要
console.log('='.repeat(60));
console.log('实验结果摘要');
console.log('='.repeat(60));
console.log(`\n【基本信息】`);
console.log(`  - 总 chunks: ${entries.length}`);
console.log(`  - 总字符数: ${totalChars.toLocaleString()}`);
console.log(`  - spaCy 抽取: ${allNouns.length} 个名词/短语`);

console.log(`\n【覆盖率】`);
console.log(`  - 命中字符: ${hitChars.toLocaleString()} / ${totalChars.toLocaleString()}`);
console.log(`  - 覆盖率: ${coverage}%`);
console.log(`  - 剩余文数量: ${residualCount}`);
console.log(`  - 剩余文字符: ${residualChars.toLocaleString()} (${report.coverage.residualRatio}%)`);

console.log(`\n【POS 分布】`);
const sortedPos = Object.entries(posDistribution).sort((a, b) => b[1] - a[1]);
for (const [pos, count] of sortedPos) {
  const pct = (count / allNouns.length * 100).toFixed(1);
  console.log(`  - ${pos}: ${count} (${pct}%)`);
}

console.log(`\n【词长分布】`);
for (const [range, count] of Object.entries(lengthDistribution)) {
  const pct = (count / allNouns.length * 100).toFixed(1);
  console.log(`  - ${range} 字符: ${count} (${pct}%)`);
}

console.log(`\n【样本名词（前20个）】`);
for (const noun of allNouns.slice(0, 20)) {
  console.log(`  - "${noun.surface}" [${noun.pos}/${noun.tag}]`);
}

console.log(`\n【样本剩余文（前10个）】`);
for (const text of allResidualTexts.slice(0, 10)) {
  console.log(`  - "${text}"`);
}

console.log(`\n【报告已保存】`);
console.log(`  ${reportPath}`);

console.log('\n' + '='.repeat(60));
console.log('实验完成');
console.log('='.repeat(60));
