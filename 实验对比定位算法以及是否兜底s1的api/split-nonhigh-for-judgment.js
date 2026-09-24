/**
 * 把 346 条"需复核"条目按真实情况拆成两组：
 *
 * 组 A（"名词在截断里" = true）：
 *   LLM 报的名词字符确实存在于该截断文本里，只是定位算法第一层没匹配上（大小写/重音/子串边界等问题）。
 *   这组不是"漏提取"问题，是定位算法 bug，名词本身已经被 LLM 正确识别，不需要重跑 LLM。
 *
 * 组 B（"名词在截断里" = false）：
 *   LLM 报的名词根本不在该截断文本里（编号错位或幻觉）。
 *   这组才需要人工看"截断原文本身有没有名词性成分被漏掉"。
 *   进一步用规则判断截断是否有实质名词性内容，缩小人工范围。
 */
import fs from 'fs';

const data = JSON.parse(fs.readFileSync('s1-nonhigh-final-analysis.json', 'utf-8'));
const items = data.analysis.filter(a => a.needAction);

const groupA = items.filter(a => a.nounInText);
const groupB = items.filter(a => !a.nounInText);

console.log('组 A（名词在截断里，定位算法bug，无需重跑）:', groupA.length);
console.log('组 B（名词不在截断里，需判断截断是否漏提取）:', groupB.length);

// 组 B 里进一步判断：截断文本是否含有法语名词性词尾特征或大写专名等
function looksLikeHasNoun(text) {
  const t = text.trim();
  if (t.length === 0) return false;
  // 去掉纯功能词组合（冠词、介词、连词、代词、标点）
  const stopOnly = /^[\s.,;:!?()«»…\-–—'’"]*((de|du|des|la|le|les|un|une|à|en|et|ou|qui|que|dont|par|sur|dans|avec|pour|se|ne|pas|plus|ce|cet|cette|ces|son|sa|ses|il|elle|on|nous|vous|ils|elles|d'|l'|c'|s'|n'|qu')[\s.,;:!?()«»…\-–—'’"]*)+$/i;
  if (stopOnly.test(t)) return false;
  // 含大写开头的词（可能是专名）或典型名词后缀
  const hasCapitalWord = /\b[A-ZÀ-Ý][a-zà-ÿ]{2,}/.test(t);
  const hasNounSuffix = /\b\w+(tion|sion|ment|isme|iste|ité|té|ance|ence|eur|euse|rice|age|ique|iques|ologie|logie|ateur)\b/i.test(t);
  return hasCapitalWord || hasNounSuffix || t.split(/\s+/).some(w => w.length > 6);
}

const groupB_likelyHasNoun = groupB.filter(a => looksLikeHasNoun(a.truncText));
const groupB_noNoun = groupB.filter(a => !looksLikeHasNoun(a.truncText));

console.log('  组 B 细分 - 疑似含名词（需人工看）:', groupB_likelyHasNoun.length);
console.log('  组 B 细分 - 基本无实质内容（可判无需处理）:', groupB_noNoun.length);

let md = `# Non-High 条目判断结果\n\n`;

md += `## 组 A：定位算法 bug，无需重跑 LLM (${groupA.length} 个)\n\n`;
md += `这些条目里，LLM 报的名词确实存在于对应截断的原文中，只是定位算法第一层字符匹配没命中（可能是大小写、重音符号或子串边界问题）。**这些名词本身是有效的提取结果，不算漏提取，不需要重跑。**\n\n`;
md += `| 批次 | 截断 | 名词 | 置信度 | 截断原文 |\n|---|---|---|---|---|\n`;
for (const a of groupA) {
  md += `| ${a.batchId} | 【【${a.truncId}】】 | ${a.nonHighNoun} | ${a.nonHighConfidence} | ${a.truncText.replace(/\|/g, '\\|')} |\n`;
}

md += `\n---\n\n## 组 B-1：截断疑似含名词，需要重跑/人工补提取 (${groupB_likelyHasNoun.length} 个)\n\n`;
md += `这些截断里，LLM 报的名词不在原文中（编号错位或幻觉），且截断原文本身看起来含有实质名词性内容（大写专名、典型名词后缀或长词）。**这些截断可能存在真实漏提取，建议重跑或人工补充。**\n\n`;
md += `| 批次 | 截断 | LLM误报名词 | 置信度 | 截断原文 |\n|---|---|---|---|---|\n`;
for (const a of groupB_likelyHasNoun) {
  md += `| ${a.batchId} | 【【${a.truncId}】】 | ${a.nonHighNoun} | ${a.nonHighConfidence} | ${a.truncText.replace(/\|/g, '\\|')} |\n`;
}

md += `\n---\n\n## 组 B-2：截断基本无实质内容，判定无需处理 (${groupB_noNoun.length} 个)\n\n`;
md += `这些截断原文只是功能词片段（冠词/介词/连词等），LLM 报的名词也不在其中。**判定为无漏提取，可直接丢弃这条 non-high 记录。**\n\n`;
md += `| 批次 | 截断 | LLM误报名词 | 置信度 | 截断原文 |\n|---|---|---|---|---|\n`;
for (const a of groupB_noNoun) {
  md += `| ${a.batchId} | 【【${a.truncId}】】 | ${a.nonHighNoun} | ${a.nonHighConfidence} | ${a.truncText.replace(/\|/g, '\\|')} |\n`;
}

fs.writeFileSync('s1-nonhigh-judged-final.md', md, 'utf-8');
fs.writeFileSync('s1-nonhigh-judged-final.json', JSON.stringify({
  groupA_algoBugNoRerun: groupA,
  groupB1_likelyMissedNoun_needRerun: groupB_likelyHasNoun,
  groupB2_noContent_noAction: groupB_noNoun,
}, null, 2), 'utf-8');

console.log('\n已保存: s1-nonhigh-judged-final.md / .json');

// 统计真正需要重跑的批次
const rerunBatchIds = [...new Set(groupB_likelyHasNoun.map(a => a.batchId))].sort((a,b)=>a-b);
console.log('\n真正建议重跑的批次:', rerunBatchIds.join(', '));
console.log('批次数:', rerunBatchIds.length);
