import json
with open(r'C:\Users\Administrator\Desktop\chenggong-jiachi-master\cot对比实验\提高缓存命中率的实验\llm-configs\reasoning-output-Z1-Q3.json', 'r', encoding='utf-8') as f:
    data = json.load(f)
tc = data['thinkingChain']
print('Total length:', len(tc))
positions = [10066, 21128, 21213, 21245, 21277, 21305, 21348, 21382, 22820]
for p in positions:
    start = max(0, p-30)
    end = min(len(tc), p+250)
    print(f'=== Position {p} ===')
    print(repr(tc[start:end]))
    print()
