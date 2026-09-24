/**
 * 提取所有 non-high 条目对应的截断原文，供人工复核
 * 
 * 目标：判断每个触发 non-high 警报的截断里，是否有被漏提取的名词
 * 
 * 输出格式：
 * 批次 X | 截断【【N】】| LLM输出的名词: xxx | 截断原文: "..." | 人工判断: [ ] 无漏提取 [ ] 有漏提取（补充：___）
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

let outputMd = `# Non-High 条目人工复核清单

**说明**：
- 以下是 19 个真实飘散批次里所有触发 medium/low 置信度的名词条目
- 每条记录展示：LLM 标记的【【N】】编号 + 名词，以及 N 号截断的实际输入文本
- **复核任务**：判断这个截断里是否有被漏提取的名词性成分
  - 如果截断本身就没有名词，或者 LLM 报的名词确实不在这个截断里且截断没有其他遗漏，则无需处理
  - 如果截断里有别的名词被漏掉了，记录下来供后续补提取

---

`;

let totalNonHighCount = 0;

for (const batchId of trueDriftBatchIds) {
  const batch = JSON.parse(fs.readFileSync(path.join(SNAPSHOT_DIR, `batch-${batchId}.json`), 'utf-8'));
  
  // 找出所有 non-high 条目
  const nonHighEntries = [];
  for (const entry of batch.parsedNouns) {
    const nonHighOffsets = entry.offsets.filter(o => o.confidence !== 'high');
    if (nonHighOffsets.length > 0) {
      const trunc = batch.truncations.find(t => t.truncId === entry.truncId);
      nonHighEntries.push({
        truncId: entry.truncId,
        noun: entry.noun,
        confidence: nonHighOffsets[0].confidence,
        truncText: trunc ? trunc.text : '(截断未找到)',
        nounInText: trunc ? trunc.text.toLowerCase().includes(entry.noun.toLowerCase()) : false,
      });
    }
  }
  
  if (nonHighEntries.length === 0) continue;
  
  totalNonHighCount += nonHighEntries.length;
  
  outputMd += `## 批次 ${batchId} (共 ${nonHighEntries.length} 个 non-high 条目)\n\n`;
  
  // 按 truncId 排序
  nonHighEntries.sort((a, b) => a.truncId - b.truncId);
  
  for (const entry of nonHighEntries) {
    const matchStatus = entry.nounInText ? '✅ 名词在截断里' : '❌ 名词不在截断里';
    outputMd += `### 【【${entry.truncId}】】\n\n`;
    outputMd += `- **LLM 输出的名词**: \`${entry.noun}\` (${entry.confidence})\n`;
    outputMd += `- **状态**: ${matchStatus}\n`;
    outputMd += `- **截断原文**:\n  > ${entry.truncText}\n\n`;
    outputMd += `**人工判断**:\n`;
    outputMd += `- [ ] 无漏提取（截断无名词 或 LLM输出名词不在且无其他遗漏）\n`;
    outputMd += `- [ ] 有漏提取，应提取的名词：\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\n\n`;
    outputMd += `---\n\n`;
  }
}

outputMd += `\n## 汇总统计\n\n`;
outputMd += `- 真实飘散批次数: ${trueDriftBatchIds.length}\n`;
outputMd += `- Non-high 条目总数: ${totalNonHighCount}\n`;
outputMd += `- 需要人工复核的截断数: ${totalNonHighCount}\n`;

fs.writeFileSync('s1-nonhigh-manual-review-checklist.md', outputMd, 'utf-8');

console.log('=== Non-High 条目人工复核清单已生成 ===');
console.log('文件: s1-nonhigh-manual-review-checklist.md');
console.log('批次数:', trueDriftBatchIds.length);
console.log('待复核条目数:', totalNonHighCount);
console.log('\n请逐条判断每个截断里是否有被漏提取的名词。');
