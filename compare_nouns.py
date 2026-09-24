import json
import os

# Load files
base_dir = r"C:\Users\Administrator\Desktop\2026-09-21-master"

# Find both files
files = {}
for f in os.listdir(base_dir):
    if f == "final-noun-index.json":
        files["old"] = os.path.join(base_dir, f)
    elif f.startswith("主流程") and f.endswith("22"):
        subdir = os.path.join(base_dir, f)
        if os.path.isdir(subdir):
            files["new"] = os.path.join(subdir, "final-noun-index.json")

print(f"OLD: {files.get('old', 'NOT FOUND')}")
print(f"NEW: {files.get('new', 'NOT FOUND')}")

with open(files["old"], "r", encoding="utf-8") as f:
    old_data = json.load(f)
    
with open(files["new"], "r", encoding="utf-8") as f:
    new_data = json.load(f)

# Compare meta
print("\n" + "="*60)
print("META COMPARISON")
print("="*60)

old_meta = old_data["meta"]
new_meta = new_data["meta"]

print(f"{'Metric':<20} {'OLD (New Run)':<15} {'NEW (Original)':<15} {'Difference':<12}")
print("-"*60)

for key in ["totalNouns", "s0Count", "s1Count", "totalOffsets"]:
    old_val = old_meta.get(key, 0)
    new_val = new_meta.get(key, 0)
    diff = old_val - new_val
    print(f"{key:<20} {old_val:<15} {new_val:<15} {diff:+12}")

# Compare nouns
old_ids = set(n["id"] for n in old_data["nouns"])
new_ids = set(n["id"] for n in new_data["nouns"])

common = old_ids & new_ids
only_old = old_ids - new_ids
only_new = new_ids - old_ids

print("\n" + "="*60)
print("NOUN INTERSECTION ANALYSIS")
print("="*60)
print(f"Common nouns:  {len(common):>6}")
print(f"Only in OLD:   {len(only_old):>6}")
print(f"Only in NEW:   {len(only_new):>6}")

print("\n" + "="*60)
print("SAMPLE NOUNS ONLY IN OLD (First 20)")
print("="*60)
for i, noun_id in enumerate(sorted(only_old)[:20]):
    noun = next(n for n in old_data["nouns"] if n["id"] == noun_id)
    print(f"{i+1:>3}. {noun_id}")
    print(f"     Surface: {noun['surface']}")
    print(f"     Source: {noun['source']}, Offset count: {len(noun['offsets'])}")
    print(f"     First offset: page={noun['offsets'][0]['page']} start={noun['offsets'][0]['start']} end={noun['offsets'][0]['end']}")

print("\n" + "="*60)
print("SAMPLE NOUNS ONLY IN NEW (First 20)")
print("="*60)
for i, noun_id in enumerate(sorted(only_new)[:20]):
    noun = next(n for n in new_data["nouns"] if n["id"] == noun_id)
    print(f"{i+1:>3}. {noun_id}")
    print(f"     Surface: {noun['surface']}")
    print(f"     Source: {noun['source']}, Offset count: {len(noun['offsets'])}")
    print(f"     First offset: page={noun['offsets'][0]['page']} start={noun['offsets'][0]['start']} end={noun['offsets'][0]['end']}")

print("\n" + "="*60)
print("DETAILED POSITION COMPARISON FOR COMMON NOUNS (Sample)")
print("="*60)
common_list = list(common)[:5]
for noun_id in common_list:
    old_noun = next(n for n in old_data["nouns"] if n["id"] == noun_id)
    new_noun = next(n for n in new_data["nouns"] if n["id"] == noun_id)
    print(f"\nNoun: {noun_id}")
    print(f"  Surface: {old_noun['surface']}")
    print(f"  OLD offset count: {len(old_noun['offsets'])}")
    print(f"  NEW offset count: {len(new_noun['offsets'])}")
    print(f"  Difference: {len(old_noun['offsets']) - len(new_noun['offsets']):+d}")
