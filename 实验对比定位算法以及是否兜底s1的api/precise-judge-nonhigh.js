/**
 * 更精确的漏提取判断：对比截断里的所有名词是否都被 LLM 提取过
 * 
 * 逻辑：
 * 1. 对于每个 non-high 的截断，看这个批次里所有 high 置信度的条目
 * 2. 如果这个截断已经有 high 置信度的名词被提取了，说明 LLM 看到了这个截断
 * 3. 如果 LLM 在这个截断标记了 high 名词，那么这个截断的 non-high 名词很可能只是：
 *    - LLM 误标了一个不存在的名词（幻觉）
 *    - 或者是编号错位导致的重复标记
 * 4. 只有当一个截断：
 *    - 没有任何 high 置信度名词被标记
 *    - 且截断文本看起来有名词性成分
 *    才标记为"可能有漏提取"
 */
import fs from 'fs';
import path from 'path';

const SNAPSHOT_DIR = 's1-snapshots-group2';
const DRIFT_ANALYSIS = JSON.parse(fs.readFileSync('s1-group2-drift-token-analysis.json', 'utf-8'));

const trueDriftBatchIds = DRIFT_ANALYSIS.results
  .filter(r => r.hasDrift && r.nounActuallyInTruncText === false)
  .map(r => r.batchId)
  .sort((a, b) => a - b);

const analysis = [];

for (const batchId of trueDriftBatchIds) {
  const batch = JSON.parse(fs.readFileSync(path.join(SNAPSHOT_DIR, `batch-${batchId}.json`), 'utf-8'));
  
  // 构建每个截断的提取情况
  const truncMap = new Map();
  for (const trunc of batch.truncations) {
    truncMap.set(trunc.truncId, {
      text: trunc.text,
      highNouns: [],
      nonHighNouns: [],
    });
  }
  
  // 填充名词数据
  for (const entry of batch.parsedNouns) {
    const truncInfo = truncMap.get(entry.truncId);
    if (!truncInfo) continue;
    
    const hasHigh = entry.offsets.some(o => o.confidence === 'high');
    const hasNonHigh = entry.offsets.some(o => o.confidence !== 'high');
    
    if (hasHigh) {
      truncInfo.highNouns.push(entry.noun);
    }
    if (hasNonHigh) {
      truncInfo.nonHighNouns.push({
        noun: entry.noun,
        confidence: entry.offsets.find(o => o.confidence !== 'high').confidence,
        nounInText: truncInfo.text.toLowerCase().includes(entry.noun.toLowerCase()),
      });
    }
  }
  
  // 分析有 non-high 的截断
  for (const [truncId, info] of truncMap) {
    if (info.nonHighNouns.length === 0) continue;
    
    const hasHighCoverage = info.highNouns.length > 0;
    
    for (const nonHighEntry of info.nonHighNouns) {
      let judgment = '';
      let needAction = false;
      let reason = '';
      
      if (hasHighCoverage) {
        // 这个截断已经有 high 名词被提取了
        if (nonHighEntry.nounInText) {
          judgment = '无需处理：截断已有high名词覆盖，该non-high名词可能是LLM重复标记或次要名词';
          reason = `已提取high名词: ${info.highNouns.join(', ')}`;
        } else {
          judgment = '无需处理：截断已有high名词覆盖，该non-high名词不在截断里（LLM编号错位）';
          reason = `已提取high名词: ${info.highNouns.join(', ')}`;
        }
      } else {
        // 这个截断没有任何 high 名词
        if (nonHighEntry.nounInText) {
          judgment = '⚠️ 需复核：截断无high覆盖，但non-high名词在截断里（定位算法bug？）';
          needAction = true;
          reason = '可能是定位算法第一层匹配失败，需检查算法逻辑';
        } else {
          // 截断无 high，non-high 名词也不在截断里
          // 需要看截断文本是否真的有名词
          const textLower = info.text.toLowerCase();
          const hasSubstantialContent = info.text.length > 10 && 
                                       !/^[de la le les un une des à en et ou .,;:!?()«»\s]+$/i.test(info.text);
          
          if (hasSubstantialContent) {
            judgment = '⚠️ 需复核：截断无high覆盖，non-high名词不在截断里，但截断有实质内容';
            needAction = true;
            reason = '可能有遗漏的名词，需人工确认截断是否包含未提取的名词';
          } else {
            judgment = '无需处理：截断无实质内容（仅介词/冠词/连接词）';
            reason = '截断本身不含名词性成分';
          }
        }
      }
      
      analysis.push({
        batchId,
        truncId,
        truncText: info.text,
        highNouns: info.highNouns,
        nonHighNoun: nonHighEntry.noun,
        nonHighConfidence: nonHighEntry.confidence,
        nounInText: nonHighEntry.nounInText,
        judgment,
        needAction,
        reason,
      });
    }
  }
}

const needActionCount = analysis.filter(a => a.needAction).length;
const noActionCount = analysis.filter(a => !a.needAction).length;

console.log('=== 精确判断结果 ===');
console.log('总 non-high 条目数:', analysis.length);
console.log('需要复核的条目:', needActionCount, `(${(needActionCount/analysis.length*100).toFixed(1)}%)`);
console.log('无需处理的条目:', noActionCount, `(${(noActionCount/analysis.length*100).toFixed(1)}%)`);

// 输出需要复核的条目
const needActionMd = `# 需复核的 Non-High 截断 (${needActionCount} 个)

${analysis.filter(a => a.needAction).map(a => `
## 批次 ${a.batchId} | 【【${a.truncId}】】

- **截断原文**: "${a.truncText}"
- **已提取的 high 名词**: ${a.highNouns.length > 0 ? a.highNouns.join(', ') : '(无)'}
- **Non-high 名词**: \`${a.nonHighNoun}\` (${a.nonHighConfidence})
- **名词在截断里**: ${a.nounInText ? '✅' : '❌'}
- **判断**: ${a.judgment}
- **原因**: ${a.reason}

---
`).join('\n')}
`;

fs.writeFileSync('s1-nonhigh-final-review.md', needActionMd, 'utf-8');
fs.writeFileSync('s1-nonhigh-final-analysis.json', JSON.stringify({
  meta: {
    total: analysis.length,
    needAction: needActionCount,
    noAction: noActionCount,
  },
  analysis,
}, null, 2), 'utf-8');

console.log('\n已保存:');
console.log('- s1-nonhigh-final-review.md (需复核的条目)');
console.log('- s1-nonhigh-final-analysis.json (完整分析结果)');
