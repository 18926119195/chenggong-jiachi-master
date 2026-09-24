/**
 * 计算真实飘散在 prompt 中的 token 位置
 * 对每个批次的首次 non-high 名词：
 *   1. 找到该名词对应的 truncId
 *   2. 计算该 truncId 在 prompt 中的起始 token 位置
 *      - prompt 结构：系统指令 + 【【1】】\n<text1>\n【【2】】\n<text2>\n...
 *      - 累加前面所有截断的 token 数（用 3.5 字符/token 估算）
 */
import fs from 'fs';
import path from 'path';

const SNAPSHOT_DIR = 's1-snapshots-group2';
const CHARS_PER_TOKEN = 3.5;

function estimateTokens(text) {
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

const files = fs.readdirSync(SNAPSHOT_DIR)
  .filter(f => /^batch-\d+\.json$/.test(f))
  .sort((a, b) => parseInt(a.match(/\d+/)[0]) - parseInt(b.match(/\d+/)[0]));

const results = [];

for (const file of files) {
  const batch = JSON.parse(fs.readFileSync(path.join(SNAPSHOT_DIR, file), 'utf-8'));
  const batchId = batch.batchId;
  const truncations = batch.truncations;

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
    results.push({ batchId, hasDrift: false, totalTruncations: truncations.length });
    continue;
  }

  const { entry, offset } = firstDrift;
  const trunc = truncations.find(t => t.truncId === entry.truncId);
  const nounInTruncText = trunc ? trunc.text.toLowerCase().includes(entry.noun.toLowerCase()) : false;

  // 计算 prompt 结构的 token 分布
  // 1. 系统指令部分
  const promptHeaderEndMarker = '【【1】】';
  const headerEndIdx = batch.prompt.indexOf(promptHeaderEndMarker);
  const systemInstruction = batch.prompt.substring(0, headerEndIdx);
  const systemInstructionTokens = estimateTokens(systemInstruction);

  // 2. 累加到该 truncId 之前的所有截断的 token 数
  let tokensBeforeDriftTrunc = systemInstructionTokens;
  for (const t of truncations) {
    if (t.truncId >= entry.truncId) break;
    // 每个截断格式：【【N】】\n<text>\n
    const marker = `【【${t.truncId}】】`;
    const sectionText = `${marker}\n${t.text}\n`;
    tokensBeforeDriftTrunc += estimateTokens(sectionText);
  }

  // 3. 飘散截断自身的起始位置就是 tokensBeforeDriftTrunc
  const driftTruncStartToken = tokensBeforeDriftTrunc;

  // 4. 总 prompt token 数（用于计算百分比）
  let totalPromptTokens = systemInstructionTokens;
  for (const t of truncations) {
    const marker = `【【${t.truncId}】】`;
    const sectionText = `${marker}\n${t.text}\n`;
    totalPromptTokens += estimateTokens(sectionText);
  }

  const tokenPercent = totalPromptTokens > 0 ? (driftTruncStartToken / totalPromptTokens) * 100 : null;

  results.push({
    batchId,
    hasDrift: true,
    totalTruncations: truncations.length,
    firstDriftTruncId: entry.truncId,
    firstDriftNoun: entry.noun,
    firstDriftConfidence: offset.confidence,
    truncText: trunc ? trunc.text : null,
    nounActuallyInTruncText: nounInTruncText,
    // 新增 token 级别统计
    systemInstructionTokens: Math.round(systemInstructionTokens),
    driftTruncStartToken: Math.round(driftTruncStartToken),
    totalPromptTokens: Math.round(totalPromptTokens),
    tokenPercentInPrompt: tokenPercent !== null ? parseFloat(tokenPercent.toFixed(1)) : null,
  });
}

const trueDrift = results.filter(r => r.hasDrift && r.nounActuallyInTruncText === false);

fs.writeFileSync('s1-group2-drift-token-analysis.json', JSON.stringify({
  meta: {
    description: '基于 token 位置的真实飘散分析（3.5字符/token 估算）',
    totalBatches: results.length,
    batchesWithTrueDrift: trueDrift.length,
    averageDriftStartToken: trueDrift.length > 0 
      ? Math.round(trueDrift.reduce((sum, r) => sum + r.driftTruncStartToken, 0) / trueDrift.length)
      : null,
    averageDriftTokenPercent: trueDrift.length > 0
      ? parseFloat((trueDrift.reduce((sum, r) => sum + r.tokenPercentInPrompt, 0) / trueDrift.length).toFixed(1))
      : null,
  },
  results,
}, null, 2), 'utf-8');

console.log('=== Token 级别飘散分析 ===\n');
console.log('总批次:', results.length);
console.log('真实飘散批次数:', trueDrift.length);
console.log('');

if (trueDrift.length > 0) {
  const avgToken = Math.round(trueDrift.reduce((sum, r) => sum + r.driftTruncStartToken, 0) / trueDrift.length);
  const avgPercent = (trueDrift.reduce((sum, r) => sum + r.tokenPercentInPrompt, 0) / trueDrift.length).toFixed(1);
  console.log('平均飘散起始 token 位置:', avgToken);
  console.log('平均飘散起始位置占比:', avgPercent, '%');
  console.log('');
  console.log('真实飘散的 19 个批次详情:\n');
  
  trueDrift.forEach(r => {
    console.log(`批次 ${r.batchId}:`);
    console.log(`  首次飘散截断: 【【${r.firstDriftTruncId}】】 / ${r.totalTruncations}`);
    console.log(`  LLM 输入 token 位置: 第 ${r.driftTruncStartToken} 个 token (${r.tokenPercentInPrompt}%)`);
    console.log(`  名词: "${r.firstDriftNoun}" (${r.firstDriftConfidence})`);
    console.log(`  截断实际文本: "${r.truncText}"`);
    console.log(`  名词在该截断里: ${r.nounActuallyInTruncText ? '是' : '否 ❌'}`);
    console.log('');
  });
}
