#!/usr/bin/env node
/**
 * 在当前工作目录下运行完整的 15 问题推理流程，并快照所有 LLM 输入输出
 *
 * 功能：
 * 1. 在当前工作目录运行完整推理流程（阶段 2-5）
 * 2. 拦截所有 LLM 调用，快照每次的 prompt + response
 * 3. 保留所有中间数据文件
 * 4. 生成汇总报告
 *
 * 前置条件（必须在当前工作目录下存在）：
 *   - src/core/llmClient.js      （已内置 snapshot 功能）
 *   - src/core/pureTextTable.js
 *   - recall-nouns-llm.js
 *   - build-prompt-with-traceback.js
 *   - generate-multipath-prompt.js
 *   - run-reasoning.js
 *   - final-noun-index.json
 *   - test-questions.json
 *   - noun-blacklist.json
 *   - .env                      （含 API_KEY 等）
 *
 * 用法：
 *   node run-test15-with-snapshot.js
 *
 * 输出（全部写到当前工作目录）：
 *   snapshots/                         ← LLM 调用快照
 *     <QID>/
 *       call-NNNN-request.json
 *       call-NNNN-prompt.txt
 *       call-NNNN-response.json
 *       call-NNNN-output.txt
 *   noun-recall-results.json
 *   candidate-texts-for-llm.json
 *   material-traceback-map.json
 *   multipath-prompt-<QID>.txt   × 15
 *   reasoning-output-<QID>.json  × 15
 *   execution-summary.json
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// 当前工作目录 = 目标目录（由调用方决定）
const CWD = process.cwd();

// llmClient.js 里已改用 process.cwd()，快照会写到 <cwd>/snapshots
const SNAPSHOT_DIR = path.join(CWD, 'snapshots');

console.log('='.repeat(80));
console.log('15 问题完整推理 + LLM 快照');
console.log('='.repeat(80));
console.log(`工作目录: ${CWD}`);
console.log(`快照目录: ${SNAPSHOT_DIR}`);
console.log('='.repeat(80));

// ============ 前置检查 ============
const REQUIRED_FILES = [
  'src/core/llmClient.js',
  'src/core/pureTextTable.js',
  'recall-nouns-llm.js',
  'build-prompt-with-traceback.js',
  'generate-multipath-prompt.js',
  'run-reasoning.js',
  'final-noun-index.json',
  'test-questions.json',
];

for (const f of REQUIRED_FILES) {
  const fullPath = path.join(CWD, f);
  if (!fs.existsSync(fullPath)) {
    console.error(`❌ 缺少必需文件: ${f}（检查路径: ${fullPath}）`);
    process.exit(1);
  }
}

// 创建快照目录（每个问题一个子目录）
if (!fs.existsSync(SNAPSHOT_DIR)) {
  fs.mkdirSync(SNAPSHOT_DIR, { recursive: true });
  console.log(`✓ 创建快照根目录: ${SNAPSHOT_DIR}`);
} else {
  console.log(`快照目录已存在: ${SNAPSHOT_DIR}`);
}

// ============ 加载 .env ============
const envPath = path.join(CWD, '.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  for (const line of envContent.split('\n')) {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      const value = match[2].trim().replace(/^["']|["']$/g, '');
      if (!process.env[key]) {
        process.env[key] = value;
      }
    }
  }
  console.log('✓ 已加载 .env 配置');
} else {
  console.warn('⚠️  未找到 .env 文件');
}

if (!process.env.LLM_API_KEY && !process.env.DEEPSEEK_API_KEY) {
  console.error('❌ 缺少 LLM_API_KEY 或 DEEPSEEK_API_KEY，请在 .env 文件中配置');
  process.exit(1);
}

// ============ 准备 docuverse 路径 ============
const docuverseDefault = 'C:\\Users\\Administrator\\Desktop\\docuverse_cartographies_squizoanalythiques_Fe_lix_Guattari_1789114122714.docuverse.json';
const DOCUVERSE_PATH = process.env.DOCUVERSE_PATH || docuverseDefault;
console.log(`docuverse 路径: ${DOCUVERSE_PATH}`);

// ============ 主流程执行 ============
const startTime = Date.now();
const NODE_EXE = process.execPath;

const runEnv = {
  ...process.env,
  DOCUVERSE_PATH,
};

function runStep(label, command) {
  console.log(`\n${'='.repeat(80)}`);
  console.log(label);
  console.log('='.repeat(80));
  try {
    execSync(`"${NODE_EXE}" ${command}`, {
      cwd: CWD,
      stdio: 'inherit',
      env: runEnv,
    });
  } catch (err) {
    console.error(`\n❌ 流程失败: ${label}`);
    console.error(err.message);
    process.exit(1);
  }
}

// 阶段 2：名词召回（粗筛 + 精打分）
runStep('阶段 2: 名词召回', 'recall-nouns-llm.js');

// 阶段 3：构建推理输入
runStep('阶段 3: 构建推理输入', 'build-prompt-with-traceback.js');

// 阶段 4-5：逐题生成 Prompt + 跑推理
const QUESTIONS_FILE = process.env.QUESTIONS_PATH || path.join(CWD, 'test-questions.json');
const questions = JSON.parse(
  fs.readFileSync(QUESTIONS_FILE, 'utf-8')
);

console.log(`\n${'='.repeat(80)}`);
console.log(`阶段 4-5: 生成 Prompt 并执行推理（${questions.length} 题）`);
console.log('='.repeat(80));

for (const q of questions) {
  runStep(`阶段 4: 生成 Prompt [${q.id}]`, `generate-multipath-prompt.js ${q.id}`);
  runStep(`阶段 5: 执行推理 [${q.id}]`,   `run-reasoning.js ${q.id}`);
}

const totalElapsed = ((Date.now() - startTime) / 1000 / 60).toFixed(1);

// ============ 生成汇总报告 ============
console.log('\n' + '='.repeat(80));
console.log('✅ 完整推理流程执行完毕');
console.log('='.repeat(80));
console.log(`总耗时: ${totalElapsed} 分钟`);

const snapshotFiles = fs.readdirSync(SNAPSHOT_DIR).filter(
  (f) => f.endsWith('-response.json')
);

const summary = {
  executionTime: totalElapsed + ' minutes',
  totalLLMCalls: snapshotFiles.length,
  calls: [],
};

for (const file of snapshotFiles.sort()) {
  try {
    const data = JSON.parse(
      fs.readFileSync(path.join(SNAPSHOT_DIR, file), 'utf-8')
    );
    summary.calls.push({
      callId: data.callId,
      success: data.success,
      elapsed: ((data.elapsed || 0) / 1000).toFixed(1) + 's',
      promptTokens: data.response?.usage?.prompt_tokens,
      completionTokens: data.response?.usage?.completion_tokens,
      totalTokens: data.response?.usage?.total_tokens,
      truncated: data.response?.truncated,
    });
  } catch {
    // 跳过无法解析的快照文件
  }
}

fs.writeFileSync(
  path.join(CWD, 'execution-summary.json'),
  JSON.stringify(summary, null, 2),
  'utf-8'
);

console.log(`LLM 调用总次数: ${summary.totalLLMCalls}`);
console.log(`快照目录: ${SNAPSHOT_DIR}`);
console.log(`汇总报告: ${path.join(CWD, 'execution-summary.json')}`);
console.log('\n中间数据文件:');
console.log('  noun-recall-results.json');
console.log('  candidate-texts-for-llm.json');
console.log('  material-traceback-map.json');
console.log('  multipath-prompt-*.txt  × 15');
console.log('  reasoning-output-*.json × 15');
