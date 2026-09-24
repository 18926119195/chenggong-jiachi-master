import json
import random

# 读取文件
with open('final-noun-index.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

# 提取所有s1-llm的名词
s1_nouns = [noun for noun in data['nouns'] if noun.get('source') == 's1-llm']

print(f"=== s1-llm 名词总数: {len(s1_nouns)} ===\n")

# 统计surface长度分布
lengths = [len(noun['surface']) for noun in s1_nouns]
print(f"surface长度统计:")
print(f"  最短: {min(lengths)}")
print(f"  最长: {max(lengths)}")
print(f"  平均: {sum(lengths)/len(lengths):.1f}")
print(f"  超过50字符: {sum(1 for l in lengths if l > 50)} 条")
print(f"  超过100字符: {sum(1 for l in lengths if l > 100)} 条\n")

# 统计包含逗号、冠词等特征的条目
comma_count = sum(1 for n in s1_nouns if ',' in n['surface'])
article_count = sum(1 for n in s1_nouns if n['surface'].lower().startswith(('le ', 'la ', 'les ', 'un ', 'une ', 'des ', 'l\'', 'd\'', 'de ', 'du ')))

print(f"包含逗号: {comma_count} 条 ({comma_count/len(s1_nouns)*100:.1f}%)")
print(f"以冠词/介词开头: {article_count} 条 ({article_count/len(s1_nouns)*100:.1f}%)\n")

# 随机采样50个进行人工审阅
sample_size = min(50, len(s1_nouns))
samples = random.sample(s1_nouns, sample_size)

print(f"=== 随机采样 {sample_size} 个s1名词 ===\n")
for i, noun in enumerate(samples, 1):
    surface = noun['surface']
    offset_count = len(noun['offsets'])
    print(f"{i:2d}. [{offset_count:3d}次] {surface}")

# 单独列出那些"可疑"条目（长度>50或含逗号）
suspicious = [n for n in s1_nouns if len(n['surface']) > 50 or ',' in n['surface']]
print(f"\n\n=== 可疑条目（长度>50或含逗号）共 {len(suspicious)} 条 ===\n")
for i, noun in enumerate(suspicious[:30], 1):  # 只显示前30个
    surface = noun['surface']
    offset_count = len(noun['offsets'])
    print(f"{i:2d}. [{offset_count:3d}次] {surface}")

if len(suspicious) > 30:
    print(f"\n... 还有 {len(suspicious)-30} 条可疑条目未显示")
