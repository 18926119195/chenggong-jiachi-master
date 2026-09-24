#!/usr/bin/env python3
"""汇总报告：每个问题的 token 数、cache命中率、prompt内容对比"""
import os, json, re
BASE = r"C:\Users\Administrator\Desktop\zhongjiban-ultimate-master"
cot = [e for e in os.listdir(BASE) if e.startswith("cot") and os.path.isdir(os.path.join(BASE, e))][0]
root = os.path.join(BASE, cot)

summary = json.loads(open(os.path.join(root, "logs", "cot-run-summary.json"), encoding='utf-8').read())

# Flash V4 价格 (per 1M tokens)
PRICE_CACHE_HIT   = 0.014   # $0.014 / 1M
PRICE_CACHE_MISS  = 0.14    # $0.14 / 1M  (input)
PRICE_OUTPUT      = 0.28    # $0.28 / 1M

print("=" * 110)
print("PART 1: 每个问题的 token 使用、cache 命中、耗时、成本")
print("=" * 110)

print(f"\n{'问题':<7} {'prompt tok':>11} {'cached':>7} {'miss':>7} {'hit%':>6} {'output':>7} {'reasoning':>10} {'耗时':>7} {'成本(USD)':>10}")
print("-" * 110)
total_cost = 0
for q in summary["questions"]:
    p = q["cache"]
    pt = p["promptTokens"]
    ch = p["cacheHit"]
    cm = p["cacheMiss"]
    out = q["usage"]["completion_tokens"]
    reason = q["usage"].get("completion_tokens_details", {}).get("reasoning_tokens", 0)
    dur = q["elapsedMs"] / 1000
    cost = cm/1e6*PRICE_CACHE_MISS + ch/1e6*PRICE_CACHE_HIT + out/1e6*PRICE_OUTPUT
    total_cost += cost
    print(f"{q['questionId']:<7} {pt:>11,} {ch:>7,} {cm:>7,} {p['cacheHitRatePct']:>5.2f}% {out:>7,} {reason:>10,} {dur:>6.1f}s ${cost:>9.5f}")

print("-" * 110)
tot_p = sum(q["cache"]["promptTokens"] for q in summary["questions"])
tot_ch = sum(q["cache"]["cacheHit"] for q in summary["questions"])
tot_out = sum(q["usage"]["completion_tokens"] for q in summary["questions"])
tot_dur = sum(q["elapsedMs"] for q in summary["questions"]) / 1000
print(f"{'合计':<7} {tot_p:>11,} {tot_ch:>7,} {tot_p-tot_ch:>7,} {tot_ch/tot_p*100:>5.2f}% {tot_out:>7,} {'':>10} {tot_dur:>6.1f}s ${total_cost:>9.5f}")

print(f"\n→ 总计: prompt={tot_p:,} tokens, 其中 cached={tot_ch:,} ({tot_ch/tot_p*100:.2f}%), miss={tot_p-tot_ch:,}")
print(f"→ 总成本 (含 cached 折扣): ${total_cost:.5f}")
print(f"→ 如果 cache 命中率 100%: ${(tot_ch/1e6*PRICE_CACHE_HIT + (tot_p-tot_ch)/1e6*PRICE_CACHE_HIT + tot_out/1e6*PRICE_OUTPUT):.5f}")
print(f"→ 浪费在 cache miss 上的成本: ${((tot_p-tot_ch)/1e6*(PRICE_CACHE_MISS-PRICE_CACHE_HIT)):.5f}")

print("\n" + "=" * 110)
print("PART 2: prompt 内容对比")
print("=" * 110)

snaps = {}
for q in summary["questions"]:
    qid = q["questionId"]
    snap_path = os.path.join(root, "snapshots", f"cot-input-{qid}.txt")
    if os.path.exists(snap_path):
        snaps[qid] = open(snap_path, encoding='utf-8').read()

# 找出 Z1-Q1 与其他所有 prompt 的"前缀差异长度"
print(f"\n各 prompt 长度 (字符): {[(qid, len(s)) for qid, s in snaps.items()]}")

# 找共同的 header
def lcp(s1, s2):
    n = min(len(s1), len(s2))
    i = 0
    while i < n and s1[i] == s2[i]:
        i += 1
    return i

# 与 Z1-Q1 的 LCP
z1q1 = snaps["Z1-Q1"]
print(f"\n与 Z1-Q1 的共同前缀长度（从开头数）:")
for qid, s in snaps.items():
    if qid == "Z1-Q1":
        continue
    n = lcp(z1q1, s)
    print(f"  Z1-Q1 vs {qid}: 前 {n} 字符相同 ({n/len(z1q1)*100:.4f}%)")

