/**
 * 实验：对比取消字符长度限制前后，送入补缺LLM的残文差异
 * 
 * 1. 读取 s0-quality-report.json 中的 residuals
 * 2. 应用两种过滤规则：
 *    - 原版：包含规则1（长度<8过滤）
 *    - 实验版：去掉规则1
 * 3. 对比：
 *    - 多了多少条残文
 *    - 多了多少字符
 *    - 这些新增残文的具体内容是什么
 * 4. 输出到 experiment-length-filter/ 目录
 */

import fs from 'fs';
import path from 'path';

const REPORT_PATH = path.join(process.cwd(), 's0-quality-report.json');
const OUTPUT_DIR = path.join(process.cwd(), 'experiment-length-filter');

// ========== 停用词和前缀定义（从 s1-llm-fill.js 复制） ==========
const STOPWORDS = new Set([
  'le', 'la', 'les', 'un', 'une', 'des', 'du', 'de', 'et', 'ou', 'mais',
  'donc', 'or', 'ni', 'car', 'si', 'pour', 'par', 'avec', 'sans', 'sous',
  'sur', 'dans', 'en', 'à', 'au', 'aux', 'ce', 'cet', 'cette', 'ces',
  'son', 'sa', 'ses', 'mon', 'ma', 'mes', 'ton', 'ta', 'tes', 'notre',
  'nos', 'votre', 'vos', 'leur', 'leurs', 'il', 'elle', 'on', 'ils', 'elles',
  'je', 'tu', 'nous', 'vous', 'qui', 'que', 'quoi', 'dont', 'où', 'y',
  'lui', 'se', 'ne', 'pas', 'plus', 'tout', 'tous', 'toute', 'toutes',
  'sont', 'est', 'ont', 'a', 'été', 'avoir', 'être', 'faire',
  'chez', 'vers', 'entre', 'depuis', 'pendant', 'après', 'avant',
  'the', 'a', 'an', 'and', 'or', 'but', 'for', 'with', 'of', 'in', 'on', 'at', 'to', 'from',
]);

const COMMON_PREFIXES = ['pré-', 'post-', 'anti-', 'non-', 'auto-', 'co-', 'dé-', 'ré-', 're-', 'sur-', 'sous-', 'inter-', 'intra-', 'extra-'];

// ========== 过滤函数：原版（含长度限制） ==========
function shouldProcessResidual_ORIGINAL(residualText) {
  const trimmed = residualText.trim();
  
  // 规则1: 长度过短（<8字符）
  if (trimmed.length < 8) {
    return false;
  }
  
  // 规则2: 纯标点或数字
  if (/^[\d\s\p{P}]+$/u.test(trimmed)) {
    return false;
  }
  
  // 规则3: 以停用词开头且后续无实质内容
  const firstWord = trimmed.split(/[\s,;:!?\.]+/)[0].toLowerCase();
  if (STOPWORDS.has(firstWord)) {
    const tokens = trimmed.split(/[\s,;:!?\.]+/).map(t => t.toLowerCase()).filter(t => t.length >= 2);
    const hasValidToken = tokens.some(token => !STOPWORDS.has(token) && !/^[\d\p{P}]+$/u.test(token));
    if (!hasValidToken) {
      return false;
    }
  }
  
  // 规则4: 纯虚词组合
  const words = trimmed.split(/[\s,;:!?\.]+/).filter(w => w.length >= 2);
  if (words.length > 0) {
    const allStopwords = words.every(w => STOPWORDS.has(w.toLowerCase()) || /^[\d\p{P}]+$/u.test(w));
    if (allStopwords) {
      return false;
    }
  }
  
  // 规则5: 只有单个常见前缀
  if (COMMON_PREFIXES.some(prefix => trimmed.toLowerCase() === prefix || trimmed.toLowerCase() === prefix.slice(0, -1))) {
    return false;
  }
  
  return true;
}

// ========== 过滤函数：实验版（去掉规则1） ==========
function shouldProcessResidual_NO_LENGTH(residualText) {
  const trimmed = residualText.trim();
  
  // 规则1: 已移除长度限制
  
  // 规则2: 纯标点或数字
  if (/^[\d\s\p{P}]+$/u.test(trimmed)) {
    return false;
  }
  
  // 规则3: 以停用词开头且后续无实质内容
  const firstWord = trimmed.split(/[\s,;:!?\.]+/)[0].toLowerCase();
  if (STOPWORDS.has(firstWord)) {
    const tokens = trimmed.split(/[\s,;:!?\.]+/).map(t => t.toLowerCase()).filter(t => t.length >= 2);
    const hasValidToken = tokens.some(token => !STOPWORDS.has(token) && !/^[\d\p{P}]+$/u.test(token));
    if (!hasValidToken) {
      return false;
    }
  }
  
  // 规则4: 纯虚词组合
  const words = trimmed.split(/[\s,;:!?\.]+/).filter(w => w.length >= 2);
  if (words.length > 0) {
    const allStopwords = words.every(w => STOPWORDS.has(w.toLowerCase()) || /^[\d\p{P}]+$/u.test(w));
    if (allStopwords) {
      return false;
    }
  }
  
  // 规则5: 只有单个常见前缀
  if (COMMON_PREFIXES.some(prefix => trimmed.toLowerCase() === prefix || trimmed.toLowerCase() === prefix.slice(0, -1))) {
    return false;
  }
  
  return true;
}

