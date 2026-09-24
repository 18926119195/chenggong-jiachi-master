import os, glob, json
from datetime import datetime

base = r'C:\Users\Administrator\Desktop\zhongjiban-ultimate-master\问题一\runs\2026-09-23-cache-test-rerun-remainder\snapshots'

q = 'Z1-Q2'
qpath = os.path.join(base, q)
files = sorted(glob.glob(os.path.join(qpath, 'call-*-response.json')))

# Print timestamps of each call to see ordering
print(f'=== {q} - timestamps ===')
prev_ts = None
for i, f in enumerate(files):
    data = json.load(open(f, 'r', encoding='utf-8'))
    ts = data.get('timestamp', '?')
    req_file = f.replace('-response.json', '-request.json')
    req_data = json.load(open(req_file, 'r', encoding='utf-8'))
    preview = req_data.get('promptPreview', '')
    if '从下列名词中' in preview:
        t = 'coarse'
    elif '按重要程度打分' in preview:
        t = 'scoring'
    else:
        t = 'reasoning'
    print(f'  call-{i+1:04d}: {ts} | {t}')
