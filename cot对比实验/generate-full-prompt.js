/**
 * 将 generated-prompts.txt 中的每个问题 prompt 与 full-chunks-.txt 的全量 chunks 合并，
 * 生成完整的 multipath-prompt-cot-<id>.txt（供 run-reasoning-cot.js 使用）。
 *
 * 输入：
 *   generated-prompts.txt  — 每个问题的 prompt 模板（不含 chunk 材料）
 *   full-chunks-.txt      — 全量 1446 chunks（各问题共用同一份）
 *
 * 输出：
 *   cot对比实验/multipath-prompt-cot-<id>.txt  — 合并后的完整 prompt
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const GENERATED_PROMPTS = path.join(ROOT, 'generated-prompts.txt');
const FULL_CHUNKS      = path.join(ROOT, 'cot对比实验', 'full-chunks-.txt');
const OUTPUT_DIR       = path.join(ROOT, 'cot对比实验');

// ── 1. 读取全量 chunks（跳过第一行的问题标题行） ──────────────────────────
const fullChunksRaw = fs.readFileSync(FULL_CHUNKS, 'utf-8');
// full-chunks-.txt 第一行是 "# 全量材料（带机器符号）\n\n问题：...\n材料总数..."，需要跳过
const firstEOL = fullChunksRaw.indexOf('\n');
const secondEOL = fullChunksRaw.indexOf('\n', firstEOL + 1);
const thirdEOL = fullChunksRaw.indexOf('\n', secondEOL + 1);
const chunksSection = fullChunksRaw.slice(thirdEOL + 1).trimStart();
// 去掉末尾的分隔线（如果有）
const chunksBody = chunksSection.replace(/^-{3,}\s*$/gm, '').trimEnd();

console.log(`全量 chunks 字符数: ${chunksBody.length.toLocaleString()}`);

// ── 2. 解析 generated-prompts.txt ──────────────────────────────────────────
const lines = fs.readFileSync(GENERATED_PROMPTS, 'utf-8').split('\n');

const sections = [];
let current = null;

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  const m = line.match(/^PROMPT\s+(\d+)\s+\(([^)]+)\)/);
  if (m) {
    if (current) sections.push(current);
    current = { id: m[2], header: line, promptLines: [], startLine: i + 1 };
  } else if (current) {
    current.promptLines.push(line);
  }
}
if (current) sections.push(current);

console.log(`解析到 ${sections.length} 个问题: ${sections.map(s => s.id).join(', ')}\n`);

// ── 3. 为每个问题生成完整 prompt 并写入文件 ─────────────────────────────────
for (const section of sections) {
  // prompt 模板（去掉开头的空行，使其紧跟在分隔线后）
  const promptTemplate = section.promptLines.join('\n').trim();

  // 组装完整 prompt
  const separator = '='.repeat(48);
  const fullPrompt = [
    separator,
    section.header,
    separator,
    '',
    promptTemplate,
    '',
    separator,
    '【【全量材料】】',
    separator,
    '',
    chunksBody,
    '',
    separator,
  ].join('\n');

  const outPath = path.join(OUTPUT_DIR, `multipath-prompt-cot-${section.id}.txt`);
  fs.writeFileSync(outPath, fullPrompt, 'utf-8');

  const chars = fullPrompt.length;
  // 粗估 token 数（按 3.8 字符/token）
  const estTokens = Math.round(chars / 3.8);
  const chunkCount = (chunksBody.match(/【【\d+】】/g) || []).length;
  console.log(
    `✅ [${section.id}] → ${path.basename(outPath)}` +
    `  (${chars.toLocaleString()} chars ≈ ${estTokens.toLocaleString()} tokens, ${chunkCount} chunks)`
  );
}

console.log('\n全部完成。');
