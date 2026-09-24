#!/usr/bin/env node
/**
 * reorganize-to-qfolders.cjs
 *
 * 将 chenggong-jiachi-master/ 根目录的产物，按题号分配到
 * 9.24最终版本/runs/Q01/ ~ Q15/ 子文件夹。
 *
 * 使用前提：
 *   - 阶段 2-5 已完整运行
 *   - chenggong-jiachi-master/ 下存在 noun-recall-results.json、
 *     candidate-texts-for-llm.json、material-traceback-map.json、
 *     execution-summary.json
 *   - chenggong-jiachi-master/snapshots/ 下有快照文件
 *
 * 运行：
 *   node reorganize-to-qfolders.cjs
 */

const fs = require('fs');
const path = require('path');

// 路径：脚本所在目录的父级即 9.24最终版本/
const SCRIPTS_DIR = __dirname;
const PROJECT_ROOT = path.resolve(SCRIPTS_DIR, '..', '..');  // chenggong-jiachi-master/
const RUNS_DIR = path.join(SCRIPTS_DIR, '..', 'runs');       // 9.24最终版本/runs/

// 读取题号列表
const questionsPath = path.join(PROJECT_ROOT, 'test-questions.json');
const questions = JSON.parse(fs.readFileSync(questionsPath, 'utf-8'));
const QIDS = questions.map((q) => q.id);
console.log(`找到 ${QIDS.length} 个题号: ${QIDS.join(', ')}`);

// 读取 execution-summary，建立 callId → QID 映射
const summaryPath = path.join(PROJECT_ROOT, 'execution-summary.json');
let callIdToQid = {};
if (fs.existsSync(summaryPath)) {
  const summary = JSON.parse(fs.readFileSync(summaryPath, 'utf-8'));
  // reasoning 阶段（阶段 5）每题 1 次调用，按 questions 顺序分配最后 N 个 call
  const reasoningCalls = summary.calls.slice(-QIDS.length);
  reasoningCalls.forEach((call, i) => {
    callIdToQid[call.callId] = QIDS[i];
  });
  console.log(`从 execution-summary.json 解析到 ${Object.keys(callIdToQid).length} 个 callId → QID 映射`);
} else {
  console.warn('⚠️  未找到 execution-summary.json，跳过快照映射');
}

// ============ 辅助函数 ============
function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function copyFile(src, dest) {
  if (!fs.existsSync(src)) {
    console.warn(`  ⚠️  源文件不存在: ${src}`);
    return false;
  }
  ensureDir(path.dirname(dest));
  fs.copyFileSync(src, dest);
  return true;
}

function moveFile(src, dest) {
  if (!fs.existsSync(src)) {
    console.warn(`  ⚠️  源文件不存在: ${src}`);
    return false;
  }
  ensureDir(path.dirname(dest));
  fs.unlinkSync(src);
  fs.writeFileSync(dest, fs.readFileSync(src.replace(/\.unlinked$/, '')));
  fs.unlinkSync(src);
  return true;
}

// ============ 步骤 1：创建题号子文件夹 ============
console.log('\n步骤 1: 创建题号子文件夹...');
for (const qid of QIDS) {
  const qDir = path.join(RUNS_DIR, qid);
  const snapDir = path.join(qDir, 'snapshots');
  ensureDir(qDir);
  ensureDir(snapDir);
  console.log(`  ✓ ${qid}/`);
}

// ============ 步骤 2：复制全局共享文件到 runs/ ============
console.log('\n步骤 2: 复制全局共享文件到 runs/...');
const GLOBAL_FILES = [
  'noun-recall-results.json',
  'candidate-texts-for-llm.json',
  'material-traceback-map.json',
];
for (const f of GLOBAL_FILES) {
  const src = path.join(PROJECT_ROOT, f);
  const dest = path.join(RUNS_DIR, f);
  if (copyFile(src, dest)) {
    console.log(`  ✓ ${f} → runs/`);
  } else {
    console.warn(`  ⚠️  跳过 ${f}`);
  }
}

// 复制 execution-summary
if (copyFile(summaryPath, path.join(RUNS_DIR, 'execution-summary.json'))) {
  console.log('  ✓ execution-summary.json → runs/');
}

// ============ 步骤 3：移动逐题文件 ============
console.log('\n步骤 3: 移动逐题 prompt 和输出...');
const movedPrompt = [];
const movedOutput = [];
const missingPrompt = [];
const missingOutput = [];

