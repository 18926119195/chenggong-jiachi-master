/**
 * 自动判断 non-high 截断是否有漏提取的名词
 * 
 * 判断规则：
 * 1. 截断里只有动词、形容词、副词、连接词、介词 → 无漏提取
 * 2. 截断里有名词，且名词已经被 LLM 标记出来了（即使是 low/medium）→ 无漏提取
 * 3. 截断里有名词，但 LLM 完全没标记出来 → 有漏提取
 */
import fs from 'fs';
import path from 'path';

const SNAPSHOT_DIR = 's1-snapshots-group2';
const DRIFT_ANALYSIS = JSON.parse(fs.readFileSync('s1-group2-drift-token-analysis.json', 'utf-8'));

const trueDriftBatchIds = DRIFT_ANALYSIS.results
  .filter(r => r.hasDrift && r.nounActuallyInTruncText === false)
  .map(r => r.batchId)
  .sort((a, b) => a - b);

// 法语常见非名词词（用于快速判断"截断里没有名词"）
const NON_NOUNS = new Set([
  'de', 'la', 'le', 'les', 'un', 'une', 'des', 'du', 'au', 'aux',
  'à', 'en', 'et', 'ou', 'mais', 'donc', 'car', 'ni', 'que', 'qui', 'quoi', 'dont', 'où',
  'ce', 'cet', 'cette', 'ces', 'son', 'sa', 'ses', 'mon', 'ma', 'mes', 'ton', 'ta', 'tes',
  'notre', 'nos', 'votre', 'vos', 'leur', 'leurs',
  'je', 'tu', 'il', 'elle', 'on', 'nous', 'vous', 'ils', 'elles',
  'me', 'te', 'se', 'lui', 'y', 'en',
  'est', 'sont', 'était', 'étaient', 'été', 'être', 'avoir', 'avait', 'avaient', 'eu',
  'fait', 'faire', 'faisant',
  'plus', 'moins', 'très', 'bien', 'mal', 'peu', 'beaucoup', 'trop', 'assez',
  'aussi', 'encore', 'déjà', 'toujours', 'jamais', 'peut-être',
  'si', 'comme', 'quand', 'lorsque', 'puisque', 'tandis',
  'sur', 'sous', 'dans', 'par', 'pour', 'avec', 'sans', 'vers', 'chez',
  'ne', 'pas', 'non', 'rien', 'personne', 'aucun', 'nul',
]);

const results = [];

for (const batchId of trueDriftBatchIds) {
  const batch = JSON.parse(fs.readFileSync(path.join(SNAPSHOT_DIR, `batch-${batchId}.json`), 'utf-8'));
  
  // 找出所有 non-high 条目
  for (const entry of batch.parsedNouns) {
    const nonHighOffsets = entry.offsets.filter(o => o.confidence !== 'high');
    if (nonHighOffsets.length === 0) continue;
    
    const trunc = batch.truncations.find(t => t.truncId === entry.truncId);
    if (!trunc) continue;
    
    const truncText = trunc.text;
    const nounInText = truncText.toLowerCase().includes(entry.noun.toLowerCase());
    
    // 分析截断文本
    const tokens = truncText
      .toLowerCase()
      .replace(/[.,;:!?()«»"""'']/g, ' ')
      .split(/\s+/)
      .filter(t => t.length > 0);
    
    // 判断是否只包含非名词词
    const hasOnlyNonNouns = tokens.every(t => NON_NOUNS.has(t) || t.length <= 1);
    
    // 判断逻辑
    let judgment = '';
    let hasMissing = false;
    let missingNouns = '';
    
    if (hasOnlyNonNouns) {
      // 截断里只有介词、冠词、连接词等
      judgment = '无漏提取：截断无名词';
    } else if (nounInText) {
      // LLM 标记的名词确实在截断里，说明 LLM 识别对了
      judgment = '无漏提取：LLM已标记该名词（虽然置信度非high，但名词本身在截断里）';
    } else {
      // LLM 标记的名词不在截断里，需要检查截断里是否有其他名词
      // 提取可能的名词（简单规则：长度 > 2 且不在非名词列表里）
      const potentialNouns = tokens.filter(t => t.length > 2 && !NON_NOUNS.has(t));
      
      if (potentialNouns.length === 0) {
        judgment = '无漏提取：LLM标记错误但截断无其他名词';
      } else {
        judgment = '需人工复核：LLM标记不在截断里，但截断含疑似名词';
        hasMissing = true;
        missingNouns = potentialNouns.join(', ');
      }
    }
    
    results.push({
      batchId,
      truncId: entry.truncId,
      llmNoun: entry.noun,
      confidence: nonHighOffsets[0].confidence,
      nounInText,
      truncText,
      judgment,
      hasMissing,
      potentialMissingNouns: missingNouns,
    });
  }
}

// 统计
const totalCount = results.length;
const noMissingCount = results.filter(r => !r.hasMissing).length;
const needReviewCount = results.filter(r => r.hasMissing).length;

console.log('=== 自动判断结果 ===');
console.log('总条目数:', totalCount);
console.log('无漏提取:', noMissingCount, `(${(noMissingCount/totalCount*100).toFixed(1)}%)`);
console.log('需人工复核:', needReviewCount, `(${(needReviewCount/totalCount*100).toFixed(1)}%)`);

// 输出需要复核的条目
const needReviewMd = `# 需人工复核的 Non-High 条目

**总计**: ${needReviewCount} 个需要复核的截断

---

${results.filter(r => r.hasMissing).map(r => `
## 批次 ${r.batchId} | 【【${r.truncId}】】

- **LLM 输出**: \`${r.llmNoun}\` (${r.confidence})
- **状态**: ${r.nounInText ? '✅ 名词在截断里' : '❌ 名词不在截断里'}
- **截断原文**: "${r.truncText}"
- **疑似遗漏的名词**: ${r.potentialMissingNouns}
- **判断**: ${r.judgment}

**人工确认**:
- [ ] 确认遗漏，需补提取
- [ ] 误判，实际无遗漏

---
`).join('\n')}
`;

fs.writeFileSync('s1-nonhigh-need-manual-review.md', needReviewMd, 'utf-8');
fs.writeFileSync('s1-nonhigh-auto-judgment.json', JSON.stringify({
  meta: {
    total: totalCount,
    noMissing: noMissingCount,
    needReview: needReviewCount,
  },
  results,
}, null, 2), 'utf-8');

console.log('\n已保存:');
console.log('- s1-nonhigh-need-manual-review.md (需人工复核的条目)');
console.log('- s1-nonhigh-auto-judgment.json (完整判断结果)');
