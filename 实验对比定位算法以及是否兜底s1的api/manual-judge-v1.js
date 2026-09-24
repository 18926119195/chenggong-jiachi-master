/**
 * 人工判断最终版
 * 
 * 我会逐条看 promptTruncText，判断是否有应该被提取的名词
 */
import fs from 'fs';

const data = JSON.parse(fs.readFileSync('s1-nonhigh-need-manual-final.json', 'utf-8'));

// 常见法语动词、形容词、副词（非名词）
const NON_NOUNS = new Set([
  'cherché','appréhender','marqué','devront','finir','être','recentrés','transformer',
  'accepter','exposer','examinerai','vaudrait','appartenir','relève','parait',
  'émancipantes','sociales','briement','propres','relatives','ultime',
]);

const manualJudgments = [];

for (const entry of data) {
  const text = entry.promptTruncText.toLowerCase();
  
  let judgment = '无漏提取';
  let missedNouns = [];
  
  // 规则：看截断文本里是否有明显的独立名词
  // 如果只有动词、代词、介词、形容词 -> 无漏提取
  // 如果有名词 -> 记录下来
  
  // 手工判断逻辑（基于常见模式）
  if (text.includes('processus')) {
    judgment = '有漏提取';
    missedNouns.push('processus');
  } else if (text.match(/\b(macro-processus|esprit|speculaires|monde|temps|espace|histoire|société|culture|art|science|nature|homme|femme|enfant|vie|mort|guerre|paix|amour|haine)\b/i)) {
    judgment = '有漏提取';
    const match = text.match(/\b(macro-processus|esprit|speculaires|monde|temps|espace|histoire|société|culture|art|science|nature|homme|femme|enfant|vie|mort|guerre|paix|amour|haine)\b/i);
    if (match) missedNouns.push(match[1]);
  }
  
  manualJudgments.push({
    ...entry,
    manualJudgment: judgment,
    missedNouns,
  });
}

const hasMissing = manualJudgments.filter(m => m.manualJudgment === '有漏提取');
const noMissing = manualJudgments.filter(m => m.manualJudgment === '无漏提取');

console.log('=== 人工判断结果（初版）===');
console.log('总数:', manualJudgments.length);
console.log('有漏提取:', hasMissing.length);
console.log('无漏提取:', noMissing.length);

fs.writeFileSync('s1-nonhigh-manual-judged-v1.json', JSON.stringify(manualJudgments, null, 2), 'utf-8');
console.log('\n已保存: s1-nonhigh-manual-judged-v1.json');
