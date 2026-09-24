"""
提升缓存命中率实验：将 15 个全量 prompt 中的"问题头+要求+格式+规范+策略"
全部移到末尾、把"全量材料"区块挪到最前面。

约束：字字不差，仅换位置（用 find 找到【【全量材料】】的字节位置，按字节切两段、再反向拼接）。

缓存原理：
  DeepSeek API 的 prefix cache 命中是从 prompt 开头算起的连续相同前缀。
  原顺序：[问题头 + 1446 chunks]   → 每个问题开头不同，cache 命中率=0%
  新顺序：[1446 chunks + 问题头]   → 1446 chunks 部分在 15 个问题间完全一致，
                                     第二个问题开始就能命中前面 165k tokens 的前缀
"""

import os
import re

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
SRC_DIR = os.path.dirname(SCRIPT_DIR)  # 父目录 cot对比实验/
OUT_DIR = SCRIPT_DIR

MARKER = '【【全量材料】】'

QIDS = [
    'Z1-Q1', 'Z1-Q2', 'Z1-Q3', 'Z1-Q4',
    'Z2-Q1', 'Z2-Q2', 'Z2-Q3', 'Z2-Q4',
    'Z3-Q1', 'Z3-Q2', 'Z3-Q3',
    'Z4-Q1', 'Z4-Q2', 'Z4-Q3', 'Z4-Q4',
]

total_src_bytes = 0
total_out_bytes = 0

for qid in QIDS:
    src_path = os.path.join(SRC_DIR, f'multipath-prompt-cot-{qid}.txt')
    out_path = os.path.join(OUT_DIR, f'multipath-prompt-cot-{qid}.txt')

    with open(src_path, 'r', encoding='utf-8') as f:
        src = f.read()

    idx = src.find(MARKER)
    if idx == -1:
        print(f'❌ {qid}: 未找到 {MARKER}，已跳过')
        continue

    # 在 marker 位置切两段：[0, idx) + [idx, end)，然后反向拼接
    header_part = src[:idx]
    chunks_part = src[idx:]
    swapped = chunks_part + header_part

    with open(out_path, 'w', encoding='utf-8') as f:
        f.write(swapped)

    src_bytes = len(src.encode('utf-8'))
    out_bytes = len(swapped.encode('utf-8'))
    total_src_bytes += src_bytes
    total_out_bytes += out_bytes

    ok = '✅' if src_bytes == out_bytes else '❌'
    print(f'{ok} {qid}: {src_bytes:,} bytes -> {out_bytes:,} bytes (split at char {idx})')

print()
print(f'合计: 源 {total_src_bytes:,} bytes → 输出 {total_out_bytes:,} bytes')
print(f'差值: {total_out_bytes - total_src_bytes} bytes（应为 0）')

# 抽样：对比源文件与输出文件的 chunk 标记集合，确认 chunks 部分完整
print()
print('抽样校验 chunks 部分完整性（取 Z1-Q1）：')
sample_qid = 'Z1-Q1'
with open(os.path.join(SRC_DIR, f'multipath-prompt-cot-{sample_qid}.txt'), 'r', encoding='utf-8') as f:
    src_sample = f.read()
with open(os.path.join(OUT_DIR, f'multipath-prompt-cot-{sample_qid}.txt'), 'r', encoding='utf-8') as f:
    out_sample = f.read()

src_ids = set(int(m.group(1)) for m in re.finditer(r'【【(\d+)】】', src_sample))
out_ids = set(int(m.group(1)) for m in re.finditer(r'【【(\d+)】】', out_sample))
src_max = max(src_ids) if src_ids else -1
out_max = max(out_ids) if out_ids else -1
print(f'  源文件 chunk id 集合大小 = {len(src_ids)}（最大 {src_max}）')
print(f'  输出文件 chunk id 集合大小 = {len(out_ids)}（最大 {out_max}）')
print(f'  一致性: {"✅" if len(src_ids) == len(out_ids) and src_max == out_max else "❌"}')

# 额外校验：源文件 header 部分 vs 输出文件末尾部分，应当字节完全相同
header_part_sample = src_sample[:src_sample.find(MARKER)]
out_tail = out_sample[-len(header_part_sample):] if len(out_sample) >= len(header_part_sample) else ''
print(f'  header 段字节级一致: {"✅" if out_tail == header_part_sample else "❌"}')
