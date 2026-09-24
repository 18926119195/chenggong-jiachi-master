import json
import re

with open('C:/Users/Administrator/Desktop/2026-09-21-master/主流程数据集-2026-09-22/final-noun-index.json', 'r', encoding='utf-8') as f:
    new_data = json.load(f)

with open('C:/Users/Administrator/Desktop/2026-09-21-master/noun-blacklist.json', 'r', encoding='utf-8') as f:
    blacklist_data = json.load(f)

surfaces = [n['surface'] for n in new_data['nouns']]
print(f"Total surfaces in new dataset: {len(surfaces)}")

bl_set = set(blacklist_data['blacklist'])
print(f"Manual blacklist size: {len(bl_set)}")

exact_hits = [s for s in surfaces if s in bl_set]
print(f"\nExact manual-blacklist hits: {len(exact_hits)}")
if exact_hits:
    for h in exact_hits[:20]:
        print(f"  - {h}")
    if len(exact_hits) > 20:
        print(f"  ... ({len(exact_hits) - 20} more)")

# 逗号/破折号前缀碎片
leading_punct = [s for s in surfaces if re.match(r'^[,\-;]', s)]
print(f"\nLeading punctuation fragments: {len(leading_punct)}")
if leading_punct:
    for h in leading_punct[:15]:
        print(f"  - {h}")
    if len(leading_punct) > 15:
        print(f"  ... ({len(leading_punct) - 15} more)")

# 星号/井号 markdown 残留
markdown_artifact = [s for s in surfaces if re.search(r'[\*#]', s)]
print(f"\nMarkdown artifact (*, #): {len(markdown_artifact)}")
if markdown_artifact:
    for h in markdown_artifact[:15]:
        print(f"  - {h}")
    if len(markdown_artifact) > 15:
        print(f"  ... ({len(markdown_artifact) - 15} more)")

# CJK 混入
cjk_mixed = [s for s in surfaces if re.search(r'[\u4e00-\u9fff]', s)]
print(f"\nCJK mixed: {len(cjk_mixed)}")
if cjk_mixed:
    for h in cjk_mixed:
        print(f"  - {h}")

# 常见法语虚词裸露
bare_stopwords = ['selon', 'donc', 'ainsi', 'le', 'la', 'les', 'un', 'une', 'des', 'de', 'du', 'au', 'aux', 'car', 'mais', 'ou', 'et', 'ni']
stopword_hits = [s for s in surfaces if s.strip().lower() in bare_stopwords]
print(f"\nBare French function words: {len(stopword_hits)}")
if stopword_hits:
    for h in stopword_hits:
        print(f"  - {h}")

print(f"\n=== Summary ===")
print(f"Total nouns: {len(surfaces)}")
print(f"Manual blacklist hits: {len(exact_hits)}")
print(f"Leading punct fragments: {len(leading_punct)}")
print(f"Markdown artifacts: {len(markdown_artifact)}")
print(f"CJK mixed: {len(cjk_mixed)}")
print(f"Bare stopwords: {len(stopword_hits)}")
total_issues = len(exact_hits) + len(leading_punct) + len(markdown_artifact) + len(cjk_mixed) + len(stopword_hits)
print(f"Total potential stopword/noise issues: {total_issues} ({total_issues / len(surfaces) * 100:.2f}%)")
