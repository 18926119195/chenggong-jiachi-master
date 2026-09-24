#!/usr/bin/env python3
import os
BASE = r"C:\Users\Administrator\Desktop\zhongjiban-ultimate-master"
cot = [e for e in os.listdir(BASE) if e.startswith("cot") and os.path.isdir(os.path.join(BASE, e))][0]
root = os.path.join(BASE, cot)

# Compare multipath prompt file vs snapshot for Z1-Q1, Z1-Q2
for qid in ["Z1-Q1", "Z1-Q2", "Z1-Q3"]:
    prompt_file = os.path.join(root, f"multipath-prompt-cot-{qid}.txt")
    snap_file = os.path.join(root, "snapshots", f"cot-input-{qid}.txt")
    p = open(prompt_file, encoding='utf-8').read()
    s = open(snap_file, encoding='utf-8').read()
    print(f"{qid}:")
    print(f"  prompt file len: {len(p)}")
    print(f"  snapshot   len: {len(s)}")
    print(f"  identical: {p == s}")
    print(f"  prompt first 200: {p[:200]!r}")
    print(f"  snap   first 200: {s[:200]!r}")
    print()