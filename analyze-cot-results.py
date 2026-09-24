#!/usr/bin/env python3
"""
深度分析 15 个问题的 prompt 相似度、缓存命中率和 token 消耗
"""
import json
import os
import re
from pathlib import Path

BASE = Path(r"C:\Users\Administrator\Desktop\zhongjiban-ultimate-master")
# 用 os.listdir 找出真实文件夹名
cot_folder = None
for entry in os.listdir(BASE):
    if entry.startswith("cot") and os.path.isdir(BASE / entry):
        cot_folder = entry
        break

ROOT = BASE / cot_folder
LOG_DIR = ROOT / "logs"
SNAP_DIR = ROOT / "snapshots"
OUT_DIR = ROOT

print(f"ROOT = {ROOT}")
print(f"LOG_DIR exists: {LOG_DIR.exists()}")
print(f"SNAP_DIR exists: {SNAP_DIR.exists()}")

# 列出实际存在的文件
log_files = sorted([f for f in os.listdir(LOG_DIR) if f.endswith('.log')])
snap_files = sorted([f for f in os.listdir(SNAP_DIR) if f.endswith('.txt')])
output_files = sorted([f for f in os.listdir(ROOT) if f.startswith('reasoning-output-cot-')])

print(f"\nLog files ({len(log_files)}):")
for f in log_files:
    print(f"  {f}")
print(f"\nSnapshot files ({len(snap_files)}):")
for f in snap_files:
    print(f"  {f}")
print(f"\nOutput files ({len(output_files)}):")
for f in output_files:
    print(f"  {f}")

# 只分析实际存在的文件
qids = []
for f in log_files:
    m = re.match(r'cot-run-(.+)\.log', f)
    if m:
        qids.append(m.group(1))

print(f"\n要分析的问题数: {len(qids)}")
print(f"问题列表: {qids}")

# ========== 第一部分：从 summary.json 直接读 cache 信息 ==========
print("\n" + "=" * 80)
print("第一部分：从 summary.json 读取 cache 信息")
print("=" * 80)

summary_path = LOG_DIR / "cot-run-summary.json"
summary = json.loads(summary_path.read_text(encoding="utf-8"))

stats = []
for q in summary["questions"]:
    stats.append({
        "qid": q["questionId"],
        "duration": q["elapsedMs"] / 1000,
        "prompt_tokens": q["cache"]["promptTokens"],
        "cache_hit": q["cache"]["cacheHit"],
        "cache_miss": q["cache"]["cacheMiss"],
        "hit_rate": q["cache"]["cacheHitRatePct"],
        "completion_tokens": q["usage"]["completion_tokens"],
        "reasoning_tokens": q["usage"].get("completion_tokens_details", {}).get("reasoning_tokens", 0),
        "prompt_chars": q["promptLengthChars"],
        "output_chars": q["outputChars"],
    })

print("\n| 问题     | 耗时(s) | prompt_tokens | completion_tokens | reasoning_tokens | cached_tokens | 命中率 %   | prompt字符数 |")
print("|----------|---------|---------------|-------------------|------------------|---------------|-----------|-------------|")
for s in stats:
    print(f"| {s['qid']:<7} | {s['duration']:>7.1f} | {s['prompt_tokens']:>13} | {s['completion_tokens']:>17} | {s['reasoning_tokens']:>16} | {s['cache_hit']:>13} | {s['hit_rate']:>9.2f} | {s['prompt_chars']:>11} |")

tot = {
    "prompt_tokens": sum(s["prompt_tokens"] for s in stats),
    "completion_tokens": sum(s["completion_tokens"] for s in stats),
    "reasoning_tokens": sum(s["reasoning_tokens"] for s in stats),
    "cache_hit": sum(s["cache_hit"] for s in stats),
    "duration": sum(s["duration"] for s in stats),
}
print(f"\n总计: prompt={tot['prompt_tokens']}, completion={tot['completion_tokens']}, reasoning={tot['reasoning_tokens']}, cached={tot['cache_hit']}, 总耗时={tot['duration']:.1f}s")
if tot["prompt_tokens"] > 0:
    print(f"总体命中率: {tot['cache_hit']/tot['prompt_tokens']*100:.2f}%")
# Flash V4 价格：cache hit $0.014/M, cache miss $0.14/M (input), output $0.28/M
cost_miss = (tot["prompt_tokens"] - tot["cache_hit"]) / 1e6 * 0.14
cost_hit = tot["cache_hit"] / 1e6 * 0.014
cost_out = tot["completion_tokens"] / 1e6 * 0.28
print(f"成本估算 (cache miss input ${cost_miss:.4f} + cache hit input ${cost_hit:.4f} + output ${cost_out:.4f}) = ${cost_miss+cost_hit+cost_out:.4f}")

# ========== 第二部分：prompt 快照分析 ==========
print("\n" + "=" * 80)
print("第二部分：每个 prompt 快照长度和'问题：'位置")
print("=" * 80)

