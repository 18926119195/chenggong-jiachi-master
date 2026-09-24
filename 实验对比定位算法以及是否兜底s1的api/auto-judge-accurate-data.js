/**
 * 自动判断 s1-nonhigh-accurate-data.json 里的条目
 * 
 * 判断规则：
 * 1. 如果 prompt 输入截断只含虚词/残片 -> 无漏提取
 * 2. 如果截断含有独立完整的名词性成分 -> 标记为需人工确认
 */
import fs from 'fs';

const data = JSON.parse(fs.readFileSync('s1-nonhigh-accurate-data.json', 'utf-8'));

// 法语虚词表
const FUNCTION_WORDS = new Set([
  'de','du','des','la','le','les','l','un','une','et','ou','à','au','aux','en','dans','sur','sous',
  'que','qui','quoi','dont','ou','par','pour','avec','sans','vers','chez','entre','contre',
  'ce','cette','ces','cet','son','sa','ses','leur','leurs','notre','nos','votre','vos','mon','ma','mes',
  'il','elle','ils','elles','on','nous','vous','je','tu','y','se','s','n','ne','pas','plus','moins',
  'être','avoir','été','étant','ayant','est','sont','était','étaient','a','ont','avait','avaient',
  'tout','toute','tous','toutes','même','mêmes','autre','autres','certains','certaines',
  'qu','d','à l','de l','de la','de ce','dans le','dans la','sur le','sur la',
  'ainsi','alors','donc','mais','or','ni','car','si','comme','lorsque','quand',
  'très','bien','encore','déjà','toujours','jamais','aussi','peut','peu',
]);

function isFunctionWordOnly(text) {
  const cleaned = text.replace(/[.,;:!?()«»""''\u2026\-*]/g, ' ').trim();
  const words = cleaned.split(/\s+/).filter(w => w.length > 0);
  if (words.length === 0) return true;
  
  return words.every(w => {
    const lw = w.toLowerCase();
    if (FUNCTION_WORDS.has(lw)) return true;
    if (w.length <= 1) return true; // 单字母残片
    return false;
  });
}

const results = data.map(entry => {
  const isFuncOnly = isFunctionWordOnly(entry.promptTruncText);
  return {
    ...entry,
    autoJudgment: isFuncOnly ? '无漏提取（虚词/残片）' : '⚠️需人工看',
    isFuncOnly,
  };
});

const noMissing = results.filter(r => r.isFuncOnly);
const needManual = results.filter(r => !r.isFuncOnly);

console.log('=== 自动判断结果 ===');
console.log('总数:', results.length);
console.log('无漏提取（虚词/残片）:', noMissing.length);
console.log('需人工确认（含疑似实质词）:', needManual.length);

// 按批次统计
const byBatch = {};
for (const r of needManual) {
  if (!byBatch[r.batchId]) byBatch[r.batchId] = [];
  byBatch[r.batchId].push(r);
}

console.log('\n需人工确认的条目分布（按批次）:');
for (const [batchId, entries] of Object.entries(byBatch).sort((a, b) => parseInt(a[0]) - parseInt(b[0]))) {
  console.log(`批次 ${batchId}: ${entries.length} 条`);
}

fs.writeFileSync('s1-nonhigh-accurate-judged.json', JSON.stringify(results, null, 2), 'utf-8');
fs.writeFileSync('s1-nonhigh-need-manual-final.json', JSON.stringify(needManual, null, 2), 'utf-8');

console.log('\n已保存:');
console.log('- s1-nonhigh-accurate-judged.json (全部结果)');
console.log('- s1-nonhigh-need-manual-final.json (需人工确认)');
