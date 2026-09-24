/**
 * 批量人工判断组 B1（301条：截断无high覆盖，LLM报的名词不在截断里）
 * 判断规则（基于对样本的人工审查总结）：
 * 1. 若截断文本本身只由虚词（介词/冠词/代词/助动词/连接词）+ 被切断的词尾/词头构成，
 *    没有独立完整的名词 -> 判定"无漏提取，LLM报的词是幻觉/编号错位"
 * 2. 若截断文本包含一个独立、完整、可识别的名词性成分（未被现有high或non-high覆盖）
 *    -> 判定"有漏提取"，记录该名词
 * 3. 输出统计，按批次汇总，供人工复核有漏提取的条目
 */
import fs from 'fs';

const data = JSON.parse(fs.readFileSync('s1-nonhigh-judged-final.json', 'utf-8'));
const groupB1 = data.groupB1_likelyMissedNoun_needRerun;

// 法语虚词表（限定词、代词、介词、连接词、助动词形式、常见副词）
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
  // 去掉标点，分词
  const cleaned = text.replace(/[.,;:!?()«»""''\u2026\-]/g, ' ').trim();
  const words = cleaned.split(/\s+/).filter(w => w.length > 0);
  if (words.length === 0) return true;
  // 检查是否所有词都是虚词，或者是被截断的词头/词尾（长度<=2 且不在虚词表也算残片）
  return words.every(w => {
    const lw = w.toLowerCase();
    if (FUNCTION_WORDS.has(lw)) return true;
    // 单字母残片（如 l' 被拆开）
    if (w.length <= 1) return true;
    return false;
  });
}

const results = [];
for (const entry of groupB1) {
  const isFuncOnly = isFunctionWordOnly(entry.truncText);
  results.push({
    ...entry,
    autoJudgment: isFuncOnly ? '无漏提取（截断仅含虚词/残片，LLM报词为幻觉）' : '⚠️需人工看：截断含疑似实质词',
    isFuncOnly,
  });
}

const noAction = results.filter(r => r.isFuncOnly);
const needManualLook = results.filter(r => !r.isFuncOnly);

console.log('=== 组 B1 批量判断结果 ===');
console.log('总数:', results.length);
console.log('无漏提取（虚词残片）:', noAction.length);
console.log('需人工细看（含疑似实质词）:', needManualLook.length);

fs.writeFileSync('s1-groupB1-need-manual-look.json', JSON.stringify(needManualLook, null, 2), 'utf-8');
fs.writeFileSync('s1-groupB1-full-result.json', JSON.stringify(results, null, 2), 'utf-8');

console.log('\n已保存: s1-groupB1-need-manual-look.json (需人工细看的条目)');
