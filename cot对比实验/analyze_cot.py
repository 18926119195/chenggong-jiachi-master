import re

# 读取文件
with open(r'C:\Users\Administrator\Desktop\zhongjiban-ultimate-master\cot对比实验\src-cot\cot推理llm的过程记录', 'r', encoding='utf-8') as f:
    lines = f.readlines()

# 找到所有"问题："的位置
question_indices = []
for i, line in enumerate(lines):
    if line.startswith('问题：'):
        question_indices.append(i)

print(f"总行数: {len(lines)}")
print(f"问题数: {len(question_indices)}")
print()

# 对每个问题块，找到思维链结束标志
results = []
for idx, q_line in enumerate(question_indices):
    # 确定该问题块的范围
    if idx + 1 < len(question_indices):
        block_end = question_indices[idx + 1]
    else:
        block_end = len(lines)
    
    # 提取问题文本
    question_text = lines[q_line].replace('问题：', '').strip()
    
    # 在该块内查找思维链结束标志
    cot_end_line = q_line  # 默认无思维链
    markers = ['开始写最终', '现在写最终', '开始写：', '我们开始写', '最终回答。', '现在构建最终回答']
    
    for i in range(q_line, block_end):
        line_text = lines[i].strip()
        for marker in markers:
            if marker in line_text:
                cot_end_line = i
    
    cot_lines = cot_end_line - q_line
    output_lines = block_end - cot_end_line - 1
    
    results.append({
        'num': idx + 1,
        'question': question_text[:50] + ('...' if len(question_text) > 50 else ''),
        'q_start': q_line + 1,
        'cot_end': cot_end_line + 1,
        'block_end': block_end,
        'cot_lines': cot_lines,
        'output_lines': output_lines
    })

# 输出结果
for r in results:
    print(f"问题{r['num']}: {r['question']}")
    print(f"  位置: 行{r['q_start']}-{r['block_end']}")
    print(f"  思维链: {r['cot_lines']}行 (行{r['q_start']}-{r['cot_end']})")
    print(f"  输出: {r['output_lines']}行 (行{r['cot_end']+1}-{r['block_end']})")
    print()
