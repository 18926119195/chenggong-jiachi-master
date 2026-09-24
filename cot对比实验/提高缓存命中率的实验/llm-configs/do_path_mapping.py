# -*- coding: utf-8 -*-
import json, re, unicodedata

with open('reasoning-output-Z1-Q3.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

line23 = data[22]  # L23 = index 22
line24 = data[23]  # L24 = index 23

LB = '\u3010'  # 【
RB = '\u3011'  # 】

ZH_TO_ARAB = {'\u4e00':'1', '\u4e8c':'2', '\u4e09':'3', '\u56db':'4',
              '\u4e94':'5', '\u516d':'6', '\u4e03':'7', '\u516b':'8',
              '\u4e5d':'9', '\u5341':'10'}

# ============================================================
# Parse L24 into path blocks
# ============================================================
# Match "# 路径N：...---" blocks
pattern24 = re.compile(
    r'#\s*路径([一二三四五六七八九十]+)[：:](.+?)(?=\n---+|\n#|\Z)',
    re.DOTALL
)
path_blocks_24 = []
for m in pattern24.finditer(line24):
    title = m.group(2).strip()
    full = m.group(0)
    # Find all [[N]] citations
    chunks = re.findall(r'\[\[(\d+)\]\]', full)
    path_blocks_24.append({
        'title': title,
        'full': full,
        'chunks': chunks
    })

# ============================================================
# Parse L23 into path blocks
# ============================================================
pattern23 = re.compile(r'#\s*路径([一二三四五六七八九十]+)[：:]')
ph23 = []
for m in pattern23.finditer(line23):
    ph23.append({'path_num': m.group(1), 'pos': m.start()})
ph23.sort(key=lambda x: x['pos'])

for i, p in enumerate(ph23):
    start = p['pos']
    end = ph23[i+1]['pos'] if i+1 < len(ph23) else len(line23)
    p['start'] = start
    p['end'] = end
    p['content'] = line23[start:end]

# ============================================================
# Similarity function
# ============================================================
def similarity(a, b):
    ca = set(a); cb = set(b)
    shared = len(ca & cb)
    total = len(ca) + len(cb)
    return round(shared * 2.0 / total, 3) if total else 0

# ============================================================
# Do the mapping
# ============================================================
output = []
sep = '=' * 80
dash = '-' * 80

output.append(sep)
output.append('L24 -> L23 PATH MAPPING RESULT')
output.append(sep)

summary_rows = []

for p24 in path_blocks_24:
    p24_title = p24['title']
    p24_num = ZH_TO_ARAB.get(p24_title[0], '?') if p24_title else '?'

    output.append('')
    output.append(sep)
    output.append(f"L24 PATH: {p24_num} | {p24_title}")
    output.append(f"CITED CHUNKS: [{', '.join(p24['chunks'])}]")
    output.append(dash)

    # Find best matching L23 path
    best_score = 0; best = None
    for p in ph23:
        sc = similarity(p24_title, p['content'])
        if sc > best_score:
            best_score = sc; best = p

    if best:
        l23_num = ZH_TO_ARAB.get(best['path_num'], best['path_num'])
        output.append(f"MAPPED TO L23 PATH: {l23_num} (score={best_score})")
        output.append('')
        output.append('[L23 CONTENT SNIPPET]')
        snip = best['content'][:2000]
        output.append(snip)
        if len(best['content']) > 2000:
            output.append(f'... [TRUNCATED total={len(best["content"])} chars]')
        output.append('')
        output.append('[L23 CHUNK CONTEXTS - ordered by L24 citation]')
        for n in p24['chunks']:
            marker = f'{LB}{n}{RB}'
            pos = line23.find(marker)
            if pos >= 0:
                cs = max(0, pos - 200)
                ce = min(len(line23), pos + 250)
                ctx = line23[cs:ce].replace('\n', ' ').replace('\r', '')
                output.append('')
                output.append(f"  【{n}】 @ {pos}:")
                output.append(f"  ...{ctx}...")
            else:
                output.append(f"  【{n}】: NOT FOUND in L23")
    else:
        output.append('NO MATCH')

    summary_rows.append({
        'l24_num': f"P{p24_num}",
        'l24_title': p24_title[:36],
        'l23_num': f"P{ZH_TO_ARAB.get(best['path_num'], '?') if best else '?'}",
        'score': best_score if best else 0,
        'chunks': ', '.join(p24['chunks'])
    })

# Summary table
output.append('')
output.append(sep)
output.append('SUMMARY TABLE')
output.append(sep)
output.append(f"{'L24#':<5} | {'L24 Title':<37} | {'L23#':<5} | {'Score':<6} | Chunks")
output.append(dash)
for row in summary_rows:
    line = f"{row['l24_num']:<5}| {row['l24_title']:<37}| {row['l23_num']:<5}| {row['score']:<6}| {row['chunks']}"
    output.append(line)

output.append('')
output.append(sep)
output.append('CHUNK COVERAGE MATRIX')
output.append(sep)

# For each chunk cited in L24, show where it appears in L23
all_l24_chunks = set()
for p in path_blocks_24:
    for c in p['chunks']:
        all_l24_chunks.add(c)

output.append(f"Chunk | L24 count | L23 positions (first 3)")
output.append(dash)
for ch in sorted(all_l24_chunks, key=int):
    l24_count = sum(1 for p in path_blocks_24 if ch in p['chunks'])
    l23_positions = []
    pos = 0
    marker = f'{LB}{ch}{RB}'
    while True:
        pos = line23.find(marker, pos)
        if pos < 0: break
        l23_positions.append(str(pos))
        pos += 1
        if len(l23_positions) >= 3: break
    pos_str = ', '.join(l23_positions)
    if len(l23_positions) > 3:
        pos_str += f' ... (+{len(l23_positions)-3} more)'
    output.append(f"  {ch}  |     {l24_count}     | {pos_str}")

with open('path_mapping_result.txt', 'w', encoding='utf-8') as f:
    f.write('\n'.join(output))

print('Done. See path_mapping_result.txt')
