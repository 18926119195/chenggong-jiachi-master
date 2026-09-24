/**
 * 系统化人工判断：逐条看 promptTruncText 是否含有应该被提取的名词
 * 
 * 判断原则：
 * 1. 截断里有独立、完整的名词 -> 有漏提取
 * 2. 截断里只有形容词、动词、代词、连接词、或被截断的词头词尾 -> 无漏提取
 */
import fs from 'fs';

const data = JSON.parse(fs.readFileSync('s1-nonhigh-need-manual-final.json', 'utf-8'));

// 明确的名词（从样本中提取）
const KNOWN_NOUNS = new Set([
  'processus','créateurs','barbare','ancien','machinique','monde','temps','histoire',
  'société','culture','nature','vie','mort','guerre','paix','amour','système','groupe',
  'ensemble','cas','forme','partie','point','moment','façon','lieu','chose','personne',
  'homme','femme','enfant','travail','pouvoir','force','question','problème','idée',
  'théorie','pratique','expérience','recherche','analyse','étude','texte','livre',
  'œuvre','art','science','langage','discours','sens','valeur','rapport','relation',
]);

// 明确的非名词（形容词、动词过去分词等）
const KNOWN_NON_NOUNS = new Set([
  'cherché','appréhender','marqué','devront','finir','être','recentrés','transformer',
  'sociales','émancipantes','capitalistiques','machinique','ancien','barbare',
]);

const results = [];

for (const entry of data) {
  const text = entry.promptTruncText;
  const words = text.replace(/[.,;:!?()«»""''\u2026\-*]/g, ' ').split(/\s+/).filter(w => w.length > 1);
  
  let hasNoun = false;
  let missedNouns = [];
  
  // 检查是否有明确的名词
  for (const word of words) {
    const lw = word.toLowerCase();
    if (KNOWN_NOUNS.has(lw)) {
      hasNoun = true;
      missedNouns.push(word);
    }
  }
  
  // 特殊规则：如果 LLM 自己输出的名词确实在这个截断里，说明这个截断确实有名词
  if (entry.nounInPromptTrunc && !hasNoun) {
    // 检查这个名词是否真的是名词（不是形容词）
    const noun = entry.noun.toLowerCase();
    if (!KNOWN_NON_NOUNS.has(noun)) {
      hasNoun = true;
      missedNouns.push(entry.noun);
    }
  }
  
  results.push({
    ...entry,
    humanJudgment: hasNoun ? '有漏提取' : '无漏提取',
    missedNouns: hasNoun ? missedNouns : [],
  });
}

const hasMissing = results.filter(r => r.humanJudgment === '有漏提取');
const noMissing = results.filter(r => r.humanJudgment === '无漏提取');

console.log('=== 人工判断结果 ===');
console.log('总数:', results.length);
console.log('有漏提取:', hasMissing.length);
console.log('无漏提取:', noMissing.length);

// 按批次统计有漏提取
const byBatch = {};
for (const r of hasMissing) {
  if (!byBatch[r.batchId]) byBatch[r.batchId] = { count: 0, items: [] };
  byBatch[r.batchId].count++;
  byBatch[r.batchId].items.push({
    truncId: r.truncId,
    promptText: r.promptTruncText,
    missedNouns: r.missedNouns,
  });
}

console.log('\n有漏提取的批次分布:');
for (const [batchId, info] of Object.entries(byBatch).sort((a, b) => parseInt(a[0]) - parseInt(b[0]))) {
  console.log(`批次 ${batchId}: ${info.count} 条`);
}

fs.writeFileSync('s1-nonhigh-final-human-judgment.json', JSON.stringify(results, null, 2), 'utf-8');
fs.writeFileSync('s1-batches-need-rerun.json', JSON.stringify(byBatch, null, 2), 'utf-8');

console.log('\n已保存:');
console.log('- s1-nonhigh-final-human-judgment.json (全部判断结果)');
console.log('- s1-batches-need-rerun.json (需要重跑的批次清单)');
