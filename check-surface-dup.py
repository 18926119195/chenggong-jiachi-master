import json
from collections import Counter

with open('final-noun-index.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

nouns = data['nouns']
print(f'Total noun entries: {len(nouns)}')

# Check for exact surface duplicates
surface_exact = [n['surface'] for n in nouns]
surface_exact_counts = Counter(surface_exact)
exact_dups = {k: v for k, v in surface_exact_counts.items() if v > 1}

print(f'\nExact surface duplicates: {len(exact_dups)}')
if exact_dups:
    print('\nFirst 30 duplicates:')
    for surface, count in list(exact_dups.items())[:30]:
        print(f"  {count}x: '{surface}'")

# Check for case-insensitive duplicates
surface_lower = [n['surface'].lower() for n in nouns]
surface_lower_counts = Counter(surface_lower)
case_dups = {k: v for k, v in surface_lower_counts.items() if v > 1}

print(f'\nCase-insensitive duplicates: {len(case_dups)}')
if case_dups:
    print('\nFirst 30 case-insensitive duplicates:')
    for surface, count in list(case_dups.items())[:30]:
        # Find original forms
        originals = [n['surface'] for n in nouns if n['surface'].lower() == surface]
        print(f"  {count}x: {originals}")
