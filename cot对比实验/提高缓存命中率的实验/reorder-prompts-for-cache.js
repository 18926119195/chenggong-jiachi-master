/**
 * 提升缓存命中率实验：将 15 个全量 prompt 中的"问题头+要求+格式+规范+策略"
 * 全部移到末尾、把"全量材料"区块挪到最前面。
 *
 * 约束：字字不差，仅换位置（用 indexOf 找到【【全量材料】】的字节位置，按字节切两段、再反向拼接）。
 *
 * 缓存原理：
 *   DeepSeek API 的 prefix cache 命中是从 prompt 开头算起的连续相同前缀。
 *   原顺序：[问题头 + 1446 chunks]   → 每个问题开头不同，cache 命中率=0%
 *   新顺序：[1446 chunks + 问题头]   → 1446 chunks 部分在 15 个问题间完全一致，
 *                                      第二个问题开始就能命中前面 165k tokens 的前缀
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC_DIR = path.resolve(__dirname, '..');
const OUT_DIR = __dirname;
const LOG_PATH = path.join(__dirname, '_reorder_result.txt');

const MARKER = '【【全量材料】】';

const QIDS = [
  'Z1-Q1', 'Z1-Q2', 'Z1-Q3', 'Z1-Q4',
  'Z2-Q1', 'Z2-Q2', 'Z2-Q3', 'Z2-Q4',
  'Z3-Q1', 'Z3-Q2', 'Z3-Q3',
  'Z4-Q1', 'Z4-Q2', 'Z4-Q3', 'Z4-Q4',
];

const lines = [];
const log = (msg) => { console.log(msg); lines.push(msg); };

let totalSrcBytes = 0;
let totalOutBytes = 0;

log('==== CoT 对比实验：缓存命中率优化版（chunks 前置）====');
log(`SRC: ${SRC_DIR}`);
log(`OUT: ${OUT_DIR}`);
log('');

for (const qid of QIDS) {
  const srcPath = path.join(SRC_DIR, `multipath-prompt-cot-${qid}.txt`);
  const outPath = path.join(OUT_DIR, `multipath-prompt-cot-${qid}.txt`);

  if (!fs.existsSync(srcPath)) {
    log(`[FAIL] ${qid}: source not found at ${srcPath}`);
    continue;
  }

  const src = fs.readFileSync(srcPath, 'utf-8');
  const idx = src.indexOf(MARKER);
  if (idx === -1) {
    log(`[FAIL] ${qid}: marker not found`);
    continue;
  }

  const headerPart = src.slice(0, idx);
  const chunksPart = src.slice(idx);
  const swapped = chunksPart + headerPart;

  fs.writeFileSync(outPath, swapped, 'utf-8');

  const srcBytes = Buffer.byteLength(src, 'utf-8');
  const outBytes = Buffer.byteLength(swapped, 'utf-8');
  totalSrcBytes += srcBytes;
  totalOutBytes += outBytes;

  const ok = srcBytes === outBytes ? 'OK' : 'FAIL';
  log(`[${ok}] ${qid}: ${srcBytes.toLocaleString()} -> ${outBytes.toLocaleString()} bytes (split at char ${idx})`);
}

log('');
log(`TOTAL  src=${totalSrcBytes.toLocaleString()} bytes  out=${totalOutBytes.toLocaleString()} bytes  diff=${totalOutBytes - totalSrcBytes}`);

// 抽样校验：Z1-Q1 的 chunks 标记集合是否完整 / 头尾是否字节一致
log('');
log('==== 抽样校验 Z1-Q1 ====');
const sample = 'Z1-Q1';
const srcSample = fs.readFileSync(path.join(SRC_DIR, `multipath-prompt-cot-${sample}.txt`), 'utf-8');
const outSample = fs.readFileSync(path.join(OUT_DIR, `multipath-prompt-cot-${sample}.txt`), 'utf-8');

const re = /【【(\d+)】】/g;
const srcIds = new Set();
const outIds = new Set();
let m;
while ((m = re.exec(srcSample)) !== null) srcIds.add(parseInt(m[1], 10));
const re2 = /【【(\d+)】】/g;
while ((m = re2.exec(outSample)) !== null) outIds.add(parseInt(m[1], 10));
const srcMax = Math.max(...srcIds);
const outMax = Math.max(...outIds);
const idsSameCount = srcIds.size === outIds.size;
const idsSameMax = srcMax === outMax;
log(`  src 文件 chunk id 集合: size=${srcIds.size}, max=${srcMax}`);
log(`  out 文件 chunk id 集合: size=${outIds.size}, max=${outMax}`);
log(`  chunks 部分完整性: ${idsSameCount && idsSameMax ? 'OK' : 'FAIL'}`);

const headerSample = srcSample.slice(0, srcSample.indexOf(MARKER));
const outTail = outSample.slice(outSample.length - headerSample.length);
const headerBytesSame = outTail === headerSample;
log(`  header 段字节级一致: ${headerBytesSame ? 'OK' : 'FAIL'}  (len=${headerSample.length})`);

const swapBytesSame = totalSrcBytes === totalOutBytes;
log(`  全 15 个文件总字节不变: ${swapBytesSame ? 'OK' : 'FAIL'}  (diff=${totalOutBytes - totalSrcBytes})`);

log('');
log(`LOG: ${LOG_PATH}`);
fs.writeFileSync(LOG_PATH, lines.join('\n') + '\n', 'utf-8');
