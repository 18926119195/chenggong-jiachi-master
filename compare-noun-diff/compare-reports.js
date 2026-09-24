/**
 * 对比分析脚本：对比旧版 vs 新版终词表
 * 
 * 对比维度：
 * 1. 整体统计（词条数、位置数、去重率）
 * 2. s1 新增词条（s1 有但旧词表没有的）
 * 3. 旧词表独有词条（旧词表有但新版没有的）
 * 4. 位置数变化最大的词条
 */
import fs from 'fs';
import path from 'path';

const COMPARE_DIR = path.join(process.cwd());
const OLD_PATH = path.join(COMPARE_DIR, 'final-noun-index-old.json');
const NEW_PATH = path.join(COMPARE_DIR, 'final-noun-index-new.json');
const OLD_S1_PATH = path.join(COMPARE_DIR, 's1-nouns-with-offsets-old.json');
const NEW_S1_PATH = path.join(COMPARE_DIR, 's1-nouns-with-offsets-new.json');
const REPORT_PATH = path.join(COMPARE_DIR, 'comparison-report.txt');

const oldData = JSON.parse(fs.readFileSync(OLD_PATH, 'utf-8'));
const newData = JSON.parse(fs.readFileSync(NEW_PATH, 'utf-8'));
const oldS1 = JSON.parse(fs.readFileSync(OLD_S1_PATH, 'utf-8'));
const newS1 = JSON.parse(fs.readFileSync(NEW_S1_PATH, 'utf-8'));

const oldNouns = new Map(oldData.nouns.map(n => [n.id, n]));
const newNouns = new Map(newData.nouns.map(n => [n.id, n]));
const oldS1Ids = new Set(oldS1.nouns.map(n => n.id));
const newS1Ids = new Set(newS1.nouns.map(n => n.id));

// 词条级差异
const onlyInOld = [...oldNouns.keys()].filter(id => !newNouns.has(id));
const onlyInNew = [...newNouns.keys()].filter(id => !oldNouns.has(id));
const inBoth   = [...newNouns.keys()].filter(id => oldNouns.has(id));

// s1 新增（新版 s1 有但旧版 s1 没有）
const newS1Only = [...newS1Ids].filter(id => !oldS1Ids.has(id));
const lostS1   = [...oldS1Ids].filter(id => !newS1Ids.has(id));

// 位置数变化
const offsetChanges = [];
for (const id of inBoth) {
  const oldOff = oldNouns.get(id).offsets.length;
  const newOff = newNouns.get(id).offsets.length;
  if (oldOff !== newOff) {
    offsetChanges.push({ id, surface: newNouns.get(id).surface, oldOff, newOff, diff: newOff - oldOff });
  }
}
offsetChanges.sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff));

