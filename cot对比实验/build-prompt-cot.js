/**
 * CoT 对比实验：直接用纯文表构建推理输入（实验组一专用）
 *
 * 实验组一：不经过名词召回和拓扑链筛选，
 * 直接把纯文表（全部 chunk）作为材料送入多路径推理。
 *
 * chunkKey → 机器符号【【n】】
 * reasoning_effort = 'high'（开启 DeepThink 思维链）
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { atomSearchText, isRetrievableAtom } from '../src/core/pureTextTable.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const COT_DIR = path.join(__dirname);
const CANDIDATE_PATH = path.join(COT_DIR, 'candidate-texts-for-llm-cot.json');

const DOCUVERSE_PATH = process.env.DOCUVERSE_PATH || 'C:\\Users\\Administrator\\Desktop\\docuverse_cartographies_squizoanalythiques_Fe_lix_Guattari_1789114122714.docuverse.json';

const questionId = process.argv[2];

console.log('='.repeat(80));
console.log('[CoT] 实验组一：直接用纯文表构建推理输入（不经 noun recall）');
console.log('='.repeat(80));

// 加载语料，构建纯文表
const docuverse = JSON.parse(fs.readFileSync(DOCUVERSE_PATH, 'utf-8'));
const questions = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'test-questions.json'), 'utf-8'));

const chunkEntries = [];
for (const chunk of docuverse.bookIndex.chunks) {
  if (!isRetrievableAtom(chunk)) continue;
  const text = atomSearchText(chunk).trim();
  if (!text || text.length < 8) continue;
  chunkEntries.push({ chunkKey: chunk.key, page: chunk.page, text });
}

console.log(`纯文表 chunk 数: ${chunkEntries.length}`);

// 目标问题列表
const qList = questionId
  ? questions.filter((q) => q.id === questionId)
  : questions;

const outputForLLM = [];

for (const q of qList) {
  // 实验组一：全部 chunk 作为材料，不做任何筛选
  // chunkKey 转换为机器符号【【n】】（从 1 开始）
  const llmChunks = chunkEntries.map((entry, idx) => ({
    id: idx + 1,
    nounCount: 0, // 无拓扑链筛选，不记录命中数
    text: entry.text,
    _chunkKey: entry.chunkKey, // 仅调试用
    _page: entry.page,
  }));

  outputForLLM.push({
    questionId: q.id,
    question: q.question,
    zone: q.zone,
    uniqueChunks: llmChunks.length,
    chunks: llmChunks,
  });

  console.log(`  [${q.id}] ${q.question} -> ${llmChunks.length} 个材料（全量，不筛选）`);
}

fs.writeFileSync(CANDIDATE_PATH, JSON.stringify(outputForLLM, null, 2), 'utf-8');
console.log(`\n✅ 已保存: ${CANDIDATE_PATH}`);
console.log(`下一步: node generate-multipath-prompt-cot.js <questionId>`);
