/**
 * 实验2：模拟 LLM 在两种方案下的产出对比
 *
 * 目的：
 *   - 对比"原方案"和"剔除虚词方案"的理论输出差异
 *   - 不真跑 LLM（成本太高），改用启发式规则模拟：
 *       * 模拟 LLM = "从残文里提取所有非标点 token"
 *       * 原方案后处理 = 剔除纯虚词 + 剔除纯停用词
 *       * 新方案后处理 = 不需要再做虚词过滤（源头已剔）
 *
 * 这只是文本层的粗略模拟，用于快速验证"剔除虚词方案"的潜在优势。
 * 真实 LLM 输出会有差异，但能看出大致方向。
 */

import fs from 'fs';

// 复用 s1-llm-fill.js 的 STOPWORDS 列表（实验期间从该文件复制，避免引入主流程依赖）
const STOPWORDS = new Set([
  'ou', 'et', 'de', 'des', 'le', 'la', 'les', 'un', 'une', 'du', 'au', 'aux',
  'qui', 'que', 'quoi', 'dont', 'où', 'quel', 'quelle', 'quels', 'quelles',
  'je', 'tu', 'il', 'elle', 'nous', 'vous', 'ils', 'elles', 'on',
  'me', 'te', 'se', 'lui', 'leur', 'leurs', 'moi', 'toi',
  'ce', 'cette', 'ces', 'cet', 'celui', 'celle', 'ceux', 'celles',
  'mon', 'ma', 'mes', 'ton', 'ta', 'tes', 'son', 'sa', 'ses',
  'notre', 'nos', 'votre', 'vos',
  'par', 'pour', 'dans', 'avec', 'sans', 'sous', 'sur', 'chez', 'vers', 'entre',
  'plus', 'moins', 'bien', 'mal', 'tout', 'très', 'pas', 'non', 'même', 'aussi',
  'encore', 'déjà', 'toujours', 'jamais', 'ici', 'là',
  'est', 'sont', 'être', 'avoir', 'a', 'ont', 'fait', 'font', 'dit', 'disent',
  'peut', 'peuvent', 'doit', 'doivent', 'va', 'vont', 'était', 'étaient',
  'mais', 'donc', 'or', 'ni', 'car', 'ainsi', 'alors', 'comme', 'puis',
  'cependant', 'pourtant', 'néanmoins', 'toutefois', 'lorsque', 'quand',
  'si', 'comment', 'pourquoi', 'partir',
  'cela', 'ceci', 'ça', 'rien', 'personne', 'quelque', 'quelques', "quelqu'un",
  'chaque', 'chacun', 'chacune', 'certains', 'certaines', 'certain', 'certaine',
  'autre', 'autres', 'tel', 'telle', 'tels', 'telles', 'seul', 'seule', 'seuls', 'seules',
  "d'un", "d'une", "d'autres", "d'autre", "qu'", "qu'il", "qu'elle",
  "l'autre", "l'un", "l'une", 'lui-même', 'elle-même', 'eux-mêmes',
  'possible', 'possibles', 'nécessaire', 'nécessaires', 'seconde', 'second',
  'etc', 'avant', 'après', 'depuis', 'pendant', 'durant',
  'of', 'the', 'a', 'an', 'and', 'or', 'to', 'in', 'on', 'at', 'by', 'for', 'with',
  'he', 'she', 'it', 'we', 'they', 'his', 'her', 'its', 'our', 'their',
  'is', 'are', 'was', 'were', 'be', 'been', 'have', 'has', 'had',
]);

// 工具
function isFunctionWord(token) {
  const stripped = token.replace(/^[\p{P}\s]+|[\p{P}\s]+$/gu, '').toLowerCase();
  if (stripped.length === 0) return false;
  return STOPWORDS.has(stripped);
}

function stripFunctionWords(text) {
  const tokens = text.split(/(\s+|[,;:!?\.\(\)\[\]"«»'"])/);
  const kept = [];
  for (const tok of tokens) {
    if (/^\s+$/.test(tok)) {
      if (kept.length > 0 && !/^\s+$/.test(kept[kept.length - 1])) kept.push(' ');
    } else if (/^[,;:!?\.\(\)\[\]"«»'"]+$/.test(tok)) {
      continue;
    } else if (isFunctionWord(tok)) {
      continue;
    } else if (tok.length > 0) {
      kept.push(tok);
    }
  }
  return kept.join('').replace(/\s+/g, ' ').trim();
}

