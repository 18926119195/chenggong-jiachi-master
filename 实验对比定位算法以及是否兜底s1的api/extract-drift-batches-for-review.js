/**
 * 提取 19 个真实飘散批次的输入输出，标记问题点
 * 对每个批次生成一个可读的 markdown 文件：
 *   - 批次元数据
 *   - 完整 prompt（输入）
 *   - 完整 LLM 原始输出
 *   - parsedNouns 里所有 non-high 条目，标记是否在对应截断里
 */
import fs from 'fs';
import path from 'path';

const SNAPSHOT_DIR = 's1-snapshots-group2';
const OUTPUT_DIR = 's1-drift-review';
const RERUN_DATA = JSON.parse(fs.readFileSync('s1-group2-rerun-recommendation.json', 'utf-8'));

if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR);
}

const trueDriftBatchIds = RERUN_DATA.diagnostics.map(d => d.batchId);

console.log(`提取 ${trueDriftBatchIds.length} 个批次的输入输出...\n`);

for (const batchId of trueDriftBatchIds) {
  const batch = JSON.parse(fs.readFileSync(path.join(SNAPSHOT_DIR, `batch-${batchId}.json`), 'utf-8'));
  const diagnostic = RERUN_DATA.diagnostics.find(d => d.batchId === batchId);
  
  let md = `# 批次 ${batchId} - ${diagnostic.pattern}\n\n`;
  
  md += `## 元数据\n\n`;
  md += `- **截断总数**: ${batch.truncations.length}\n`;
  md += `- **non-high 名词数**: ${diagnostic.totalNonHigh}\n`;
  md += `- **其中不在标记截断里**: ${diagnostic.notInText} (${diagnostic.notInTextRatio}%)\n`;
  md += `- **连续编号段**: ${diagnostic.consecutiveRuns}\n`;
  md += `- **首次飘散点**: 【【${diagnostic.firstDriftTruncId}】】\n`;
  md += `- **模式**: ${diagnostic.pattern}\n\n`;
  
  md += `---\n\n`;
  
  // 输入 prompt（前 3000 字符 + 后 3000 字符，中间省略）
  md += `## 输入 Prompt\n\n`;
  md += `\`\`\`\n`;
  if (batch.prompt.length <= 6000) {
    md += batch.prompt;
  } else {
    md += batch.prompt.substring(0, 3000);
    md += `\n\n... [省略 ${Math.floor((batch.prompt.length - 6000) / 1000)}k 字符] ...\n\n`;
    md += batch.prompt.substring(batch.prompt.length - 3000);
  }
  md += `\n\`\`\`\n\n`;
  
  md += `---\n\n`;
  
  // LLM 原始输出（如果存在）
  if (batch.rawOutput) {
    md += `## LLM 原始输出\n\n`;
    md += `\`\`\`\n`;
    if (batch.rawOutput.length <= 6000) {
      md += batch.rawOutput;
    } else {
      md += batch.rawOutput.substring(0, 3000);
      md += `\n\n... [省略 ${Math.floor((batch.rawOutput.length - 6000) / 1000)}k 字符] ...\n\n`;
      md += batch.rawOutput.substring(batch.rawOutput.length - 3000);
    }
    md += `\n\`\`\`\n\n`;
    md += `---\n\n`;
  } else {
    md += `## LLM 原始输出\n\n`;
    md += `*（快照中未保存原始输出，仅有解析后的 parsedNouns）*\n\n`;
    md += `---\n\n`;
  }
  
  // 提取所有 non-high 条目
  const nonHighEntries = [];
  for (const entry of batch.parsedNouns) {
    const nonHighOffsets = entry.offsets.filter(o => o.confidence !== 'high');
    if (nonHighOffsets.length === 0) continue;
    
    const trunc = batch.truncations.find(t => t.truncId === entry.truncId);
    const nounInText = trunc ? trunc.text.toLowerCase().includes(entry.noun.toLowerCase()) : false;
    
    nonHighEntries.push({
      truncId: entry.truncId,
      noun: entry.noun,
      confidence: nonHighOffsets[0].confidence,
      truncText: trunc ? trunc.text : null,
      nounInText,
    });
  }
  
  md += `## Non-high 名词详情 (${nonHighEntries.length} 个)\n\n`;
  md += `| 截断编号 | 名词 | 置信度 | 在截断里? | 截断实际文本 |\n`;
  md += `|---|---|---|---|---|\n`;
  
  for (const entry of nonHighEntries) {
    const flag = entry.nounInText ? '✅' : '❌ **问题**';
    const truncText = entry.truncText ? entry.truncText.substring(0, 60) + (entry.truncText.length > 60 ? '...' : '') : 'N/A';
    md += `| 【【${entry.truncId}】】 | ${entry.noun} | ${entry.confidence} | ${flag} | ${truncText} |\n`;
  }
  
  md += `\n---\n\n`;
  
  // 如果是整体偏移型，给出前 20 个截断的完整对照
  if (diagnostic.pattern !== '孤立错误型（兜底可处理）') {
    md += `## 首次飘散点附近的截断详情\n\n`;
    md += `展示【【${diagnostic.firstDriftTruncId}】】前后各 5 个截断的完整文本，便于人工核对：\n\n`;
    
    const startIdx = Math.max(0, diagnostic.firstDriftTruncId - 5);
    const endIdx = Math.min(batch.truncations.length, diagnostic.firstDriftTruncId + 10);
    
    for (let i = startIdx; i < endIdx; i++) {
      const trunc = batch.truncations[i];
      const isFirstDrift = trunc.truncId === diagnostic.firstDriftTruncId;
      
      md += `### 【【${trunc.truncId}】】${isFirstDrift ? ' ⚠️ **首次飘散点**' : ''}\n\n`;
      md += `\`\`\`\n${trunc.text}\n\`\`\`\n\n`;
      
      // 检查这个截断对应的 parsedNouns
      const relatedNouns = batch.parsedNouns.filter(n => n.truncId === trunc.truncId);
      if (relatedNouns.length > 0) {
        md += `**LLM 标记的名词**：\n`;
        for (const noun of relatedNouns) {
          const conf = noun.offsets[0]?.confidence || 'unknown';
          const inText = trunc.text.toLowerCase().includes(noun.noun.toLowerCase());
          const flag = inText ? '✅' : '❌';
          md += `- ${noun.noun} (${conf}) ${flag}\n`;
        }
        md += `\n`;
      }
    }
  }
  
  const filename = `batch-${batchId}-${diagnostic.pattern.replace(/[^a-z0-9]/gi, '-')}.md`;
  fs.writeFileSync(path.join(OUTPUT_DIR, filename), md, 'utf-8');
  
  console.log(`✓ 批次 ${batchId} -> ${filename}`);
}

console.log(`\n所有文件已保存到: ${OUTPUT_DIR}/`);
console.log('\n按模式分类：');
console.log('- 整体偏移型:', RERUN_DATA.diagnostics.filter(d => d.pattern === '整体偏移型').map(d => d.batchId).join(', '));
console.log('- 混合型:', RERUN_DATA.diagnostics.filter(d => d.pattern.includes('混合')).map(d => d.batchId).join(', '));
console.log('- 孤立错误型:', RERUN_DATA.diagnostics.filter(d => d.pattern.includes('孤立')).map(d => d.batchId).join(', '));
