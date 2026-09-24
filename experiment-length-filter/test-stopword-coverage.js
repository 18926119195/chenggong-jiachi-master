import fs from 'fs';

// 与 s1-llm-fill.js 中一致的规则3/4/停用词逻辑（简化摘录，用于验证覆盖率）
const STOPWORDS = [
  'le', 'la', 'les', 'un', 'une', 'des', 'du', 'de', 'et', 'ou', 'mais',
  'donc', 'or', 'ni', 'car', 'si', 'pour', 'par', 'avec', 'sans', 'sous',
  'sur', 'dans', 'en', 'à', 'au', 'aux', 'ce', 'cet', 'cette', 'ces',
  'son', 'sa', 'ses', 'mon', 'ma', 'mes', 'ton', 'ta', 'tes', 'notre',
  'nos', 'votre', 'vos', 'leur', 'leurs', 'il', 'elle', 'on', 'ils', 'elles',
  'je', 'tu', 'nous', 'vous', 'qui', 'que', 'quoi', 'dont', 'ou', 'y',
  'lui', 'se', 'ne', 'pas', 'plus', 'tout', 'tous', 'toute', 'toutes',
  'sont', 'est', 'ont', 'a', 'ete', 'avoir', 'etre', 'faire',
  'chez', 'vers', 'entre', 'depuis', 'pendant', 'apres', 'avant',
  'the', 'an', 'and', 'but', 'for', 'with', 'of', 'in', 'on', 'at', 'to', 'from',
  'deux', 'trois', 'quatre', 'vingt', 'six', 'sept', 'huit', 'meme', 'tel',
];

function norm(s) {
  return s.toLowerCase();
}

function shouldProcessResidual_noLenLimit(residualText) {
  const trimmed = residualText.trim();

  // 规则2: 纯标点或数字
  if (/^[\d\s\p{P}]+$/u.test(trimmed)) return false;

  // 规则3
  const firstWord = trimmed.split(/[\s,;:!?\.]+/)[0].toLowerCase();
  if (STOPWORDS.includes(firstWord)) {
    const tokens = trimmed.split(/[\s,;:!?\.]+/).map(t => t.toLowerCase()).filter(t => t.length >= 2);
    const hasValidToken = tokens.some(token => !STOPWORDS.includes(token) && !/^[\d\p{P}]+$/u.test(token));
    if (!hasValidToken) return false;
  }

  // 规则4
  const words = trimmed.split(/[\s,;:!?\.]+/).filter(w => w.length >= 2);
  if (words.length > 0) {
    const allStopwords = words.every(w => STOPWORDS.includes(w.toLowerCase()) || /^[\d\p{P}]+$/u.test(w));
    if (allStopwords) return false;
  }

  return true;
}

const data = JSON.parse(fs.readFileSync('C:\\Users\\Administrator\\Desktop\\2026-09-21-master\\experiment-length-filter\\newly-added.json', 'utf-8'));

let stillPass = 0;
let nowFiltered = 0;
const stillPassList = [];

for (const r of data) {
  if (shouldProcessResidual_noLenLimit(r.text)) {
    stillPass++;
    stillPassList.push(r.text);
  } else {
    nowFiltered++;
  }
}

console.log('原292条新增残文中：');
console.log('  停用词规则(3/4)+标点规则(2) 仍会通过:', stillPass);
console.log('  停用词规则(3/4)+标点规则(2) 会拦住:', nowFiltered);
console.log('\n仍会通过（未被停用词/标点规则拦住）的列表：');
stillPassList.forEach((t, i) => console.log(`  [${i + 1}] "${t}"`));

fs.writeFileSync(
  'C:\\Users\\Administrator\\Desktop\\2026-09-21-master\\experiment-length-filter\\still-pass-after-stopword-rules.json',
  JSON.stringify(stillPassList, null, 2),
);
