#!/usr/bin/env python3
# -*- coding: utf-8 -*-
import json
import re

with open('reasoning-output-Z1-Q4.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

L23 = data['thinkingChain']
L24 = data['llmOutput']

print(f"L23 length: {len(L23)}")
print(f"L24 length: {len(L24)}")

# Chinese brackets
LB = '\u3010'  # 【
RB = '\u3011'  # 】

# Regex patterns
single_re = re.compile(re.escape(LB) + r'(\d+)' + re.escape(RB))
double_re = re.compile(re.escape(LB) + re.escape(LB) + r'(\d+)' + re.escape(RB) + re.escape(RB))

# Test
test = f'hello {LB}123{RB} world'
print(f"Test: matches={single_re.findall(test)}")

# Find all chunk mentions in L23
chunk_positions = {}  # chunk_id -> list of positions
for m in single_re.finditer(L23):
    cid = m.group(1)
    if cid not in chunk_positions:
        chunk_positions[cid] = []
    chunk_positions[cid].append(m.start())

print(f"Unique chunks mentioned in L23: {len(chunk_positions)}")
print(f"Chunks: {sorted(chunk_positions.keys(), key=int)}")

# Extract L24 paths
cn_nums = '\u4e00\u4e8c\u4e09\u56db\u4e94\u516d\u4e03\u516b\u4e5d\u5341'  # 一二三四五六七八九十
LU = '\u8def'  # 路
JING = '\u5f84'  # 径
path_re = re.compile(r'#\s*' + re.escape(LU) + re.escape(JING) + r'[' + cn_nums + r'][^#]*')

paths24 = []
for m in path_re.finditer(L24):
    block = m.group(0)
    nl = block.find('\n')
    title = block[:nl].strip() if nl > 0 else block[:80]
    chunks = list(set(double_re.findall(block)))
    paths24.append({'title': title, 'chunks': chunks, 'start': m.start()})

print(f"\nL24 has {len(paths24)} paths")

# Path-by-path mapping
sep = '=' * 80
dash = '-' * 60
print('\n' + sep)
print('Z1-Q4: CHUNK-BASED POSITION MAPPING')
print(sep)

for p in paths24:
    print(f'\n{dash}')
    print(f"PATH: {p['title']}")
    print(f"Cited chunks in L24: [{', '.join(p['chunks'])}]")
    print(dash)

    for c in p['chunks']:
        if c in chunk_positions:
            positions = chunk_positions[c]
            print(f"  Chunk {c} -> L23 positions: {positions}")
        else:
            print(f"  Chunk {c} -> NOT in L23")

    # Find first L23 mention of any cited chunk
    first_pos = -1
    first_chunk = ''
    for c in p['chunks']:
        if c in chunk_positions:
            pos = chunk_positions[c][0]
            if first_pos < 0 or pos < first_pos:
                first_pos = pos
                first_chunk = c

    if first_pos >= 0:
        ctx_start = max(0, first_pos - 150)
        ctx_end = min(len(L23), first_pos + 350)
        ctx = L23[ctx_start:ctx_end]
        print(f"\n  Context around first L23 mention of chunk {first_chunk} (pos={first_pos}):")
        print(f"  >>>")
        for line in ctx.split('\n'):
            print(f"  {line}")
        print(f"  <<<")

# Coverage summary
print('\n' + sep)
print('COVERAGE SUMMARY')
print(sep)
all_cited = set()
for p in paths24:
    all_cited.update(p['chunks'])
found = [c for c in all_cited if c in chunk_positions]
missing = [c for c in all_cited if c not in chunk_positions]
print(f"Unique chunks cited in L24: {len(all_cited)}")
print(f"Chunks found in L23: {len(found)} -> {found}")
print(f"Chunks NOT found in L23: {len(missing)} -> {missing}")

# L23 reading order vs L24 path assignment
print('\n' + sep)
print('L23 CHUNK READING ORDER vs L24 PATH ASSIGNMENT')
print(sep)
L23_chunks_in_order = []
for m in single_re.finditer(L23):
    L23_chunks_in_order.append(m.group(1))
print(f"L23 chunks in reading order: {L23_chunks_in_order}")
print(f"\nFor each L24 path, which chunks first appeared in L23 before that path's chunks?")
