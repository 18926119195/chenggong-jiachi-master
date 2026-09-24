#!/usr/bin/env node
/**
 * 深度分析 15 个问题的 prompt 相似度、缓存命中率和 token 消耗
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, 'cot对比实验');
const LOG_DIR = path.join(ROOT, 'logs');
const SNAP_DIR = path.join(ROOT, 'snapshots');
const OUT_DIR = ROOT;

const QIDS = [];
for (let z = 1; z <= 4; z++) {
  for (let q = 1; q <= 4; q++) {
    QIDS.push(`Z${z}-Q${q}`);
  }
}

// ========== 1. 读取每个 prompt 快照，提取结构 ==========
function readSnapshot(qid) {
  const p = path.join(SNAP_DIR, `cot-input-${qid}.txt`);
  return fs.readFileSync(p, 'utf8');
}

// ========== 2. 解析日志：提取缓存命中率和 token 数 ==========
function parseLog(qid) {
  const logPath = path.join(LOG_DIR, `cot-run-${qid}.log`);
  const text = fs.readFileSync(logPath, 'utf8');
  const result = {};

  // 提取 HTTP response 中的 usage 块
  // 找到所有类似 "usage: { ... }" 块
  const usageMatches = text.matchAll(/\{[^{}]*"prompt_tokens"\s*:\s*\d+[^{}]*\}/g);
  const usages = [];
  for (const m of usageMatches) {
    try {
      usages.push(JSON.parse(m[0]));
    } catch (e) {}
  }

  // 提取 cache hit
  const cacheHits = [];
  for (const u of usages) {
    const hit = u.prompt_cache_hit_tokens
      ?? u.prompt_tokens_details?.cached_tokens
      ?? 0;
    cacheHits.push({
      prompt_tokens: u.prompt_tokens,
      completion_tokens: u.completion_tokens,
      total_tokens: u.total_tokens,
      cached_tokens: hit,
    });
  }

  // 提取 duration
  const durMatch = text.match(/duration[：:]\s*(\d+\.?\d*)\s*s/);
  const duration = durMatch ? parseFloat(durMatch[1]) : null;

  // 提取 status
  const successMatch = text.match(/status[：:]\s*success|✅/);
  const status = successMatch ? 'success' : 'unknown';

  result.usages = cacheHits;
  result.duration = duration;
  result.status = status;
  return result;
}

// ========== 3. 计算两两 prompt 的最长公共前缀（字节级别） ==========
function longestCommonPrefix(s1, s2) {
  const n = Math.min(s1.length, s2.length);
  let i = 0;
  while (i < n && s1[i] === s2[i]) i++;
  return i;
}

// ========== 4. 找出每个 prompt 的关键分界点（问题文本位置） ==========
function findQuestionPosition(snap) {
  // 找到 "问题：" 字符串的位置
  const m = snap.match(/问题[：:]/);
  return m ? m.index : -1;
}

// ========== 5. 主流程 ==========
console.log('='.repeat(80));
console.log('第一部分：每个问题的 token 使用和缓存命中率');
console.log('='.repeat(80));

const stats = [];
for (const qid of QIDS) {
  const r = parseLog(qid);
  // 累加所有请求的 tokens
  const totalPrompt = r.usages.reduce((s, u) => s + (u.prompt_tokens || 0), 0);
  const totalCompletion = r.usages.reduce((s, u) => s + (u.completion_tokens || 0), 0);
  const totalCached = r.usages.reduce((s, u) => s + (u.cached_tokens || 0), 0);
  const hitRate = totalPrompt > 0 ? (totalCached / totalPrompt * 100).toFixed(2) : '0.00';

  stats.push({
    qid,
    duration: r.duration,
    numRequests: r.usages.length,
    promptTokens: totalPrompt,
    completionTokens: totalCompletion,
    cachedTokens: totalCached,
    hitRate,
  });
}

console.log('\n| 问题     | 耗时(s) | 请求数 | prompt_tokens | completion_tokens | cached_tokens | 命中率 |');
console.log('|----------|---------|--------|---------------|-------------------|---------------|--------|');
for (const s of stats) {
  console.log(`| ${s.qid.padEnd(7)} | ${String(s.duration).padEnd(7)} | ${String(s.numRequests).padEnd(6)} | ${String(s.promptTokens).padEnd(13)} | ${String(s.completionTokens).padEnd(17)} | ${String(s.cachedTokens).padEnd(13)} | ${s.hitRate}% |`);
}

// ========== 第二部分：prompt 相似度分析 ==========
console.log('\n' + '='.repeat(80));
console.log('第二部分：每个 prompt 的快照长度和"问题："位置');
console.log('='.repeat(80));

const snaps = {};
for (const qid of QIDS) {
  const s = readSnapshot(qid);
  snaps[qid] = s;
  const qPos = findQuestionPosition(s);
  console.log(`${qid}: 长度=${s.length}, "问题："位置=${qPos} (${qPos >= 0 ? (qPos/s.length*100).toFixed(1)+'%' : 'N/A'})`);
}

// ========== 第三部分：两两 prompt 的最长公共前缀长度 ==========
console.log('\n' + '='.repeat(80));
console.log('第三部分：两两 prompt 的最长公共前缀（字节数）');
console.log('='.repeat(80));

const prefixes = {};
for (let i = 0; i < QIDS.length; i++) {
  prefixes[QIDS[i]] = {};
  for (let j = 0; j < QIDS.length; j++) {
    if (i === j) continue;
    if (!(QIDS[j] in prefixes[QIDS[i]])) {
      const lcp = longestCommonPrefix(snaps[QIDS[i]], snaps[QIDS[j]]);
      prefixes[QIDS[i]][QIDS[j]] = lcp;
    }
  }
}

// 打印关键对比：每个 prompt 与 Z1-Q1 的 LCP
console.log('\n与 Z1-Q1 的最长公共前缀：');
for (const qid of QIDS) {
  if (qid === 'Z1-Q1') continue;
  const lcp = prefixes[qid]['Z1-Q1'];
  const z1Snap = snaps['Z1-Q1'];
  console.log(`  ${qid} vs Z1-Q1: ${lcp} 字节 (${(lcp/z1Snap.length*100).toFixed(1)}% of Z1-Q1)`);
}

console.log('\n与 Z1-Q2 的最长公共前缀：');
for (const qid of QIDS) {
  if (qid === 'Z1-Q2') continue;
  const lcp = prefixes[qid]['Z1-Q2'];
  const z1Snap = snaps['Z1-Q2'];
  console.log(`  ${qid} vs Z1-Q2: ${lcp} 字节 (${(lcp/z1Snap.length*100).toFixed(1)}% of Z1-Q2)`);
}

// ========== 第四部分：寻找"分叉点"——前 N 字节相同的部分 ==========
console.log('\n' + '='.repeat(80));
console.log('第四部分：寻找所有 prompt 的共同前缀');
console.log('='.repeat(80));

const allSnaps = QIDS.map(q => snaps[q]);
let commonPrefixLen = allSnaps[0].length;
for (let i = 1; i < allSnaps.length; i++) {
  commonPrefixLen = Math.min(commonPrefixLen, longestCommonPrefix(allSnaps[0], allSnaps[i]));
}
const commonSnap = allSnaps[0].slice(0, commonPrefixLen);
console.log(`所有 15 个 prompt 的共同前缀: ${commonPrefixLen} 字节`);
console.log('共同前缀末尾 200 字节（用于查看在哪个位置分叉）：');
console.log('---');
console.log(commonSnap.slice(-200));
console.log('---');

// ========== 第五部分：分析 Z1-Q1, Z1-Q3, Z1-Q4 三个问题开头的差异 ==========
console.log('\n' + '='.repeat(80));
console.log('第五部分：Z1 系列 4 个 prompt 的差异部分（前 600 字节）');
console.log('='.repeat(80));

for (const qid of ['Z1-Q1', 'Z1-Q2', 'Z1-Q3', 'Z1-Q4']) {
  console.log(`\n--- ${qid} (前 600 字节) ---`);
  console.log(snaps[qid].slice(0, 600));
}

// ========== 第六部分：检查每个 prompt 在"问题"之前有多少内容是共享的 ==========
console.log('\n' + '='.repeat(80));
console.log('第六部分：在"问题："之前，两两 prompt 的最长公共前缀');
console.log('='.repeat(80));

// 先找出每个 prompt "问题：" 之前的部分
const beforeQuestion = {};
for (const qid of QIDS) {
  const pos = findQuestionPosition(snaps[qid]);
  beforeQuestion[qid] = pos >= 0 ? snaps[qid].slice(0, pos) : snaps[qid];
}

// 计算每个 prompt 与其他 14 个 prompt 在"问题："之前的 LCP
const beforeLCP = {};
for (const qid of QIDS) {
  beforeLCP[qid] = {};
  for (const other of QIDS) {
    if (qid === other) continue;
    beforeLCP[qid][other] = longestCommonPrefix(beforeQuestion[qid], beforeQuestion[other]);
  }
}

// 对每个 qid，计算与所有其他的平均 LCP
console.log('\n每个 prompt 与其他 14 个在"问题："之前的平均 LCP 字节数：');
for (const qid of QIDS) {
  const lens = Object.values(beforeLCP[qid]);
  const avg = lens.reduce((s, x) => s + x, 0) / lens.length;
  const min = Math.min(...lens);
  console.log(`  ${qid}: 平均=${avg.toFixed(0)}, 最小=${min} 字节`);
}

// ========== 第七部分：把"问题："之前所有 prompt 的 LCP 找出来 ==========
console.log('\n' + '='.repeat(80));
console.log('第七部分：所有 prompt 在"问题："之前的共同前缀');
console.log('='.repeat(80));

let allBeforeLCP = beforeQuestion[QIDS[0]].length;
for (let i = 1; i < QIDS.length; i++) {
  allBeforeLCP = Math.min(allBeforeLCP, longestCommonPrefix(beforeQuestion[QIDS[0]], beforeQuestion[QIDS[i]]));
}
console.log(`所有 15 个 prompt 在"问题："之前的共同前缀: ${allBeforeLCP} 字节`);
console.log(`（如果此值 < 各 prompt 的总长度，则意味着"问题："之前就已经开始分叉）`);

// ========== 第八部分：单独看 Z4-Q4 为什么这么快 ==========
console.log('\n' + '='.repeat(80));
console.log('第八部分：Z4-Q4 输出检查');
console.log('='.repeat(80));
const z4q4Output = JSON.parse(fs.readFileSync(path.join(OUT_DIR, 'reasoning-output-cot-Z4-Q4.json'), 'utf8'));
console.log('Z4-Q4 顶层 keys:', Object.keys(z4q4Output));
if (z4q4Output.content) {
  console.log('Z4-Q4 content 长度:', z4q4Output.content.length);
  console.log('Z4-Q4 content 前 500 字符:', z4q4Output.content.slice(0, 500));
}