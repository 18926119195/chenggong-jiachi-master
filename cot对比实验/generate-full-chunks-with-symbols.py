"""
生成全量材料文件（带机器符号）
用于上传到 DeepSeek 官网聊天测试全量推理效果
"""
import json

# 读取候选材料
with open('candidate-texts-for-llm-cot.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

# 找到 Z1-Q1 问题
entry = next(x for x in data if x['questionId'] == 'Z1-Q1')

# 构建输出内容
output = f"""# 全量材料（带机器符号）

问题：{entry['question']}
材料总数：{len(entry['chunks'])} chunks

---

"""

# 添加所有 chunks，每个前面带【【id】】标记
for chunk in entry['chunks']:
    output += f"【【{chunk['id']}】】 {chunk['text']}\n\n"

# 写入文件
with open('full-chunks-with-symbols-Z1-Q1.txt', 'w', encoding='utf-8') as f:
    f.write(output)

print(f'✅ 已生成: full-chunks-with-symbols-Z1-Q1.txt ({len(entry["chunks"])} chunks)')
