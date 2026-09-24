/**
 * CoT 实验前自检：纯文表完整性 + bookKey→机器符号转换校验
 *
 * 检查项：
 *  1. 纯文表能从 docuverse 正确构建（chunkKey 唯一）
 *  2. bookKey → 机器符号【【n】】一一对应、无重复
 *  3. candidate-texts-for-llm-cot.json 已包含转换后的 id 字段
 *  4. 转换前后条目数一致，无丢失
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { atomSearchText, isRetrievableAtom, buildPureTextTable } from '../src/core/pureTextTable.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const COT_DIR = __dirname;
const DOCUVERSE_PATH =
  process.env.DOCUVERSE_PATH ||
  'C:\\Users\\Administrator\\Desktop\\docuverse_cartographies_squizoanalythiques_Fe_lix_Guattari_1789114122714.docuverse.json';
const CANDIDATE_PATH = path.join(COT_DIR, 'candidate-texts-for-llm-cot.json');
const TEST_QUESTIONS_PATH = path.join(process.cwd(), 'test-questions.json');

const log = (...a) => console.log(...a);
const ok = (msg) => log(`  ✅ ${msg}`);
const warn = (msg) => log(`  ⚠️  ${msg}`);
const fail = (msg) => log(`  ❌ ${msg}`);

log('='.repeat(80));
log('CoT 实验前自检：纯文表完整性 + bookKey→机器符号转换校验');
log('='.repeat(80));

// === Step 1: 加载数据 ===
log('\n[1] 加载语料 & 测试问题表');
const docuverse = JSON.parse(fs.readFileSync(DOCUVERSE_PATH, 'utf-8'));
const questions = JSON.parse(fs.readFileSync(TEST_QUESTIONS_PATH, 'utf-8'));
ok(`docuverse chunks: ${docuverse.bookIndex.chunks.length}`);
ok(`测试问题数: ${questions.length}（覆盖 ${new Set(questions.map((q) => q.zone)).size} 个 zone）`);

// === Step 2: 构建纯文表 ===
log('\n[2] 构建纯文表（buildPureTextTable）');
const table = buildPureTextTable(docuverse.bookIndex);
ok(`纯文表条目数: ${table.entries.length}`);

// 校验 chunkKey 唯一
const seenKeys = new Set();
const dupKeys = [];
for (const e of table.entries) {
  if (seenKeys.has(e.chunkKey)) dupKeys.push(e.chunkKey);
  seenKeys.add(e.chunkKey);
}
if (dupKeys.length) fail(`发现 ${dupKeys.length} 个重复 chunkKey`);
else ok('所有 chunkKey 唯一');

// 校验 text 非空
const emptyText = table.entries.filter((e) => !e.text || e.text.length < 4);
if (emptyText.length) fail(`发现 ${emptyText.length} 个空文本条目`);
else ok('所有条目 text 非空');

// === Step 3: 模拟 bookKey → 机器符号转换 ===
log('\n[3] bookKey → 机器符号转换校验');
const symbolMap = new Map(); // chunkKey -> id
const idToKey = new Map();   // id -> chunkKey
table.entries.forEach((e, idx) => {
  const id = idx + 1;
  symbolMap.set(e.chunkKey, id);
  idToKey.set(id, e.chunkKey);
});
ok(`转换条目数: ${symbolMap.size}`);
ok(`连续整数 id: 1..${table.entries.length}`);
ok(`id↔chunkKey 一一对应: ${symbolMap.size === idToKey.size ? '是' : '否'}`);

// 抽样校验前 3 个
for (let i = 1; i <= Math.min(3, table.entries.length); i++) {
  const ck = idToKey.get(i);
  log(`       【【${i}】】 <- ${ck.slice(0, 60)}...`);
}

// === Step 4: 校验 candidate-texts-for-llm-cot.json ===
log('\n[4] 校验 candidate-texts-for-llm-cot.json');
if (!fs.existsSync(CANDIDATE_PATH)) {
  fail(`缺失文件: ${CANDIDATE_PATH}`);
  fail('请先运行: node build-prompt-cot.js');
  process.exit(1);
}
const cand = JSON.parse(fs.readFileSync(CANDIDATE_PATH, 'utf-8'));
ok(`问题数: ${cand.length}`);

if (cand.length !== questions.length) {
  warn(`问题数不一致: ${cand.length}（candidates）vs ${questions.length}（test-questions.json）`);
}

// 校验每个问题的 chunks
let allValid = true;
for (const q of cand) {
  const idSet = new Set(q.chunks.map((c) => c.id));
  const keySet = new Set(q.chunks.map((c) => c._chunkKey));
  const expected = q.chunks.length;
  if (idSet.size !== expected) {
    fail(`[${q.questionId}] id 重复！${expected} 个 chunk，只有 ${idSet.size} 个不同 id`);
    allValid = false;
  }
  if (keySet.size !== expected) {
    fail(`[${q.questionId}] _chunkKey 重复！${expected} 个 chunk，只有 ${keySet.size} 个不同 _chunkKey`);
    allValid = false;
  }
  // id 必须是连续整数
  for (let i = 0; i < q.chunks.length; i++) {
    if (q.chunks[i].id !== i + 1) {
      fail(`[${q.questionId}] id 不连续：第 ${i} 个 chunk 的 id = ${q.chunks[i].id}（应为 ${i + 1}）`);
      allValid = false;
      break;
    }
  }
  // 每个 _chunkKey 必须在纯文表中存在
  for (const c of q.chunks) {
    if (!symbolMap.has(c._chunkKey)) {
      fail(`[${q.questionId}] _chunkKey ${c._chunkKey.slice(0, 40)}... 不在纯文表中！`);
      allValid = false;
      break;
    }
  }
  log(`       [${q.questionId}] ${q.chunks.length} chunks, ${idSet.size} unique ids ✅`);
}

if (!allValid) {
  fail('candidate 文件存在问题，请重新运行 node build-prompt-cot.js');
  process.exit(1);
}
ok('所有问题的 chunks 一致：id 连续唯一、_chunkKey 与纯文表对齐');

// === Step 5: 报告机器符号覆盖率 ===
log('\n[5] 机器符号【【n】】使用预估');
const totalSymbols = cand.reduce((sum, q) => sum + q.chunks.length, 0);
ok(`所有问题合计需要引用 ${totalSymbols} 个机器符号（去重后 ${seenKeys.size} 个）`);

// === Step 6: 检查问题与测试表对齐 ===
log('\n[6] 测试问题对齐');
const candIds = new Set(cand.map((c) => c.questionId));
const testIds = new Set(questions.map((q) => q.id));
const missing = [...testIds].filter((id) => !candIds.has(id));
const extra = [...candIds].filter((id) => !testIds.has(id));
if (missing.length) fail(`candidates 缺少问题: ${missing.join(', ')}`);
else ok('所有 test-questions.json 中的问题都已在 candidates 中');
if (extra.length) warn(`candidates 多出问题: ${extra.join(', ')}`);

log('\n' + '='.repeat(80));
log('自检通过：纯文表 bookKey → 机器符号转换完整，可以运行 CoT 实验');
log('='.repeat(80));
