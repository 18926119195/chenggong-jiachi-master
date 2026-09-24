const fs = require('fs');

const newData = JSON.parse(fs.readFileSync('C:/Users/Administrator/Desktop/2026-09-21-master/主流程数据集-2026-09-22/final-noun-index.json', 'utf8'));
const blacklist = JSON.parse(fs.readFileSync('C:/Users/Administrator/Desktop/2026-09-21-master/noun-blacklist.json', 'utf8'));

const surfaces = newData.nouns.map(n => n.surface);
console.log(`Total surfaces in new dataset: ${surfaces.length}`);

const blSet = new Set(blacklist.blacklist);
console.log(`Manual blacklist size: ${blSet.size}`);

const exactHits = surfaces.filter(s => blSet.has(s));
console.log(`\nExact manual-blacklist hits: ${exactHits.length}`);
if (exactHits.length > 0) {
  exactHits.slice(0, 20).forEach(h => console.log(`  - ${h}`));
  if (exactHits.length > 20) console.log(`  ... (${exactHits.length - 20} more)`);
}

// 模式检查：逗号/破折号前缀碎片
const leadingPunct = surfaces.filter(s => /^[,\-;]/.test(s));
console.log(`\nLeading punctuation fragments: ${leadingPunct.length}`);
if (leadingPunct.length > 0) {
  leadingPunct.slice(0, 15).forEach(h => console.log(`  - ${h}`));
  if (leadingPunct.length > 15) console.log(`  ... (${leadingPunct.length - 15} more)`);
}

// 模式检查：星号/井号 markdown 残留
const markdownArtifact = surfaces.filter(s => /[\*#]/.test(s));
console.log(`\nMarkdown artifact (*, #): ${markdownArtifact.length}`);
if (markdownArtifact.length > 0) {
  markdownArtifact.slice(0, 15).forEach(h => console.log(`  - ${h}`));
  if (markdownArtifact.length > 15) console.log(`  ... (${markdownArtifact.length - 15} more)`);
}

// 模式检查：CJK 混入
const cjkMixed = surfaces.filter(s => /[\u4e00-\u9fff]/.test(s));
console.log(`\nCJK mixed: ${cjkMixed.length}`);
if (cjkMixed.length > 0) {
  cjkMixed.forEach(h => console.log(`  - ${h}`));
}

// 常见法语虚词裸露（介词/冠词/连词）
const bareStopwords = ['selon', 'donc', 'ainsi', 'le', 'la', 'les', 'un', 'une', 'des', 'de', 'du', 'au', 'aux', 'car', 'mais', 'ou', 'et', 'ni'];
const stopwordHits = surfaces.filter(s => bareStopwords.includes(s.trim().toLowerCase()));
console.log(`\nBare French function words: ${stopwordHits.length}`);
if (stopwordHits.length > 0) {
  stopwordHits.forEach(h => console.log(`  - ${h}`));
}

console.log(`\n=== Summary ===`);
console.log(`Total nouns: ${surfaces.length}`);
console.log(`Manual blacklist hits: ${exactHits.length}`);
console.log(`Leading punct fragments: ${leadingPunct.length}`);
console.log(`Markdown artifacts: ${markdownArtifact.length}`);
console.log(`CJK mixed: ${cjkMixed.length}`);
console.log(`Bare stopwords: ${stopwordHits.length}`);
const totalIssues = exactHits.length + leadingPunct.length + markdownArtifact.length + cjkMixed.length + stopwordHits.length;
console.log(`Total potential stopword/noise issues: ${totalIssues} (${(totalIssues / surfaces.length * 100).toFixed(2)}%)`);
