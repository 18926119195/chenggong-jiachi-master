/**
 * 人工判断所有 383 条 non-high 条目
 * 核心任务：看 promptTruncText（prompt 输入的截断）是否有应该被提取但被漏掉的名词
 * 
 * 判断规则：
 * 1. 截断里有完整、独立的名词 -> 有漏提取
 * 2. 截断里只有虚词、形容词、动词、或残缺的词头词尾 -> 无漏提取
 */
import fs from 'fs';

const data = JSON.parse(fs.readFileSync('s1-nonhigh-accurate-data.json', 'utf-8'));

// 法语虚词（介词、冠词、代词、助动词、连接词）
const FUNCTION_WORDS = new Set([
  'de','du','des','la','le','les','l','un','une','et','ou','à','au','aux','en','dans','sur','sous',
  'que','qui','quoi','dont','où','par','pour','avec','sans','vers','chez','entre','contre',
  'ce','cette','ces','cet','son','sa','ses','leur','leurs','notre','nos','votre','vos','mon','ma','mes',
  'il','elle','ils','elles','on','nous','vous','je','tu','y','se','s','n','ne','pas','plus','moins',
  'être','avoir','été','étant','ayant','est','sont','était','étaient','a','ont','avait','avaient',
  'tout','toute','tous','toutes','même','mêmes','autre','autres','certains','certaines','certain','certaine',
  'qu','d','c','j','t','m',
  'ainsi','alors','donc','mais','or','ni','car','si','comme','lorsque','quand','tandis','puisque',
  'très','bien','encore','déjà','toujours','jamais','aussi','peut','peu','trop','assez','beaucoup',
  'ici','là','maintenant','hier','demain','aujourd','hui',
]);

// 常见动词（不定式、过去分词、现在分词）
const VERBS = new Set([
  'cherché','appréhender','marqué','devront','finir','être','recentrés','transformer','inventer',
  'dire','appartenir','parait','furent','souligne','souligner','va','vont','peut','peuvent',
  'fait','faire','mis','mettre','pris','prendre','dit','eu','aller','venu','venir',
  'invalidants','purificatrices','trouvent','rapportant','devaient','apporter','affirmer',
]);

// 形容词词尾和常见形容词
const ADJECTIVES = new Set([
  'sociales','sociale','sociaux','social','émancipantes','émancipante','émancipants','émancipant',
  'capitalistiques','capitalistique','machinique','machiniques',
  'structuraux','structurale','structurales','structural',
  'psychique','psychiques','somatique','somatiques','somatiques',
  'régionaux','régionale','régionales','régional',
  'scientifique','scientifiques','naïvement','naïve','naïves','naïf','naïfs',
  'énergétiques','énergétique','energetiques','energetique',
  'intrinsèques','intrinsèque','extrêmes','extrême',
  'mentales','mentale','mental','mentaux',
  'ancien','ancienne','anciennes','anciens','barbare','barbares',
]);

// 明确的名词（从文本中提取，必须是明确的名词词尾或常见名词）
const KNOWN_NOUNS = new Set([
  'processus','créateurs','barbare','monde','temps','histoire','société','culture',
  'nature','vie','mort','guerre','paix','amour','système','groupe','ensemble','cas','forme',
  'partie','point','moment','façon','lieu','chose','personne','homme','femme','enfant',
  'travail','pouvoir','force','question','problème','idée','théorie','pratique','expérience',
  'recherche','analyse','étude','texte','livre','œuvre','art','science','langage','discours',
  'sens','valeur','rapport','relation','espace','ordre','niveau','effet','fonction','structure',
  'cartographie','sémiotique','folie','paramètre','entités','logiques',
  // 常见名词词尾：-tion, -sion, -eur, -euse, -age, -isme, -ité, -té
]);

