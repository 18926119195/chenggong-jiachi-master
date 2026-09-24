/**
 * 用快照文件里 parsedNouns 的原始 truncId（LLM 真实标记的编号）重新核验飘散。
 * 对每个批次：
 *   1. 遍历 parsedNouns，找到该批次第一个 confidence !== 'high' 的条目
 *   2. 取其 truncId，对照 truncations[truncId-1].text，检查 noun 是否真的在这段文本里
 *   3. 计算该 truncId 在该批次 prompt 中的起始字符位置（用于确定"补缺LLM输入的第几个字符开始出现飘散"）
 */
import fs from 'fs';
import path from 'path';

const SNAPSHOT_DIR = 's1-snapshots-group2';
const files = fs.readdirSync(SNAPSHOT_DIR)
  .filter(f => /^batch-\d+\.json$/.test(f))
  .sort((a, b) => parseInt(a.match(/\d+/)[0]) - parseInt(b.match(/\d+/)[0]));

const results = [];

for (const file of files) {
  const batch = JSON.parse(fs.readFileSync(path.join(SNAPSHOT_DIR, file), 'utf-8'));
  const batchId = batch.batchId;
  const truncations = batch.truncations;

  // 计算每个 truncId 在 prompt 中的起始字符位置
  // prompt 结构: 【【N】】\n<text>\n【【N+1】】\n...
  const truncCharStart = {};
  let cursor = 0;
  const promptHeaderMatch = batch.prompt.indexOf('【【1】】');
  cursor = promptHeaderMatch;
  for (const t of truncations) {
    const marker = `【【${t.truncId}】】`;
    truncCharStart[t.truncId] = cursor;
    cursor += marker.length + 1 /* \n */ + t.text.length + 1 /* \n */;
  }
  const promptBodyTotalChars = cursor - promptHeaderMatch;

  // 找第一个 confidence !== high 的 parsedNouns 条目
  let firstDrift = null;
  for (const entry of batch.parsedNouns) {
    const nonHigh = entry.offsets.filter(o => o.confidence !== 'high');
    if (nonHigh.length > 0) {
      firstDrift = { entry, offset: nonHigh[0] };
      break;
    }
  }

  if (!firstDrift) {
    results.push({ batchId, hasDrift: false, totalTruncations: truncations.length, promptBodyTotalChars });
    continue;
  }

  const { entry, offset } = firstDrift;
  const trunc = truncations.find(t => t.truncId === entry.truncId);
  const nounInTruncText = trunc ? trunc.text.toLowerCase().includes(entry.noun.toLowerCase()) : false;

  const charStart = truncCharStart[entry.truncId];
  const charPercent = promptBodyTotalChars > 0 ? (charStart / promptBodyTotalChars) * 100 : null;

  results.push({
    batchId,
    hasDrift: true,
    totalTruncations: truncations.length,
    promptBodyTotalChars,
    firstDriftTruncId: entry.truncId,
    firstDriftNoun: entry.noun,
    firstDriftConfidence: offset.confidence,
    truncText: trunc ? trunc.text : null,
    nounActuallyInTruncText: nounInTruncText,
    charStartInPrompt: charStart,
    charPercentInPrompt: charPercent !== null ? parseFloat(charPercent.toFixed(1)) : null,
    verdict: nounInTruncText ? 'LLM真实飘散(名词确实不在标记截断里但算法搜到了别处)' : '算法误标为medium/low但LLM标记本身可能是对的,需人工看兜底命中位置',
  });
}

const withDrift = results.filter(r => r.hasDrift);
const trueDrift = withDrift.filter(r => r.nounActuallyInTruncText === false);

fs.writeFileSync('s1-group2-verified-drift-analysis.json', JSON.stringify({
  meta: {
    description: '基于快照 parsedNouns 原始 truncId 的人工核验飘散分析',
    totalBatches: results.length,
    batchesWithNonHighConfidence: withDrift.length,
    batchesWhereNounNotInTruncText: trueDrift.length,
  },
  results,
}, null, 2), 'utf-8');

console.log('总批次:', results.length);
console.log('存在 non-high 置信度的批次:', withDrift.length);
console.log('其中"名词确实不在该 truncId 文本里"的批次数:', trueDrift.length);
console.log('\n前 10 个存在飘散的批次详情:');
withDrift.slice(0, 10).forEach(r => {
  console.log(`批次${r.batchId}: truncId=${r.firstDriftTruncId}, noun="${r.firstDriftNoun}", conf=${r.firstDriftConfidence}, 文本="${r.truncText}", 名词在文本里=${r.nounActuallyInTruncText}, charPos=${r.charStartInPrompt}(${r.charPercentInPrompt}%)`);
});
