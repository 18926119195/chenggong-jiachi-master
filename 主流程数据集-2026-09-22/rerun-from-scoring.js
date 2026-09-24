#!/usr/bin/env node
/**
 * 从已有粗筛结果重新执行：精打分 + 多路径 Prompt 构建 + 推理
 * 跳过粗筛阶段，直接使用 noun-recall-results.json
 */

import { config } from 'dotenv';
config();

import fs from 'fs';
import path from 'path';

// 动态导入以确保 env 先加载
const { callLLM } = await import('./src/core/llmClient.js');

const TARGET_DIR = 'C:\\Users\\Administrator\\Desktop\\2026-09-21-master\\主流程数据集-2026-09-22';
const SOURCE_DIR = 'C:\\Users\\Administrator\\Desktop\\2026-09-21-master';
const NOUN_RECALL_FILE = path.join(SOURCE_DIR, 'noun-recall-results.json');
const NOUN_RECALL_OUTPUT = path.join(TARGET_DIR, 'noun-recall-results.json');

if (!fs.existsSync(NOUN_RECALL_FILE)) {
  console.error(`❌ 找不到粗筛结果文件: ${NOUN_RECALL_FILE}`);
  process.exit(1);
}

const recallResults = JSON.parse(fs.readFileSync(NOUN_RECALL_FILE, 'utf8'));
console.log(`已加载 ${recallResults.length} 个问题的粗筛结果`);

// 1. 重新执行精打分
console.log('\n========== 步骤1: 重新精打分 ==========');
for (const qData of recallResults) {
  console.log(`\n处理问题: ${qData.questionId}`);
  console.log(`  粗筛 YES 词数: ${qData.coarseYesCount}`);
  
  // 构造精打分 prompt
  const yesNouns = qData.scoredNouns.map(n => n.surface);
  const scorePrompt = buildScorePrompt(qData.question, yesNouns);
  
  console.log(`  精打分 LLM 调用...`);
  const res = await callLLM(scorePrompt, { maxTokens: 32768 });
  
  if (!res || !res.text) {
    console.error(`  ❌ 精打分失败: LLM 未返回有效结果`);
    continue;
  }
  
  // 解析分数
  const scores = parseScores(res.text);
  console.log(`  ✓ 解析出 ${scores.length} 个分数`);
  
  // 更新 scoredNouns
  qData.scoredNouns.forEach((noun, i) => {
    noun.score = scores[i] ?? 0;
  });
  
  // 更新 token 统计
  qData.tokenCost.scorePromptTokens = res.usage?.prompt_tokens ?? 0;
  qData.tokenCost.scoreCompletionTokens = res.usage?.completion_tokens ?? 0;
  qData.tokenCost.totalPromptTokens = qData.tokenCost.coarsePromptTokens + qData.tokenCost.scorePromptTokens;
  qData.tokenCost.totalCompletionTokens = qData.tokenCost.coarseCompletionTokens + qData.tokenCost.scoreCompletionTokens;
  
  // 重新筛选高分词
  const highScored = qData.scoredNouns.filter(n => n.score >= qData.scoreThreshold);
  qData.highScoredCount = highScored.length;
  qData.selectedCount = Math.min(highScored.length, 100);
  
  console.log(`  高分词(>=${qData.scoreThreshold}): ${qData.highScoredCount} 个`);
}

// 保存更新后的召回结果（写入目标目录，供后续步骤使用）
fs.writeFileSync(NOUN_RECALL_OUTPUT, JSON.stringify(recallResults, null, 2), 'utf8');
console.log(`\n✓ 更新后的召回结果已保存: ${NOUN_RECALL_OUTPUT}`);

// 2. 重新生成多路径 prompt
console.log('\n========== 步骤2: 重新生成多路径 Prompt ==========');
const { execSync } = await import('child_process');
const NODE_BIN = '"C:\\Program Files\\nodejs\\node.exe"';
execSync(`${NODE_BIN} build-prompt-with-traceback.js`, {
  cwd: TARGET_DIR,
  stdio: 'inherit'
});

// 3. 重新执行推理
console.log('\n========== 步骤3: 重新执行推理 ==========');
for (const qData of recallResults) {
  console.log(`\n推理问题: ${qData.questionId}`);
  execSync(`${NODE_BIN} run-reasoning.js ${qData.questionId}`, {
    cwd: TARGET_DIR,
    stdio: 'inherit'
  });
}

console.log('\n========== 完成 ==========');

// ========== 辅助函数 ==========

function buildScorePrompt(question, yesNounSurfaces) {
  const list = yesNounSurfaces.map((w, i) => `【【${i + 1}】】${w}`).join('\n');
  return `问题: ${question}

以下是你选中的相关词，请按重要程度打分（1-100）：
  1-30   弱相关：领域相关但非核心，仅提及
  31-60  中等相关：对答案有一定贡献
  61-80  强相关：重要概念，显著影响答案质量
  81-100 核心概念：没有它就无法准确回答

词语列表：
${list}

输出格式要求：
- 只输出【【N】】分数，每行一个，不要任何解释或额外文字
- 例如：【【1】】95
- 不要输出：【【1】】95（这个词很重要因为...）← 错误
- 不要使用思维链，不要推理过程，直接给出分数
- 严格按格式，开始输出：`;
}

function parseScores(text) {
  const lines = text.split('\n').filter(l => l.trim());
  const scores = [];
  const re = /【【(\d+)】】\s*(\d+)/;
  for (const line of lines) {
    const m = line.match(re);
    if (m) {
      scores.push(parseInt(m[2], 10));
    }
  }
  return scores;
}
