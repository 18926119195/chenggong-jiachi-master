import os, glob, json, re

base = r'C:\Users\Administrator\Desktop\zhongjiban-ultimate-master\问题一\runs\2026-09-23-cache-test-rerun-remainder\snapshots'

def get_cache_tokens(file_path):
    try:
        raw = open(file_path, 'r', encoding='utf-8').read()
    except:
        raw = open(file_path, 'r', encoding='latin-1').read()
    m_hit = re.search(r'prompt_cache_hit_tokens.*?(\d+)', raw)
    m_miss = re.search(r'prompt_cache_miss_tokens.*?(\d+)', raw)
    h = int(m_hit.group(1)) if m_hit else 0
    m = int(m_miss.group(1)) if m_miss else 0
    return h, m

def get_prompt_type(req_file):
    try:
        data = json.load(open(req_file, 'r', encoding='utf-8'))
        preview = data.get('promptPreview', '')
        if '从下列名词中' in preview:
            return 'coarse'
        elif '按重要程度打分' in preview:
            return 'scoring'
        elif '材料' in preview or '路径' in preview:
            return 'reasoning'
    except:
        pass
    return '?'

# For each question, identify ALL call phases properly
print("=" * 110)
print(f"{'QID':10}{'总call':>6}{'coarse':>8}{'scoring':>9}{'reasoning':>10}  {'粗筛hit':>10}{'粗筛miss':>10}{'粗筛率':>8}  {'精打hit':>10}{'精打miss':>10}{'精打率':>8}  {'Reason hit':>10}{'Reason miss':>10}{'Reason率':>8}")
print("=" * 110)

results = []
for q in sorted(os.listdir(base)):
    qpath = os.path.join(base, q)
    if not os.path.isdir(qpath): continue
    files = sorted(glob.glob(os.path.join(qpath, 'call-*-response.json')))
    if not files: continue

    coarse_files = []
    scoring_files = []
    reasoning_files = []
    for f in files:
        req_file = f.replace('-response.json', '-request.json')
        t = get_prompt_type(req_file)
        if t == 'coarse':
            coarse_files.append(f)
        elif t == 'scoring':
            scoring_files.append(f)
        elif t == 'reasoning':
            reasoning_files.append(f)

    ch = cm = sh = sm = rh = rm = 0
    for f in coarse_files:
        h, m = get_cache_tokens(f); ch += h; cm += m
    for f in scoring_files:
        h, m = get_cache_tokens(f); sh += h; sm += m
    for f in reasoning_files:
        h, m = get_cache_tokens(f); rh += h; rm += m

    def rate(h, m): return round(h*100.0/(h+m), 1) if h+m > 0 else 0.0

    print(f"{q:10}{len(files):>6}{len(coarse_files):>8}{len(scoring_files):>9}{len(reasoning_files):>10}  {ch:>10}{cm:>10}{rate(ch, cm):>7.1f}%  {sh:>10}{sm:>10}{rate(sh, sm):>7.1f}%  {rh:>10}{rm:>10}{rate(rh, rm):>7.1f}%")
    results.append((q, ch, cm, sh, sm, rh, rm))

print("=" * 110)
print("\n=== 汇总（所有题相加） ===")
total_coarse_hit = sum(r[1] for r in results)
total_coarse_miss = sum(r[2] for r in results)
total_score_hit = sum(r[3] for r in results)
total_score_miss = sum(r[4] for r in results)
total_reason_hit = sum(r[5] for r in results)
total_reason_miss = sum(r[6] for r in results)

def rate(h, m): return round(h*100.0/(h+m), 1) if h+m > 0 else 0.0

print(f"粗筛: hit={total_coarse_hit:>10} miss={total_coarse_miss:>10} rate={rate(total_coarse_hit, total_coarse_miss):>5.1f}%")
print(f"精打: hit={total_score_hit:>10} miss={total_score_miss:>10} rate={rate(total_score_hit, total_score_miss):>5.1f}%")
print(f"Reason: hit={total_reason_hit:>10} miss={total_reason_miss:>10} rate={rate(total_reason_hit, total_reason_miss):>5.1f}%")

total_h = total_coarse_hit + total_score_hit + total_reason_hit
total_m = total_coarse_miss + total_score_miss + total_reason_miss
print(f"整体: hit={total_h:>10} miss={total_m:>10} rate={rate(total_h, total_m):>5.1f}%")
