import json

with open('final-noun-index.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

nouns = data['nouns']
print(f'total noun entries: {len(nouns)}')

id_count = {}
surface_lower_map = {}

for n in nouns:
    nid = n['id']
    id_count[nid] = id_count.get(nid, 0) + 1
    
    key = n['surface'].lower()
    if key not in surface_lower_map:
        surface_lower_map[key] = []
    surface_lower_map[key].append(n['surface'])

dup_ids = [(k, v) for k, v in id_count.items() if v > 1]
dup_surface_lower = [(k, v) for k, v in surface_lower_map.items() if len(v) > 1]

print(f'duplicate ids (exact id collision): {len(dup_ids)}')
print(dup_ids[:20])
print(f'duplicate surface (case-insensitive) groups: {len(dup_surface_lower)}')
for k, v in dup_surface_lower[:30]:
    print(f"  '{k}': {v}")
