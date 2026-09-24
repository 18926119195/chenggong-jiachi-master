/**
 * 实验1：残文剔除虚词后的文本对比
 *
 * 目的：
 *   - 验证剔除虚词后的残文是否还包含可识别的实词
 *   - 对比"原残文" vs "剔除虚词后残文"的文本长度分布
 *   - 检查剔除后的残文是否还有"全是虚词"的情况
 *
 * 不调用LLM，只做文本处理层的对比。
 * 不修改任何主流程代码，纯本地分析。
 */

import fs from 'fs';

// 复用 s1-llm-fill.js 的 STOPWORDS 列表（实验期间从该文件复制，避免引入主流程依赖）
const STOPWORDS = new Set([
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
  'cela', 'ceci', 'ça', 'rien', 'personne', 'quelque', 'quelques', "quelqu'un",
  'chaque', 'chacun', 'chacune', 'certains', 'certaines', 'certain', 'certaine',
  'autre', 'autres', 'tel', 'telle', 'tels', 'telles', 'seul', 'seule', 'seuls', 'seules',
  // 常见带元音省略形式（d'un、d'une、qu'、l'、n' 等缩合）
  "d'un", "d'une", "d'autres", "d'autre", "qu'", "qu'il", "qu'elle",
  "l'autre", "l'un", "l'une", 'lui-même', 'elle-même', 'eux-mêmes',
  // 形容词性泛化词（过于宽泛，非具体名词）
  'possible', 'possibles', 'nécessaire', 'nécessaires', 'seconde', 'second',
  'etc', 'avant', 'après', 'depuis', 'pendant', 'durant',
  // 英语
  'of', 'the', 'a', 'an', 'and', 'or', 'to', 'in', 'on', 'at', 'by', 'for', 'with',
  'he', 'she', 'it', 'we', 'they', 'his', 'her', 'its', 'our', 'their',
  'is', 'are', 'was', 'were', 'be', 'been', 'have', 'has', 'had',
]);

// 工具：从词里剥掉标点后判断是不是停用词
function isFunctionWord(token) {
  // 去掉前后的标点
  const stripped = token.replace(/^[\p{P}\s]+|[\p{P}\s]+$/gu, '').toLowerCase();
  if (stripped.length === 0) return false;
  return STOPWORDS.has(stripped);
}

// 核心：剔除残文中的虚词
function stripFunctionWords(text) {
  // 按词边界拆分（保留分隔符：空格、标点）
  const tokens = text.split(/(\s+|[,;:!?\.\(\)\[\]"«»'"])/);
  const kept = [];
  for (const tok of tokens) {
    if (/^\s+$/.test(tok)) {
      // 空白单独保留，但要去重相邻空白
      if (kept.length > 0 && !/^\s+$/.test(kept[kept.length - 1])) {
        kept.push(' ');
      }
    } else if (/^[,;:!?\.\(\)\[\]"«»'"]+$/.test(tok)) {
      // 标点：保留（用于词边界提示，但不主动加），因为剔除虚词后空格可能就足够了
      continue;
    } else if (isFunctionWord(tok)) {
      continue;
    } else if (tok.length > 0) {
      kept.push(tok);
    }
  }
  // 合并并清理多余空白
  return kept.join('').replace(/\s+/g, ' ').trim();
}

// 读取 s0-quality-report 里的残文（顶层 residuals 数组）
const report = JSON.parse(fs.readFileSync('C:\\Users\\Administrator\\Desktop\\2026-09-21-master\\s0-quality-report.json', 'utf-8'));

console.log('========== 实验1：残文剔除虚词后的文本分析 ==========\n');

const residuals = (report.residuals || []).map(r => ({
  text: r.text,
  chunkKey: r.chunkKey,
  start: r.start,
  end: r.end,
}));

console.log(`s0-quality-report 总残文数: ${residuals.length}`);

// 模拟现有规则：先应用 shouldProcessResidual 的判断（仅判断是否值得处理）
function shouldProcessResidual_current(text) {
  const trimmed = text.trim();
  if (trimmed.length < 8) return false;
  if (/^[\d\s\p{P}]+$/u.test(trimmed)) return false;
  const firstWord = trimmed.split(/[\s,;:!?\.]+/)[0].toLowerCase();
  if (STOPWORDS.has(firstWord)) {
    const tokens = trimmed.split(/[\s,;:!?\.]+/).map(t => t.toLowerCase()).filter(t => t.length >= 2);
    const hasValidToken = tokens.some(token => !STOPWORDS.has(token) && !/^[\d\p{P}]+$/u.test(token));
    if (!hasValidToken) return false;
  }
  const words = trimmed.split(/[\s,;:!?\.]+/).filter(w => w.length >= 2);
  if (words.length > 0) {
    const allStopwords = words.every(w => STOPWORDS.has(w.toLowerCase()) || /^[\d\p{P}]+$/u.test(w));
    if (allStopwords) return false;
  }
  return true;
}

const currentPassed = residuals.filter(r => shouldProcessResidual_current(r.text));
console.log(`当前规则通过（会送给LLM）: ${currentPassed.length}\n`);

// 对这些通过当前规则的残文，做剔除虚词处理
const cleaned = currentPassed.map(r => ({
  original: r.text,
  cleaned: stripFunctionWords(r.text),
  originalLength: r.text.length,
  cleanedLength: stripFunctionWords(r.text).length,
}));

// 分析剔除后的文本特征
const lengthDistribution = { lt4: 0, lt6: 0, lt8: 0, lt10: 0, gte10: 0, empty: 0 };
const tooShortExamples = [];
for (const c of cleaned) {
  if (c.cleanedLength === 0) lengthDistribution.empty++;
  else if (c.cleanedLength < 4) {
    lengthDistribution.lt4++;
    if (tooShortExamples.length < 30) tooShortExamples.push(c);
  }
  else if (c.cleanedLength < 6) lengthDistribution.lt6++;
  else if (c.cleanedLength < 8) lengthDistribution.lt8++;
  else if (c.cleanedLength < 10) lengthDistribution.lt10++;
  else lengthDistribution.gte10++;
}

console.log('--- 剔除虚词后长度分布 ---');
console.log(`  完全空: ${lengthDistribution.empty}`);
console.log(`  <4 字符: ${lengthDistribution.lt4}`);
console.log(`  <6 字符: ${lengthDistribution.lt6}`);
console.log(`  <8 字符: ${lengthDistribution.lt8}`);
console.log(`  <10 字符: ${lengthDistribution.lt10}`);
console.log(`  ≥10 字符: ${lengthDistribution.gte10}\n`);

console.log('--- 剔除后 < 4 字符的样例（前30个）---');
tooShortExamples.slice(0, 30).forEach((c, i) => {
  console.log(`  [${i + 1}] "${c.original}"  →  "${c.cleaned}" (${c.cleanedLength}字符)`);
});

console.log('\n--- 剔除后 ≥10 字符的样例（前20个，证明剔除后仍有可识别内容）---');
cleaned.filter(c => c.cleanedLength >= 10).slice(0, 20).forEach((c, i) => {
  console.log(`  [${i + 1}] "${c.original}"  →  "${c.cleaned}"`);
});

// 保存剔除后的数据，给后续实验用
fs.writeFileSync(
  'C:\\Users\\Administrator\\Desktop\\2026-09-21-master\\experiment-strip-function-words\\01-cleaned-residuals.json',
  JSON.stringify(cleaned, null, 2),
);

console.log(`\n✓ 实验1结果已保存到 experiment-strip-function-words/01-cleaned-residuals.json`);