for (const qid of QIDS) {
  const qDir = path.join(RUNS_DIR, qid);

  const promptSrc = path.join(PROJECT_ROOT, `multipath-prompt-${qid}.txt`);
  const promptDest = path.join(qDir, `multipath-prompt.txt`);

  const outputSrc = path.join(PROJECT_ROOT, `reasoning-output-${qid}.json`);
  const outputDest = path.join(qDir, `reasoning-output.json`);

  if (fs.existsSync(promptSrc)) {
    copyFile(promptSrc, promptDest);
    fs.unlinkSync(promptSrc);
    movedPrompt.push(qid);
  } else {
    missingPrompt.push(qid);
  }

  if (fs.existsSync(outputSrc)) {
    copyFile(outputSrc, outputDest);
    fs.unlinkSync(outputSrc);
    movedOutput.push(qid);
  } else {
    missingOutput.push(qid);
  }
}

console.log(`  ✓ prompt 文件: ${movedPrompt.length} 题已移动 ${movedPrompt.join(', ')}`);
if (missingPrompt.length) console.warn(`  ⚠️  缺失 prompt: ${missingPrompt.join(', ')}`);
console.log(`  ✓ output 文件: ${movedOutput.length} 题已移动 ${movedOutput.join(', ')}`);
if (missingOutput.length) console.warn(`  ⚠️  缺失 output: ${missingOutput.join(', ')}`);

// ============ 步骤 4：分配快照 ============
console.log('\n步骤 4: 分配 LLM 快照到各题...');
const snapshotDir = path.join(PROJECT_ROOT, 'snapshots');

if (!fs.existsSync(snapshotDir)) {
  console.warn('⚠️  未找到 snapshots/ 目录，跳过快照分配');
} else {
  const snapshotFiles = fs.readdirSync(snapshotDir).filter((f) =>
    ['-request.json', '-prompt.txt', '-response.json', '-output.txt'].some((s) =>
      f.endsWith(s)
    )
  );

  // 按 callId 分组（每 4 个文件为一组）
  const callIds = [
    ...new Set(snapshotFiles.map((f) => f.replace(/-(request|prompt|response|output)\..+$/, ''))),
  ];

  let assignedCount = 0;
  let unassignedCount = 0;

  for (const callId of callIds) {
    const targetQid = callIdToQid[callId];
    const targetDir = targetQid
      ? path.join(RUNS_DIR, targetQid, 'snapshots')
      : path.join(RUNS_DIR, '_unassigned', 'snapshots');

    if (!targetQid) {
      // 不在 execution-summary 的 call，标记为 _unassigned
      ensureDir(targetDir);
      unassignedCount++;
    } else {
      assignedCount++;
    }

    for (const ext of ['-request.json', '-prompt.txt', '-response.json', '-output.txt']) {
      const src = path.join(snapshotDir, `${callId}${ext}`);
      const dest = path.join(targetDir, `${callId}${ext}`);
      if (fs.existsSync(src)) {
        copyFile(src, dest);
        fs.unlinkSync(src);
      }
    }
  }

  // 把 _unassigned 的内容合并回 runs/_unassigned/ 并删空目录
  const unassignedDir = path.join(RUNS_DIR, '_unassigned', 'snapshots');
  if (fs.existsSync(unassignedDir) && fs.readdirSync(unassignedDir).length > 0) {
    console.log(`  ℹ  有 ${unassignedCount} 个 call（${callIds.length - assignedCount} 组）无法映射到具体题号，归入 runs/_unassigned/`);
  } else if (fs.existsSync(unassignedDir)) {
    fs.rmdirSync(unassignedDir, { recursive: true });
    const parentDir = path.join(RUNS_DIR, '_unassigned');
    if (fs.readdirSync(parentDir).length === 0) fs.rmdirSync(parentDir);
  }

  console.log(`  ✓ 已分配 ${assignedCount} 个 call 到 runs/<QID>/snapshots/`);
}

// ============ 步骤 5：汇总报告 ============
console.log('\n' + '='.repeat(60));
console.log('✅ reorganize 完成');
console.log('='.repeat(60));

// 打印最终目录树（简化）
console.log('\n最终 runs/ 目录结构预览：');
function printTree(dir, indent = 0) {
  const items = fs.readdirSync(dir);
  items.sort();
  for (const item of items) {
    const full = path.join(dir, item);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      console.log('  '.repeat(indent) + `📁 ${item}/`);
      printTree(full, indent + 1);
    } else {
      console.log('  '.repeat(indent) + `  ${item}`);
    }
  }
}
printTree(RUNS_DIR);
