#!/usr/bin/env python3
import os
BASE = r"C:\Users\Administrator\Desktop\zhongjiban-ultimate-master"
cot = [e for e in os.listdir(BASE) if e.startswith("cot") and os.path.isdir(os.path.join(BASE, e))][0]
root = os.path.join(BASE, cot)
print("Files in root:")
for f in sorted(os.listdir(root)):
    if f.endswith(".log") or f.endswith(".json"):
        p = os.path.join(root, f)
        size = os.path.getsize(p)
        mtime = os.path.getmtime(p)
        import time
        print(f"  {f}: {size:>10} bytes, mtime={time.strftime('%Y-%m-%d %H:%M:%S', time.localtime(mtime))}")

# Also check src-cot folder
src = os.path.join(root, "src-cot")
if os.path.isdir(src):
    print("\nFiles in src-cot:")
    for f in sorted(os.listdir(src)):
        p = os.path.join(src, f)
        size = os.path.getsize(p)
        mtime = os.path.getmtime(p)
        import time
        print(f"  {f}: {size:>10} bytes, mtime={time.strftime('%Y-%m-%d %H:%M:%S', time.localtime(mtime))}")

# Also check the candidate texts file
cand = os.path.join(root, "candidate-texts-for-llm-cot.json")
if os.path.exists(cand):
    import json
    data = json.loads(open(cand, encoding='utf-8').read())
    print(f"\nCandidates count: {len(data)}")
    for c in data:
        print(f"  {c.get('questionId', '?')}: {c.get('question', '?')[:60]}")