def read_snapshot(qid):
    return (SNAP_DIR / f"cot-input-{qid}.txt").read_text(encoding="utf-8")

snaps = {}
for qid in qids:
    try:
        snaps[qid] = read_snapshot(qid)
    except Exception as e:
        print(f"  读取 {qid} 失败: {e}")

for qid, s in snaps.items():
    m = re.search(r'问题[：:]', s)
    pos = m.start() if m else -1
    pct = (pos / len(s) * 100) if pos > 0 else 0
    print(f"  {qid}: 长度={len(s):>6} 字符, '问题：'位置={pos:>5} ({pct:.1f}%)")

# ========== 第三部分：与 Z1-Q1 的 LCP ==========
print("\n" + "=" * 80)
print("第三部分：所有 prompt 与 Z1-Q1 的最长公共前缀")
print("=" * 80)

def lcp_len(s1, s2):
    n = min(len(s1), len(s2))
    i = 0
    while i < n and s1[i] == s2[i]:
        i += 1
    return i

z1q1 = snaps.get("Z1-Q1")
if z1q1:
    print(f"  Z1-Q1 长度: {len(z1q1)}")
    print(f"  {'问题':<8} {'LCP字符数':<10} {'占Z1-Q1%':<10}")
    for qid in qids:
        if qid == "Z1-Q1":
            continue
        lcp = lcp_len(z1q1, snaps[qid])
        print(f"  {qid:<8} {lcp:<10} {lcp/len(z1q1)*100:<10.2f}")

# ========== 第四部分：所有 prompt 的共同前缀 ==========
print("\n" + "=" * 80)
print("第四部分：所有 prompt 的共同前缀")
print("=" * 80)

all_lcp = len(snaps[qids[0]])
for qid in qids[1:]:
    all_lcp = min(all_lcp, lcp_len(snaps[qids[0]], snaps[qid]))

print(f"所有 prompt 的共同前缀长度: {all_lcp} 字符")

# 打印共同前缀末尾 400 字符
common_text = snaps[qids[0]][:all_lcp]
print(f"\n共同前缀的最后 500 字符（找出分叉点）：")
print("---START---")
print(common_text[-500:])
print("---END---")

# 在共同前缀内找"问题："位置
q_pos_in_common = common_text.rfind('问题')
print(f"\n共同前缀中最后一次出现'问题'的位置: {q_pos_in_common}")
print(f"（说明：在共同前缀内就已经包含'问题'，意味着问题位置之前的提示结构一致）")

# ========== 第五部分：分叉点附近对比 ==========
print("\n" + "=" * 80)
print("第五部分：在分叉点前后 Z1 系列 4 个 prompt 的对比")
print("=" * 80)

# 看 Z1 系列在 all_lcp 附近的不同
print(f"\n分叉点位置: {all_lcp}")
for qid in ["Z1-Q1", "Z1-Q2", "Z1-Q3", "Z1-Q4"]:
    s = snaps[qid]
    print(f"\n--- {qid} [字符 {all_lcp-100}-{all_lcp+200}] ---")
    print(repr(s[all_lcp-100:all_lcp+200]))

# ========== 第六部分：在 '问题：' 之前 ==========
print("\n" + "=" * 80)
print("第六部分：在'问题：'之前，每个 prompt 与其他 14 个的平均 LCP")
print("=" * 80)

def find_q(s):
    m = re.search(r'问题[：:]', s)
    return m.start() if m else -1

before_q = {}
for qid in qids:
    pos = find_q(snaps[qid])
    before_q[qid] = snaps[qid][:pos] if pos > 0 else snaps[qid]
    print(f"  {qid}: '问题：'前 = {len(before_q[qid])} 字符")

# 计算所有 in "问题："前的 LCP
all_before = min(len(before_q[q]) for q in qids)
for qid in qids[1:]:
    all_before = min(all_before, lcp_len(before_q[qids[0]], before_q[qid]))

print(f"\n所有 {len(qids)} 个 prompt 在'问题：'之前的共同前缀长度: {all_before} 字符")

# ========== 第七部分：每次问 cache 命中率与间隔时间的关系 ==========
print("\n" + "=" * 80)
print("第七部分：相邻两次调用间隔时间 + cache 命中率")
print("=" * 80)

# 用 stats 的 elapsedMs 反推起始时间（累加）
t0 = 0
runs = []
for s in stats:
    runs.append({**s, "startSec": t0})
    t0 += s["duration"]

print(f"\n| 问题     | 开始时间(s) | 耗时(s) | prompt_tokens | cached | 命中率% |")
print(f"|----------|------------|---------|---------------|--------|---------|")
for r in runs:
    print(f"| {r['qid']:<7} | {r['startSec']:>10.1f} | {r['duration']:>7.1f} | {r['prompt_tokens']:>13} | {r['cache_hit']:>6} | {r['hit_rate']:>6.2f}% |")

