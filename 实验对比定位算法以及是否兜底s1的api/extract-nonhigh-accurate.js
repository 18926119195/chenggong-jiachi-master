/**
 * 严谨提取 non-high 条目，用于人工复核
 * 
 * 数据来源：同一批次的 snapshot，确保 prompt 输入和 llmRawOutput 输出是同一次 API 调用
 * 
 * 提取逻辑：
 * 1. 从 llmRawOutput 里解析【【N】】后面的原始文本
 * 2. 从 prompt 里定位【【N】】标记后面的截断文本
 * 3. 对比两者，判断 LLM 报的名词是否在对应的输入截断里
 * 4. 只输出 confidence !== 'high' 的条目
 */
import fs from 'fs';
import path from 'path';

const SNAPSHOT_DIR = 's1-snapshots-group2';
const DRIFT_ANALYSIS = JSON.parse(fs.readFileSync('s1-group2-drift-token-analysis.json', 'utf-8'));

// 找出 19 个真实飘散的批次 ID
const trueDriftBatchIds = DRIFT_ANALYSIS.results
  .filter(r => r.hasDrift && r.nounActuallyInTruncText === false)
  .map(r => r.batchId)
  .sort((a, b) => a - b);

/**
 * 从 LLM 原始输出解析【【N】】条目
 * 返回 Map<truncId, rawText>
 */
function parseLLMRawOutput(llmRawOutput) {
  const map = new Map();
  const lines = llmRawOutput.split('\n');
  for (const line of lines) {
    const match = line.match(/^【【(\d+)】】(.*)$/);
    if (match) {
      const truncId = parseInt(match[1], 10);
      const text = match[2].trim();
      map.set(truncId, text);
    }
  }
  return map;
}

/**
 * 从 prompt 里提取【【N】】标记后的截断文本
 * 返回 Map<truncId, truncText>
 */
function extractTruncationsFromPrompt(prompt) {
  const map = new Map();
  // 匹配模式：【【N】】\n截断文本\n【【N+1】】
  const regex = /【【(\d+)】】\n([^【]+?)(?=\n【【\d+】】|\n*$)/g;
  let match;
  while ((match = regex.exec(prompt)) !== null) {
    const truncId = parseInt(match[1], 10);
    const text = match[2].trim();
    map.set(truncId, text);
  }
  return map;
}

const results = [];

for (const batchId of trueDriftBatchIds) {
  const batch = JSON.parse(fs.readFileSync(path.join(SNAPSHOT_DIR, `batch-${batchId}.json`), 'utf-8'));
  
  // 解析 LLM 原始输出和 prompt 输入
  const llmOutputMap = parseLLMRawOutput(batch.llmRawOutput);
  const promptTruncMap = extractTruncationsFromPrompt(batch.prompt);
  
  // 遍历 parsedNouns，找出所有 non-high 条目
  for (const entry of batch.parsedNouns) {
    const nonHighOffsets = entry.offsets.filter(o => o.confidence !== 'high');
    if (nonHighOffsets.length === 0) continue;
    
    const truncId = entry.truncId;
    const llmOutputText = llmOutputMap.get(truncId) || '(LLM未输出此编号)';
    const promptTruncText = promptTruncMap.get(truncId) || '(prompt未找到此编号)';
    
    // 判断 LLM 输出的名词是否在 LLM 自己输出的那行文本里
    const nounInLLMOutput = llmOutputText.toLowerCase().includes(entry.noun.toLowerCase());
    
    // 判断这个名词是否在 prompt 输入的对应截断里
    const nounInPromptTrunc = promptTruncText.toLowerCase().includes(entry.noun.toLowerCase());
    
    results.push({
      batchId,
      truncId,
      machineCode: entry.machineCode,
      noun: entry.noun,
      confidence: nonHighOffsets[0].confidence,
      llmOutputText,
      promptTruncText,
      nounInLLMOutput,
      nounInPromptTrunc,
    });
  }
}

// 输出 JSON 供后续分析
fs.writeFileSync('s1-nonhigh-accurate-data.json', JSON.stringify(results, null, 2), 'utf-8');

// 生成 Markdown 人工复核清单
let md = `# Non-High 条目人工复核清单（严谨版）

**数据来源**：同一批次 snapshot 的 prompt 输入和 llmRawOutput 输出

**说明**：
- 每条展示：LLM 输出【【N】】的内容 vs. prompt 输入【【N】】的截断文本
- **复核目标**：判断 prompt 输入的这个截断里，是否有被漏提取的名词

---

`;

// 按批次分组
const byBatch = {};
for (const r of results) {
  if (!byBatch[r.batchId]) byBatch[r.batchId] = [];
  byBatch[r.batchId].push(r);
}

for (const batchId of trueDriftBatchIds) {
  const entries = byBatch[batchId] || [];
  if (entries.length === 0) continue;
  
  md += `## 批次 ${batchId} (${entries.length} 个 non-high 条目)\n\n`;
  
  entries.sort((a, b) => a.truncId - b.truncId);
  
  for (const e of entries) {
    md += `### ${e.machineCode}\n\n`;
    md += `**LLM 输出的名词**: \`${e.noun}\` (${e.confidence})\n\n`;
    md += `**LLM 输出【【${e.truncId}】】原文**:\n> ${e.llmOutputText}\n\n`;
    md += `**prompt 输入【【${e.truncId}】】截断**:\n> ${e.promptTruncText}\n\n`;
    
    const status1 = e.nounInLLMOutput ? '✅' : '❌';
    const status2 = e.nounInPromptTrunc ? '✅' : '❌';
    md += `- ${status1} 名词在 LLM 输出里\n`;
    md += `- ${status2} 名词在 prompt 输入截断里\n\n`;
    
    md += `**人工判断**（针对 prompt 输入的这个截断）:\n`;
    md += `- [ ] 无漏提取（截断无名词 或 无其他遗漏）\n`;
    md += `- [ ] 有漏提取，应提取的名词：\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\n\n`;
    md += `---\n\n`;
  }
}

md += `\n## 汇总\n\n`;
md += `- 真实飘散批次: ${trueDriftBatchIds.length}\n`;
md += `- Non-high 条目总数: ${results.length}\n`;

fs.writeFileSync('s1-nonhigh-manual-review-accurate.md', md, 'utf-8');

console.log('=== 严谨版人工复核清单已生成 ===');
console.log('JSON数据:', 's1-nonhigh-accurate-data.json');
console.log('Markdown清单:', 's1-nonhigh-manual-review-accurate.md');
console.log('批次数:', trueDriftBatchIds.length);
console.log('待复核条目数:', results.length);
