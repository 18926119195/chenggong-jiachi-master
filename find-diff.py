#!/usr/bin/env python3
"""Find the actual diff between prompts and compare to API request."""
import os, re
from pathlib import Path

BASE = Path(r"C:\Users\Administrator\Desktop\zhongjiban-ultimate-master")
cot_folder = [e for e in os.listdir(BASE) if e.startswith("cot") and os.path.isdir(BASE / e)][0]
SNAP_DIR = BASE / cot_folder / "snapshots"

# Read two snapshots
z1q1 = (SNAP_DIR / "cot-input-Z1-Q1.txt").read_text(encoding="utf-8")
z1q2 = (SNAP_DIR / "cot-input-Z1-Q2.txt").read_text(encoding="utf-8")
z3q4 = SNAP_DIR / "cot-input-Z3-Q4.txt"
print(f"Z3-Q4 snapshot exists: {z3q4.exists()}")

# Show actual first 200 chars
print(f"\nZ1-Q1 first 200 chars:\n{repr(z1q1[:200])}")
print(f"\nZ1-Q2 first 200 chars:\n{repr(z1q2[:200])}")

# Find first difference
for i in range(min(len(z1q1), len(z1q2))):
    if z1q1[i] != z1q2[i]:
        print(f"\nFirst difference at position {i}:")
        print(f"Z1-Q1: {repr(z1q1[max(0,i-20):i+50])}")
        print(f"Z1-Q2: {repr(z1q2[max(0,i-20):i+50])}")
        break

# Find a region where they match again
print("\n\n=== Find where Z1-Q1 and Z1-Q2 align again ===")
# Look for "要求" or "格式" after the diff
for marker in ["要求：", "格式：", "材料总数"]:
    pos1 = z1q1.find(marker, 100)
    pos2 = z1q2.find(marker, 100)
    print(f"\nMarker '{marker}': Z1-Q1 at {pos1}, Z1-Q2 at {pos2}")
    if pos1 > 0 and pos2 > 0:
        # Check if these positions are identical
        chunk1 = z1q1[pos1:pos1+50]
        chunk2 = z1q2[pos2:pos2+50]
        if chunk1 == chunk2:
            print(f"  ✓ Match: {repr(chunk1)}")
        else:
            print(f"  ✗ Differ: Z1-Q1={repr(chunk1)} Z1-Q2={repr(chunk2)}")

# Now check if there's any part of Z1-Q2 that equals Z1-Q1 (not from start)
# This is reverse search - find longest common substring
print("\n\n=== Look at end of Z1-Q1 vs end of Z1-Q2 ===")
print(f"Z1-Q1 last 300 chars:\n{repr(z1q1[-300:])}")
print(f"\nZ1-Q2 last 300 chars:\n{repr(z1q2[-300:])}")

# Find common prefix length from END (suffix match)
i = 0
while i < min(len(z1q1), len(z1q2)) and z1q1[-(i+1)] == z1q2[-(i+1)]:
    i += 1
print(f"\nCommon suffix length: {i} chars")

# Check the chunks region - are they identical?
# Find start of 【【1】】 in both
chunk_start1 = z1q1.find("【【1】】")
chunk_start2 = z1q2.find("【【1】】")
print(f"\nZ1-Q1 【【1】】 at: {chunk_start1}")
print(f"Z1-Q2 【【1】】 at: {chunk_start2}")
if chunk_start1 > 0 and chunk_start2 > 0:
    chunk_end1 = z1q1.find("【【2】】", chunk_start1)
    chunk_end2 = z1q2.find("【【2】】", chunk_start2)
    if chunk_end1 > 0 and chunk_end2 > 0:
        c1 = z1q1[chunk_start1:chunk_end1]
        c2 = z1q2[chunk_start2:chunk_end2]
        if c1 == c2:
            print(f"✓ First chunk 【【1】】 identical ({len(c1)} chars)")
        else:
            print(f"✗ First chunk differs")
            for i, (a, b) in enumerate(zip(c1, c2)):
                if a != b:
                    print(f"  First diff at offset {i}: {repr(c1[i:i+30])} vs {repr(c2[i:i+30])}")
                    break

# Check overall similarity: How much of Z1-Q2 is contained in Z1-Q1?
# Use SequenceMatcher
from difflib import SequenceMatcher
sm = SequenceMatcher(None, z1q1, z1q2)
print(f"\n\n=== SequenceMatcher analysis Z1-Q1 vs Z1-Q2 ===")
# Get matching blocks
total_match = 0
for match in sm.get_matching_blocks():
    total_match += match.size
print(f"Total matching chars: {total_match} (out of {len(z1q1)} and {len(z1q2)})")
print(f"Similarity: {total_match*2 / (len(z1q1)+len(z1q2)) * 100:.2f}%")

# Find the largest matching block
matches = sorted(sm.get_matching_blocks(), key=lambda m: -m.size)
print(f"\nTop 5 matching blocks:")
for m in matches[:5]:
    if m.size > 100:
        print(f"  size={m.size}, Z1-Q1[{m.a}:{m.a+m.size}], Z1-Q2[{m.b}:{m.b+m.size}]")
        print(f"    text: {repr(z1q1[m.a:m.a+50])}")