// ========== 主实验流程 ==========
function main() {
  console.log('========== 实验：字符长度限制影响分析 ==========\n');
  
  // 1. 读取残文数据
  console.log('1. 读取 s0-quality-report.json...');
  const report = JSON.parse(fs.readFileSync(REPORT_PATH, 'utf-8'));
  const allResiduals = report.residuals || [];
  console.log(`   总残文数: ${allResiduals.length}\n`);
  
  // 2. 应用两种过滤规则
  console.log('2. 应用过滤规则...');
  const passedOriginal = [];
  const passedNoLength = [];
  
  for (const residual of allResiduals) {
    if (shouldProcessResidual_ORIGINAL(residual.text)) {
      passedOriginal.push(residual);
    }
    if (shouldProcessResidual_NO_LENGTH(residual.text)) {
      passedNoLength.push(residual);
    }
  }
  
  console.log(`   原版过滤后: ${passedOriginal.length} 条`);
  console.log(`   去掉长度限制后: ${passedNoLength.length} 条\n`);
  
  // 3. 找出差异（新增的残文）
  const originalSet = new Set(passedOriginal.map(r => `${r.chunkKey}:${r.start}:${r.end}`));
  const newResiduals = passedNoLength.filter(r => !originalSet.has(`${r.chunkKey}:${r.start}:${r.end}`));
  
  console.log(`3. 差异分析:`);
  console.log(`   新增残文数: ${newResiduals.length}`);
  
  const newChars = newResiduals.reduce((sum, r) => sum + r.text.length, 0);
  const originalChars = passedOriginal.reduce((sum, r) => sum + r.text.length, 0);
  const totalCharsNoLength = passedNoLength.reduce((sum, r) => sum + r.text.length, 0);
  
  console.log(`   新增字符数: ${newChars}`);
  console.log(`   原版总字符: ${originalChars}`);
  console.log(`   去限制后总字符: ${totalCharsNoLength}`);
  console.log(`   字符增幅: ${(newChars / originalChars * 100).toFixed(2)}%\n`);
  
  // 4. 按长度分组统计新增残文
  const lengthDistribution = {};
  for (const r of newResiduals) {
    const len = r.text.length;
    if (!lengthDistribution[len]) lengthDistribution[len] = [];
    lengthDistribution[len].push(r.text);
  }
  
  console.log('4. 新增残文长度分布:');
  for (const len of Object.keys(lengthDistribution).sort((a, b) => a - b)) {
    console.log(`   长度 ${len}: ${lengthDistribution[len].length} 条`);
  }
  console.log('');
  
  // 5. 输出详细结果
  console.log('5. 输出结果文件...');
  
  fs.writeFileSync(
    path.join(OUTPUT_DIR, 'original-passed.json'),
    JSON.stringify(passedOriginal, null, 2),
    'utf-8'
  );
  
  fs.writeFileSync(
    path.join(OUTPUT_DIR, 'no-length-limit-passed.json'),
    JSON.stringify(passedNoLength, null, 2),
    'utf-8'
  );
  
  fs.writeFileSync(
    path.join(OUTPUT_DIR, 'newly-added.json'),
    JSON.stringify(newResiduals, null, 2),
    'utf-8'
  );
  
  // 生成人类可读的对比报告
  const report_lines = [];
  report_lines.push('========== 实验报告：取消字符长度限制的影响 ==========\n');
  report_lines.push(`总残文数: ${allResiduals.length}`);
  report_lines.push(`原版过滤后: ${passedOriginal.length} 条 (${originalChars} 字符)`);
  report_lines.push(`去限制后: ${passedNoLength.length} 条 (${totalCharsNoLength} 字符)`);
  report_lines.push(`新增: ${newResiduals.length} 条 (${newChars} 字符，+${(newChars / originalChars * 100).toFixed(2)}%)\n`);
  
  report_lines.push('========== 新增残文长度分布 ==========');
  for (const len of Object.keys(lengthDistribution).sort((a, b) => a - b)) {
    report_lines.push(`长度 ${len}: ${lengthDistribution[len].length} 条`);
  }
  report_lines.push('');
  
  report_lines.push('========== 新增残文详细内容（按长度排序） ==========\n');
  for (const len of Object.keys(lengthDistribution).sort((a, b) => a - b)) {
    report_lines.push(`\n--- 长度 ${len} (${lengthDistribution[len].length} 条) ---`);
    for (let i = 0; i < Math.min(lengthDistribution[len].length, 50); i++) {
      report_lines.push(`  "${lengthDistribution[len][i]}"`);
    }
    if (lengthDistribution[len].length > 50) {
      report_lines.push(`  ... (剩余 ${lengthDistribution[len].length - 50} 条省略)`);
    }
  }
  
  fs.writeFileSync(
    path.join(OUTPUT_DIR, 'REPORT.txt'),
    report_lines.join('\n'),
    'utf-8'
  );
  
  console.log(`   ✓ original-passed.json (原版通过的残文)`);
  console.log(`   ✓ no-length-limit-passed.json (去限制后通过的残文)`);
  console.log(`   ✓ newly-added.json (新增的残文)`);
  console.log(`   ✓ REPORT.txt (人类可读的详细报告)\n`);
  
  console.log('========== 实验完成 ==========');
}

main();
