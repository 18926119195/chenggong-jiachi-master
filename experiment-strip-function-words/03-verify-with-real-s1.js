/**
 * 实验3：用真实 s1 数据交叉验证
 *
 * 目的：
 *   - s1-nouns-with-offsets.json 是真实的 LLM 输出经过 isValidNoun + 定位后的结果
 *   - 检查最终进入 s1 的 1560 个名词里有没有虚词漏网
 *   - 同时检查"如果源头剔虚词"是否会漏掉这些名词
 *
 * 注意：s1-nouns-with-offsets.json 已经是 isValidNoun 过滤后的，
 * 所以这里看到的虚词应该是 isValidNoun 漏网的（不应该有，但验证一下）。
 */

import fs from 'fs';

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

const s1 = JSON.parse(fs.readFileSync('C:\\Users\\Administrator\\Desktop\\2026-09-21-master\\s1-nouns-with-offsets.json', 'utf-8'));

console.log('========== 实验3：真实 s1 数据的虚词污染检查 ==========\n');
console.log(`s1 总名词数: ${s1.nouns.length}`);
console.log(`s1 总位置数: ${s1.meta.totalOffsets}`);
console.log(`LLM token 消耗: prompt=${s1.meta.tokenUsage.promptTokens} completion=${s1.meta.tokenUsage.completionTokens} total=${s1.meta.tokenUsage.totalTokens}`);
console.log(`耗时: ${s1.meta.elapsedSeconds}秒\n`);

// 检查每个名词的 surface 是否是虚词（应该没有，因为 isValidNoun 已经过滤过）
const suspects = [];
const lowerSet = new Set();
for (const n of s1.nouns) {
  const lower = n.surface.toLowerCase();
  lowerSet.add(lower);
  if (STOPWORDS.has(lower)) {
    suspects.push({ surface: n.surface, offsets: n.offsets.length });
  }
}

console.log(`--- 真实 s1 中漏网虚词检查 ---`);
if (suspects.length === 0) {
  console.log(`  ✓ isValidNoun 过滤有效，0 个虚词漏网进入 s1`);
} else {
  console.log(`  ⚠ 发现 ${suspects.length} 个虚词漏网：`);
  suspects.forEach((s, i) => console.log(`    [${i + 1}] "${s.surface}" (出现 ${s.offsets.length} 次)`));
}

// 检查表面看起来像"实词"但其实是边缘词的（如纯缩合形式、人称代词、连词等）
console.log(`\n--- s1 名词的 surface 长度分布 ---`);
const lengthDist = {};
for (const n of s1.nouns) {
  const len = n.surface.length;
  lengthDist[len] = (lengthDist[len] || 0) + 1;
}
console.log(`  ${Object.entries(lengthDist).sort((a, b) => parseInt(a[0]) - parseInt(b[0])).map(([k, v]) => `${k}字符:${v}`).join('  ')}`);

// 列出最短的 30 个名词，看是不是有边缘词
console.log(`\n--- 最短的 30 个名词 surface（看有没有虚词漏网）---`);
const sorted = [...s1.nouns].sort((a, b) => a.surface.length - b.surface.length || a.surface.localeCompare(b.surface));
sorted.slice(0, 30).forEach((n, i) => {
  const flag = STOPWORDS.has(n.surface.toLowerCase()) ? '⚠ 虚词' : '  ';
  console.log(`  [${i + 1}] ${flag} "${n.surface}" (id=${n.id}, ${n.offsets.length}次)`);
});

// 对比：如果源头剔虚词，会不会被剔掉这些 s1 里的真名词？
// （检查这些名词的 surface 是不是在 STOPWORDS 里或者缩合形式）
console.log(`\n--- "假设源头剔虚词"会丢掉的 s1 名词 ---`);
const wouldBeLost = [];
for (const n of s1.nouns) {
  // 检查这个词单独（不带前后虚词）是不是虚词
  if (STOPWORDS.has(n.surface.toLowerCase())) {
    wouldBeLost.push({ surface: n.surface, id: n.id, count: n.offsets.length });
  }
}
console.log(`  如果源头剔虚词，s1 会丢 ${wouldBeLost.length} 个名词`);
if (wouldBeLost.length > 0) {
  console.log(`  这些名词（按出现频次降序）:`);
  wouldBeLost.sort((a, b) => b.count - a.count).forEach((n, i) => {
    console.log(`    [${i + 1}] "${n.surface}" (id=${n.id}, ${n.count}次)`);
  });
}

// 节省计算：用真实 s1 数据反推"原方案"
const tokenSavings = s1.meta.tokenUsage;
console.log(`\n--- Token 节省估算（基于实验1的长度压缩）---`);
const cleaned = JSON.parse(fs.readFileSync('C:\\Users\\Administrator\\Desktop\\2026-09-21-master\\experiment-strip-function-words\\01-cleaned-residuals.json', 'utf-8'));
let totalOrigChars = 0, totalCleanedChars = 0;
for (const c of cleaned) {
  totalOrigChars += c.originalLength;
  totalCleanedChars += c.cleanedLength;
}
const compressRatio = totalCleanedChars / totalOrigChars;
const estPromptSavings = Math.round(tokenSavings.promptTokens * (1 - compressRatio) * 0.5); // 输入端只是残文部分，整体prompt还有别的内容
const estCompletionSavings = Math.round(tokenSavings.completionTokens * compressRatio);
console.log(`  残文总字符数: ${totalOrigChars} → ${totalCleanedChars}（压缩 ${(100 * (1 - compressRatio)).toFixed(1)}%）`);
console.log(`  估算 prompt token 节省（仅残文部分）: ~${estPromptSavings} tokens`);
console.log(`  估算 completion token 节省: ~${estCompletionSavings} tokens`);
console.log(`  （实际节省取决于LLM行为，剔除虚词后LLM输出可能更短）`);