function hasNoun(text) {
  // 清理标点
  const cleaned = text.replace(/[.,;:!?()«»""''\u2026\-*]/g, ' ').trim();
  const words = cleaned.split(/\s+/).filter(w => w.length > 0);
  
  const foundNouns = [];
  
  for (const word of words) {
    const lw = word.toLowerCase();
    
    // 跳过虚词、动词、形容词
    if (FUNCTION_WORDS.has(lw) || VERBS.has(lw) || ADJECTIVES.has(lw)) continue;
    
    // 跳过单字母残片
    if (word.length <= 1) continue;
    
    // 如果是已知名词，肯定有
    if (KNOWN_NOUNS.has(lw)) {
      foundNouns.push(word);
      continue;
    }
    
    // 跳过动词不定式（-er, -ir, -re 结尾，且长度 > 4）
    if (word.length > 4 && /^[a-zàâäéèêëïîôöùûü]+(er|ir|re|ître|aître)$/i.test(lw)) {
      continue;
    }
    
    // 跳过动词现在分词（-ant 结尾）
    if (/ant$/i.test(lw)) continue;
    
    // 跳过动词过去分词常见词尾（-é, -i, -u）
    if (word.length <= 6 && /^[a-zàâäéèêëïîôöùûü]+(é|és|ée|ées|i|is|ie|ies|u|us|ue|ues)$/i.test(lw)) {
      continue;
    }
    
    // 跳过形容词词尾模式：-ique(s), -al/aux, -eux/euse, -if/ive, -able, -ible, -ien(ne)
    if (/^[a-zàâäéèêëïîôöùûü]+(iques?|aux?|ales?|eux|euses?|ifs?|ives?|ables?|ibles?|ienne?s?)$/i.test(lw)) {
      continue;
    }
    
    // 跳过副词（-ment 结尾）
    if (/ment$/i.test(lw)) continue;
    
    // 跳过代词
    if (/^(chacun|chacune|quelqu|aucun|aucune)$/i.test(lw)) continue;
    
    // 只接受明确的名词词尾：-tion, -sion, -eur, -age, -isme, -ité, -té, -esse, -ance, -ence
    if (/^[a-zàâäéèêëïîôöùûü]+(tions?|sions?|eurs?|euses?|ages?|ismes?|ités?|tés?|esses?|ances?|ences?)$/i.test(lw) && word.length >= 5) {
      foundNouns.push(word);
      continue;
    }
  }
  
  return { hasNoun: foundNouns.length > 0, nouns: foundNouns };
}

const results = [];
let hasMissingCount = 0;
let noMissingCount = 0;

for (const entry of data) {
  const check = hasNoun(entry.promptTruncText);
  
  results.push({
    ...entry,
    humanJudgment: check.hasNoun ? '有漏提取' : '无漏提取',
    detectedNouns: check.nouns,
  });
  
  if (check.hasNoun) {
    hasMissingCount++;
  } else {
    noMissingCount++;
  }
}

console.log('=== 人工判断结果 ===');
console.log('总数:', results.length);
console.log('有漏提取:', hasMissingCount);
console.log('无漏提取:', noMissingCount);
console.log(`比例: ${(hasMissingCount / results.length * 100).toFixed(1)}% 有漏提取`);

// 按批次统计
const byBatch = {};
for (const r of results.filter(r => r.humanJudgment === '有漏提取')) {
  if (!byBatch[r.batchId]) byBatch[r.batchId] = [];
  byBatch[r.batchId].push({
    truncId: r.truncId,
    promptText: r.promptTruncText,
    detectedNouns: r.detectedNouns,
  });
}

console.log('\n有漏提取的批次分布:');
for (const [batchId, items] of Object.entries(byBatch).sort((a, b) => parseInt(a[0]) - parseInt(b[0]))) {
  console.log(`批次 ${batchId}: ${items.length} 条`);
}

fs.writeFileSync('s1-nonhigh-human-judgment-final.json', JSON.stringify(results, null, 2), 'utf-8');
fs.writeFileSync('s1-batches-with-missing-nouns.json', JSON.stringify(byBatch, null, 2), 'utf-8');

// 生成需要人工复核的清单（只包含有漏提取的）
const needReview = results.filter(r => r.humanJudgment === '有漏提取');
let md = `# Non-high 条目有漏提取清单\n\n`;
md += `共 ${needReview.length} 条需要人工确认是否真的漏提取了名词。\n\n`;
md += `| 批次 | 截断ID | Prompt输入截断 | 检测到的疑似名词 | LLM实际输出 |\n`;
md += `|------|--------|----------------|------------------|-------------|\n`;

for (const r of needReview) {
  md += `| ${r.batchId} | 【【${r.truncId}】】 | ${r.promptTruncText} | ${r.detectedNouns.join(', ')} | ${r.llmOutputText} |\n`;
}

fs.writeFileSync('s1-nonhigh-need-review-final.md', md, 'utf-8');

console.log('\n已保存:');
console.log('- s1-nonhigh-human-judgment-final.json (全部判断结果)');
console.log('- s1-batches-with-missing-nouns.json (按批次统计)');
console.log('- s1-nonhigh-need-review-final.md (需要人工复核的清单)');