// 统计
const lines = [];
lines.push('============================================================');
lines.push('  名词表对比报告');
lines.push(`  生成时间: ${new Date().toLocaleString('zh-CN')}`);
lines.push('============================================================');
lines.push('');
lines.push('【1. 整体统计】');
lines.push('');
lines.push(`                        旧版(16:10)      新版(16:36)      变化`);
lines.push(`  ─────────────────────────────────────────────────────────`);
lines.push(`  终词表总词条数       ${String(oldData.meta.totalNouns).padStart(8)}    ${String(newData.meta.totalNouns).padStart(8)}    ${String(newData.meta.totalNouns - oldData.meta.totalNouns).padStart(8)}`);
lines.push(`  s0 贡献词条数        ${String(oldData.meta.s0Count).padStart(8)}    ${String(newData.meta.s0Count).padStart(8)}    ${String(newData.meta.s0Count - oldData.meta.s0Count).padStart(8)}`);
lines.push(`  s1 贡献词条数        ${String(oldData.meta.s1Count).padStart(8)}    ${String(newData.meta.s1Count).padStart(8)}    ${String(newData.meta.s1Count - oldData.meta.s1Count).padStart(8)}`);
lines.push(`  总位置数             ${String(oldData.meta.totalOffsets).padStart(8)}    ${String(newData.meta.totalOffsets).padStart(8)}    ${String(newData.meta.totalOffsets - oldData.meta.totalOffsets).padStart(8)}`);
lines.push(`  平均每词位置         ${(oldData.meta.totalOffsets / oldData.meta.totalNouns).toFixed(2).padStart(8)}    ${(newData.meta.totalOffsets / newData.meta.totalNouns).toFixed(2).padStart(8)}    ${((newData.meta.totalOffsets / newData.meta.totalNouns) - (oldData.meta.totalOffsets / oldData.meta.totalNouns)).toFixed(2).padStart(8)}`);
lines.push('');
lines.push(`  s1 原始输出          ${String(oldS1.meta.outputNouns).padStart(8)}    ${String(newS1.meta.outputNouns).padStart(8)}    ${String(newS1.meta.outputNouns - oldS1.meta.outputNouns).padStart(8)}`);
lines.push(`  s1 残留截断          ${String(oldS1.meta.inputTruncations).padStart(8)}    ${String(newS1.meta.inputTruncations).padStart(8)}    ${String(newS1.meta.inputTruncations - oldS1.meta.inputTruncations).padStart(8)}`);
lines.push(`  s1 LLM token         ${String(oldS1.meta.tokenUsage?.totalTokens || '-').padStart(8)}    ${String(newS1.meta.tokenUsage?.totalTokens || '-').padStart(8)}    ${String((newS1.meta.tokenUsage?.totalTokens || 0) - (oldS1.meta.tokenUsage?.totalTokens || 0)).padStart(8)}`);
lines.push('');
lines.push('【2. 终词表词条差异】');
lines.push('');
lines.push(`  旧版独有词条（消失了）: ${onlyInOld.length} 个`);
if (onlyInOld.length > 0) {
  lines.push(`    ${onlyInOld.slice(0, 30).map(id => oldNouns.get(id).surface).join(', ')}${onlyInOld.length > 30 ? '...' : ''}`);
}
lines.push(`  新版独有词条（新增）: ${onlyInNew.length} 个`);
if (onlyInNew.length > 0) {
  lines.push(`    ${onlyInNew.slice(0, 30).map(id => newNouns.get(id).surface).join(', ')}${onlyInNew.length > 30 ? '...' : ''}`);
}
lines.push(`  两版共有词条: ${inBoth.length} 个`);
lines.push('');
lines.push('【3. s1 原始输出差异】');
lines.push('');
lines.push(`  旧版 s1 有，新版 s1 没有（丢失）: ${lostS1.length} 个`);
if (lostS1.length > 0) {
  lines.push(`    ${lostS1.slice(0, 30).join(', ')}${lostS1.length > 30 ? '...' : ''}`);
}
lines.push(`  新版 s1 有，旧版 s1 没有（新增）: ${newS1Only.length} 个`);
if (newS1Only.length > 0) {
  lines.push(`    ${newS1Only.slice(0, 30).join(', ')}${newS1Only.length > 30 ? '...' : ''}`);
}
lines.push('');
lines.push('【4. 位置数变化最大的词条（TOP20）】');
lines.push('');
lines.push(`  ${'词条'.padEnd(30)} ${'旧位置'.padStart(6)} ${'新位置'.padStart(6)} ${'变化'.padStart(6)}`);
lines.push(`  ${'─'.repeat(52)}`);
for (const c of offsetChanges.slice(0, 20)) {
  lines.push(`  ${c.surface.padEnd(30)} ${String(c.oldOff).padStart(6)} ${String(c.newOff).padStart(6)} ${(c.diff > 0 ? '+' : '') + c.diff.toString().padStart(5)}`);
}
lines.push('');
lines.push('【5. 新增词条详细列表（s1 来源，按位置数降序）】');
lines.push('');
const newEntries = onlyInNew
  .map(id => newNouns.get(id))
  .filter(n => n.source === 's1-llm')
  .sort((a, b) => b.offsets.length - a.offsets.length)
  .slice(0, 50);
for (const e of newEntries) {
  lines.push(`  ${e.surface.padEnd(35)} (${e.offsets.length}处) [s1-llm]`);
}
if (onlyInNew.filter(id => newNouns.get(id)?.source === 's1-llm').length > 50) {
  lines.push(`  ... 等等（共 ${onlyInNew.filter(id => newNouns.get(id)?.source === 's1-llm').length} 个 s1 新增词条）`);
}
lines.push('');
lines.push('【6. 消失词条（s1 来源，旧版有，新版没有）】');
lines.push('');
const lostEntries = onlyInOld
  .map(id => oldNouns.get(id))
  .filter(n => n.source === 's1-llm')
  .sort((a, b) => b.offsets.length - a.offsets.length)
  .slice(0, 50);
for (const e of lostEntries) {
  lines.push(`  ${e.surface.padEnd(35)} (${e.offsets.length}处) [s1-llm]`);
}
if (onlyInOld.filter(id => oldNouns.get(id)?.source === 's1-llm').length > 50) {
  lines.push(`  ... 等等（共 ${onlyInOld.filter(id => oldNouns.get(id)?.source === 's1-llm').length} 个）`);
}
lines.push('');
lines.push('============================================================');
lines.push(`  报告生成完毕`);
lines.push('============================================================');

const report = lines.join('\n');
fs.writeFileSync(REPORT_PATH, report, 'utf-8');

console.log(report);
console.log(`\n报告已保存到: ${REPORT_PATH}`);
