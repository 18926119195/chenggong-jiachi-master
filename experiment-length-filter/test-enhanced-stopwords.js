import fs from 'fs';

// 完整停用词列表（包含数词补充）
const STOPWORDS_ENHANCED = [
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
  // 常见带元音省略形式
  'd\'un', 'd\'une', 'd\'autres', 'd\'autre', 'qu\'', 'qu\'il', 'qu\'elle',
  'l\'autre', 'l\'un', 'l\'une', 'lui-même', 'elle-même', 'eux-mêmes',
  // 形容词性泛化词
  'possible', 'possibles', 'nécessaire', 'nécessaires',
  'etc', 'avant', 'après', 'depuis', 'pendant', 'durant',
  // 英语
  'of', 'the', 'a', 'an', 'and', 'or', 'to', 'in', 'on', 'at', 'by', 'for', 'with',
  'he', 'she', 'it', 'we', 'they', 'his', 'her', 'its', 'our', 'their',
  'is', 'are', 'was', 'were', 'be', 'been', 'have', 'has', 'had',
  // ========== 新增：法语数词和量词 ==========
  'zéro', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf', 'dix',
  'onze', 'douze', 'treize', 'quatorze', 'quinze', 'seize',
  'vingt', 'trente', 'quarante', 'cinquante', 'soixante',
  'cent', 'cents', 'mille', 'million', 'millions', 'milliard', 'milliards',
  'premier', 'première', 'premiers', 'premières',
  'second', 'seconde', 'seconds', 'secondes',
  'deuxième', 'troisième', 'quatrième', 'cinquième', 'sixième', 'septième', 'huitième', 'neuvième', 'dixième',
  'dernier', 'dernière', 'derniers', 'dernières',
  'aucun', 'aucune', 'plusieurs', 'nombreux', 'nombreuses',
  'peu', 'beaucoup', 'assez', 'trop', 'tant',
  'moitié', 'quart', 'tiers', 'double', 'triple',
];

function shouldProcessResidual_enhanced(residualText) {
  const trimmed = residualText.trim();

  // 规则2: 纯标点或数字
  if (/^[\d\s\p{P}]+$/u.test(trimmed)) return false;

  // 规则3
  const firstWord = trimmed.split(/[\s,;:!?\.]+/)[0].toLowerCase();
  if (STOPWORDS_ENHANCED.includes(firstWord)) {
    const tokens = trimmed.split(/[\s,;:!?\.]+/).map(t => t.toLowerCase()).filter(t => t.length >= 2);
    const hasValidToken = tokens.some(token => !STOPWORDS_ENHANCED.includes(token) && !/^[\d\p{P}]+$/u.test(token));
    if (!hasValidToken) return false;
  }

  // 规则4
  const words = trimmed.split(/[\s,;:!?\.]+/).filter(w => w.length >= 2);
  if (words.length > 0) {
    const allStopwords = words.every(w => STOPWORDS_ENHANCED.includes(w.toLowerCase()) || /^[\d\p{P}]+$/u.test(w));
    if (allStopwords) return false;
  }

  return true;
}

const data = JSON.parse(fs.readFileSync('C:\\Users\\Administrator\\Desktop\\2026-09-21-master\\experiment-length-filter\\newly-added.json', 'utf-8'));

let stillPass = 0;
let nowFiltered = 0;
const stillPassList = [];

for (const r of data) {
  if (shouldProcessResidual_enhanced(r.text)) {
    stillPass++;
    stillPassList.push(r.text);
  } else {
    nowFiltered++;
  }
}

console.log('========== 补充数词后的过滤效果 ==========');
console.log(`原292条新增残文中：`);
console.log(`  补充数词后仍会通过: ${stillPass} 条 (${(stillPass/292*100).toFixed(1)}%)`);
console.log(`  补充数词后被拦住: ${nowFiltered} 条 (${(nowFiltered/292*100).toFixed(1)}%)`);
console.log(`\n与原版对比：`);
console.log(`  原版通过: 250 条`);
console.log(`  补充数词后通过: ${stillPass} 条`);
console.log(`  额外拦截: ${250 - stillPass} 条\n`);

console.log('仍会通过的残文列表：');
stillPassList.forEach((t, i) => console.log(`  [${i + 1}] "${t}"`));

fs.writeFileSync(
  'C:\\Users\\Administrator\\Desktop\\2026-09-21-master\\experiment-length-filter\\still-pass-after-enhanced-stopwords.json',
  JSON.stringify(stillPassList, null, 2),
);
