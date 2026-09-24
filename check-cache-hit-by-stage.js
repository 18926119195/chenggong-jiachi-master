import fs from 'fs';
import path from 'path';

const dir = path.join(process.cwd(), 'snapshots');
const files = fs.readdirSync(dir).filter(f => f.endsWith('-request.json'));

function classify(promptText) {
  if (!promptText) return 'unknown';
  // 粗筛特征：包含"只回答相关词的机器符号"和"如果没有任何相关词，回答：NONE"
  if (promptText.includes('只回答相关词的机器符号') || promptText.includes('如果没有任何相关词，回答：NONE')) {
    return 'coarse';
  }
  // 精打特征：包含"请按重要程度打分"
  if (promptText.includes('请按重要程度打分') || promptText.includes('81-100 核心概念')) {
    return 'score';
  }
  // 推理特征：包含"材料："和"(命中: "（缓存命中率标记）
  if (promptText.includes('材料：') && promptText.includes('(命中: ')) {
    return 'reasoning';
  }
  return 'other';
}

const stageStats = {};

for (const f of files) {
  const callId = f.replace('-request.json', '');
  const reqPath = path.join(dir, f);
  const resPath = path.join(dir, `${callId}-response.json`);
  if (!fs.existsSync(resPath)) continue;

  let reqData, resData;
  try {
    reqData = JSON.parse(fs.readFileSync(reqPath, 'utf-8'));
    resData = JSON.parse(fs.readFileSync(resPath, 'utf-8'));
  } catch {
    continue;
  }

  const usage = resData.response?.usage;
  if (!usage) continue;

  const promptText = reqData.fullPrompt || reqData.promptPreview || '';

  const stage = classify(promptText);
  const hit = usage.prompt_cache_hit_tokens || 0;
  const miss = usage.prompt_cache_miss_tokens || 0;

  if (!stageStats[stage]) {
    stageStats[stage] = { calls: 0, hit: 0, miss: 0 };
  }
  stageStats[stage].calls++;
  stageStats[stage].hit += hit;
  stageStats[stage].miss += miss;
}

console.log('按阶段统计缓存命中率:\n');
let grandHit = 0, grandMiss = 0, grandCalls = 0;
for (const [stage, s] of Object.entries(stageStats)) {
  const total = s.hit + s.miss;
  const rate = total > 0 ? (s.hit / total * 100).toFixed(2) : '0.00';
  console.log(`[${stage}] 调用数=${s.calls} hit=${s.hit} miss=${s.miss} 命中率=${rate}%`);
  grandHit += s.hit;
  grandMiss += s.miss;
  grandCalls += s.calls;
}
const grandTotal = grandHit + grandMiss;
const grandRate = grandTotal > 0 ? (grandHit / grandTotal * 100).toFixed(2) : '0.00';
console.log(`\n[总计] 调用数=${grandCalls} hit=${grandHit} miss=${grandMiss} 命中率=${grandRate}%`);

if (grandHit > 0) {
  console.log('\n各阶段占总命中 tokens 的比例:');
  for (const [stage, s] of Object.entries(stageStats)) {
    const share = (s.hit / grandHit * 100).toFixed(2);
    console.log(`  [${stage}] 占比 ${share}%`);
  }
}