# 找共同的 suffix
def lcs(s1, s2):
    n = min(len(s1), len(s2))
    i = 0
    while i < n and s1[-(i+1)] == s2[-(i+1)]:
        i += 1
    return i

print(f"\n与 Z1-Q1 的共同后缀长度（从末尾数）:")
for qid, s in snaps.items():
    if qid == "Z1-Q1":
        continue
    n = lcs(z1q1, s)
    print(f"  Z1-Q1 vs {qid}: 末 {n} 字符相同 ({n/len(z1q1)*100:.4f}%)")

# 找到"内容差异"区域
print(f"\n内容差异位置（Z1-Q1 第一个字符不同于该 qid 的位置）:")
for qid, s in snaps.items():
    if qid == "Z1-Q1":
        continue
    diff_pos = None
    for i in range(min(len(z1q1), len(s))):
        if z1q1[i] != s[i]:
            diff_pos = i
            break
    if diff_pos is None:
        print(f"  {qid}: 完全相同")
    else:
        # 显示分叉处的内容
        print(f"  {qid}: 在字符 {diff_pos} 分叉")
        # 找出 "问题：" 出现的位置
        z1q1_q = z1q1.find("问题：")
        z_q = s.find("问题：")
        print(f"    Z1-Q1 的 '问题：' 在字符 {z1q1_q}, {qid} 的 '问题：' 在字符 {z_q}")
        # 找出下一个共同时
        next_match = None
        for i in range(diff_pos, min(len(z1q1), len(s))):
            if z1q1[i] == s[i]:
                # 验证后面也都匹配
                matching = True
                for j in range(i, min(len(z1q1), len(s)), 100):
                    if z1q1[j] != s[j]:
                        matching = False
                        break
                if matching:
                    next_match = i
                    break
        if next_match:
            print(f"    分叉后再次相同的位置: {next_match}")

# 找问题文本的长度
print(f"\n问题文本（'问题：' 之后到下一个换行）:")
for qid in ["Z1-Q1", "Z1-Q2", "Z1-Q3", "Z1-Q4", "Z2-Q1", "Z3-Q1", "Z4-Q1", "Z4-Q4"]:
    s = snaps[qid]
    m = re.search(r'问题[：:](.+?)(?:\n|$)', s)
    if m:
        q_text = m.group(1).strip()
        print(f"  {qid}: {q_text}")

print("\n" + "=" * 110)
print("PART 3: 与 Z1-Q2 (99.9% cache hit) 比较")
print("=" * 110)

# Z1-Q2 与其他所有 prompt 的 LCP
z1q2 = snaps["Z1-Q2"]
print(f"\n与 Z1-Q2 的共同前缀长度:")
for qid, s in snaps.items():
    if qid == "Z1-Q2":
        continue
    n = lcp(z1q2, s)
    print(f"  Z1-Q2 vs {qid}: 前 {n} 字符")

# 关键问题: 为什么 Z1-Q2 能 hit cache
# 看 Z1-Q1 和 Z1-Q2 在 character level 的差异
print(f"\nZ1-Q1 vs Z1-Q2 完整结构对比:")
print(f"  Z1-Q1 长度: {len(z1q1):,} 字符")
print(f"  Z1-Q2 长度: {len(z1q2):,} 字符")
print(f"  长度差: {len(z1q1) - len(z1q2)} 字符")

# 找出真正分叉的位置
diff_pos = None
for i in range(min(len(z1q1), len(z1q2))):
    if z1q1[i] != z1q2[i]:
        diff_pos = i
        break
print(f"  第一个字符差异位置: {diff_pos}")

# Z1-Q1 字符 0-diff_pos 的内容
print(f"\n  Z1-Q1 字符 0-{diff_pos+50}:")
print(f"    {z1q1[:diff_pos+50]!r}")
print(f"\n  Z1-Q2 字符 0-{diff_pos+50}:")
print(f"    {z1q2[:diff_pos+50]!r}")

# 找出 "要求：" 出现的位置
q_z1q1 = z1q1.find("要求：")
q_z1q2 = z1q2.find("要求：")
print(f"\n  '要求：' 位置: Z1-Q1={q_z1q1}, Z1-Q2={q_z1q2}")

# 在 '要求：' 之前，看 Z1-Q1 和 Z1-Q2 的差异
print(f"  Z1-Q1 [0-{q_z1q1}] 内容:")
print(f"    {z1q1[:q_z1q1]!r}")
print(f"  Z1-Q2 [0-{q_z1q2}] 内容:")
print(f"    {z1q2[:q_z1q2]!r}")

# 在 '要求：' 之后, 内容应该完全一样
print(f"\n  '要求：' 之后内容是否相同: {z1q1[q_z1q1:] == z1q2[q_z1q2:]}")