#!/usr/bin/env python3
import os, re, json
BASE = r"C:\Users\Administrator\Desktop\zhongjiban-ultimate-master"
cot = [e for e in os.listdir(BASE) if e.startswith("cot") and os.path.isdir(os.path.join(BASE, e))][0]
log_dir = os.path.join(BASE, cot, "logs")

for qid in ["Z1-Q1", "Z1-Q2", "Z1-Q3", "Z2-Q1", "Z4-Q4"]:
    log_path = os.path.join(log_dir, f"cot-run-{qid}.log")
    text = open(log_path, encoding='utf-8').read()
    # Extract usage block (greedy match)
    m = re.search(r'(\{[\s\S]*?"prompt_cache_hit_tokens"[\s\S]*?\})', text)
    print(f"\n=== {qid} usage ===")
    if m:
        try:
            u = json.loads(m.group(1))
            print(json.dumps(u, ensure_ascii=False, indent=2))
        except Exception as e:
            print(f"  parse error: {e}")
            print(m.group(1))