# 计算每对相邻之间的间隔
print("\n相邻间隔时间 vs. 命中率：")
for i in range(1, len(runs)):
    gap = runs[i]["startSec"] - runs[i-1]["startSec"] - runs[i-1]["duration"]
    print(f"  {runs[i-1]['qid']} → {runs[i]['qid']}: 间隔 {gap:.1f}s (前 {runs[i-1]['hit_rate']}% → 后 {runs[i]['hit_rate']}%)")

# ========== 第八部分：Z4-Q4 为何特别快 ==========
print("\n" + "=" * 80)
print("第八部分：Z4-Q4 输出检查")
print("=" * 80)

z4q4_path = ROOT / "reasoning-output-cot-Z4-Q4.json"
if z4q4_path.exists():
    z4q4 = json.loads(z4q4_path.read_text(encoding="utf-8"))
    print(f"Z4-Q4 顶层 keys: {list(z4q4.keys())}")
    for k, v in z4q4.items():
        if isinstance(v, str):
            print(f"\n  {k} (str, len={len(v)}):")
            print(f"  --- 前 800 字符 ---")
            print(v[:800])
            print(f"  --- 后 300 字符 ---")
            print(v[-300:])
        elif isinstance(v, list):
            print(f"  {k} (list, len={len(v)})")
        elif isinstance(v, dict):
            print(f"  {k} (dict, keys={list(v.keys())[:8]})")
        else:
            print(f"  {k}: {v}")

# ========== 第九部分：分析 cache 块大小（DeepSeek 是 64 token block） ==========
print("\n" + "=" * 80)
print("第九部分：分析 cache 块大小（DeepSeek 64 token block）")
print("=" * 80)

# Z1-Q2 的 cache hit 是 165504 / 165665 = 99.9%
# 165504 / 64 = 2586 完整块, 165504 + (165665 - 165504) = 165665 prompt tokens 总共
# 165665 / 64 = 2588.5 ~ 2589 个块
# 这意味着只有最后 2 个块是 miss
print(f"Z1-Q2: 165504 cached / 165665 total = 99.9%")
print(f"165504 / 64 = {165504/64} blocks (整除={165504%64==0})")
print(f"165665 / 64 = {165665/64:.2f} blocks")
print(f"miss tokens = 165665 - 165504 = {165665 - 165504}")
print(f"miss blocks (ceil) = {265}, {265*64} = {265*64}")
print(f"这意味着 Z1-Q2 只有最后 {265} 个 token (~{265} tokens) 是 miss")
print(f"这与 Z1-Q1 → Z1-Q2 之间 prompt 的差异字符数 {165665-165665} 一致")

# ========== 第十部分：找出 Z1-Q1 和 Z1-Q2 在 prompt 字符上的具体差异 ==========
print("\n" + "=" * 80)
print("第十部分：Z1-Q1 vs Z1-Q2 的具体差异")
print("=" * 80)

s1 = snaps["Z1-Q1"]
s2 = snaps["Z1-Q2"]
# 找出第一个不同的字符
diff_pos = None
for i in range(min(len(s1), len(s2))):
    if s1[i] != s2[i]:
        diff_pos = i
        break
if diff_pos is None:
    print(f"Z1-Q1 和 Z1-Q2 完全相同（前 {min(len(s1), len(s2))} 字符）")
else:
    print(f"第一个差异位置: {diff_pos}")
    print(f"Z1-Q1 在 [{diff_pos-50}:{diff_pos+200}]:")
    print(repr(s1[diff_pos-50:diff_pos+200]))
    print(f"Z1-Q2 在 [{diff_pos-50}:{diff_pos+200}]:")
    print(repr(s2[diff_pos-50:diff_pos+200]))

# 所有 Q1 之间对比
print("\n所有 Zx-Q1 之间的差异位置：")
q1s = [snaps[q] for q in qids if q.endswith("-Q1")]
q1_ids = [q for q in qids if q.endswith("-Q1")]
if len(q1s) > 1:
    # 找出所有 Q1 共同前缀
    all_lcp_q1 = len(q1s[0])
    for q in q1s[1:]:
        all_lcp_q1 = min(all_lcp_q1, lcp_len(q1s[0], q))
    print(f"Z1-Q1/Z2-Q1/Z3-Q1/Z4-Q1 共同前缀: {all_lcp_q1} 字符")
    print(f"共同前缀末尾 300 字符:")
    print("---START---")
    print(q1s[0][all_lcp_q1-300:all_lcp_q1+200])
    print("---END---")

# 同样 Q2, Q3, Q4 之间对比
for qsuffix in ["Q2", "Q3", "Q4"]:
    qs = [snaps[q] for q in qids if q.endswith(f"-{qsuffix}")]
    qids_suffix = [q for q in qids if q.endswith(f"-{qsuffix}")]
    if len(qs) > 1:
        all_lcp_s = len(qs[0])
        for q in qs[1:]:
            all_lcp_s = min(all_lcp_s, lcp_len(qs[0], q))
        print(f"\nZx-{qsuffix} 共同前缀: {all_lcp_s} 字符")

print("\n=== 分析完成 ===")