// 模拟 LLM：从文本里提取"所有可能是名词的 token"
// （粗略规则：长度 ≥3 且不是纯数字/纯标点）
function simulateLLMExtract(text) {
  const tokens = text.split(/[\s,;:!?\.\(\)\[\]"«»]+/).filter(t => t.length > 0);
  const nouns = [];
  for (const tok of tokens) {
    const clean = tok.replace(/[^\w\u00C0-\u017F-]/g, '');
    if (clean.length < 3) continue;
    if (/^\d+$/.test(clean)) continue;
    nouns.push(clean);
  }
  return nouns;
}

// 读取清理后的残文数据
const cleaned = JSON.parse(fs.readFileSync('C:\\Users\\Administrator\\Desktop\\2026-09-21-master\\experiment-strip-function-words\\01-cleaned-residuals.json', 'utf-8'));

console.log('========== 实验2：两种方案的模拟产出对比 ==========\n');
console.log(`参与对比的残文数: ${cleaned.length}\n`);

const stats = {
  // 原方案：原残文送LLM，模拟LLM可能提取（含虚词），再走 isValidNoun
  originalExtracted: 0,
  originalRejectedByStopword: 0,
  originalFinalNouns: new Set(),
  originalStopwordSet: new Set(), // 统计被拦截掉的虚词种类

  // 新方案：剔虚词的残文送LLM，模拟LLM只提取实词
  cleanedExtracted: 0,
  cleanedFinalNouns: new Set(),
};

for (const c of cleaned) {
  // === 原方案 ===
  const origExtracted = simulateLLMExtract(c.original);
  stats.originalExtracted += origExtracted.length;
  for (const n of origExtracted) {
    if (STOPWORDS.has(n.toLowerCase())) {
      stats.originalRejectedByStopword++;
      stats.originalStopwordSet.add(n.toLowerCase());
    } else {
      stats.originalFinalNouns.add(n.toLowerCase());
    }
  }

  // === 新方案 ===
  const cleanedText = c.cleaned;
  if (cleanedText.length === 0) continue; // 剔除后空了，跳过
  const newExtracted = simulateLLMExtract(cleanedText);
  stats.cleanedExtracted += newExtracted.length;
  for (const n of newExtracted) {
    stats.cleanedFinalNouns.add(n.toLowerCase());
  }
}

console.log('--- 原方案（不剔虚词）---');
console.log(`  LLM 模拟提取总数: ${stats.originalExtracted}`);
console.log(`  其中被 isValidNoun 拦截的虚词: ${stats.originalRejectedByStopword}`);
console.log(`  拦截掉的不同虚词数: ${stats.originalStopwordSet.size}`);
console.log(`  最终输出唯一名词数: ${stats.originalFinalNouns.size}`);
console.log(`  前20个被拦截的虚词示例:`);
[...stats.originalStopwordSet].slice(0, 20).forEach((w, i) => console.log(`    [${i + 1}] "${w}"`));

console.log('\n--- 新方案（剔除虚词后送LLM）---');
console.log(`  LLM 模拟提取总数: ${stats.cleanedExtracted}`);
console.log(`  最终输出唯一名词数: ${stats.cleanedFinalNouns.size}`);
console.log(`  无需 isValidNoun 过滤: 0 个虚词污染（因为源头已剔）`);

console.log('\n--- 关键差异 ---');
console.log(`  原方案需要 isValidNoun 拦截: ${stats.originalRejectedByStopword} 次虚词`);
console.log(`  新方案需要 isValidNoun 拦截: 0 次（源头杜绝）`);
const lostInNew = [...stats.originalFinalNouns].filter(n => !stats.cleanedFinalNouns.has(n));
const gainedInNew = [...stats.cleanedFinalNouns].filter(n => !stats.originalFinalNouns.has(n));
console.log(`  原方案独有、新方案缺失的"名词": ${lostInNew.length} 个`);
console.log(`  新方案独有、原方案缺失的"名词": ${gainedInNew.length} 个`);

if (lostInNew.length > 0) {
  console.log(`  原方案独有的前20个（看是不是真名词还是漏网的虚词/边缘词）:`);
  lostInNew.slice(0, 20).forEach((w, i) => console.log(`    [${i + 1}] "${w}"`));
}

if (gainedInNew.length > 0) {
  console.log(`  新方案独有的前20个:`);
  gainedInNew.slice(0, 20).forEach((w, i) => console.log(`    [${i + 1}] "${w}"`));
}

// 持久化
fs.writeFileSync(
  'C:\\Users\\Administrator\\Desktop\\2026-09-21-master\\experiment-strip-function-words\\02-comparison-stats.json',
  JSON.stringify({
    originalExtracted: stats.originalExtracted,
    originalRejectedByStopword: stats.originalRejectedByStopword,
    originalStopwordSet: [...stats.originalStopwordSet],
    originalFinalNouns: [...stats.originalFinalNouns],
    cleanedExtracted: stats.cleanedExtracted,
    cleanedFinalNouns: [...stats.cleanedFinalNouns],
    lostInNew,
    gainedInNew,
  }, null, 2),
);

console.log(`\n✓ 实验2结果已保存到 experiment-strip-function-words/02-comparison-stats.json`);
