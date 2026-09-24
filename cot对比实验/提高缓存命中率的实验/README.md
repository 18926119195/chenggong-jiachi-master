# 提高缓存命中率的实验

## 实验背景

DeepSeek API 的 **prefix cache** 命中规则：从 prompt 开头算起的连续相同前缀才命中。缓存前缀越长、用得越久，省钱效果越好。

原 `multipath-prompt-cot-<id>.txt` 的结构（每文件 15 个，共 Z1-Q1 ~ Z4-Q4）：

```
┌──────────────────────────────────┐ ← 问题头（每个问题不同，约 580 字符）
│ PROMPT 1 (Z1-Q1)                 │
│ 问题：Pierre Janet 和 Freud...    │
│ 要求：...                        │
│ 格式：...                        │
│ 引用规范：...                    │
│ 推理策略：...                    │
└──────────────────────────────────┘
┌──────────────────────────────────┐ ← 【【全量材料】】（1446 chunks，约 622 KB）
│ ...1446 个材料【【1】】~【【1446】】...
└──────────────────────────────────┘
```

由于每条 prompt 的"问题头"在 prompt 最前面，**第 2 条到第 15 条 prompt 的 1446 个 chunks 前缀在 API 看来都不算"前缀"**——因为前面拼了不同的 ~580 字问题头。整个批量 15 条的 prefix cache 命中率约 0%（除了第 2 条偶然复用第 1 条的尾部小段）。

## 优化方案

把 chunks 部分挪到 prompt 最前面，问题头扔到末尾：

```
┌──────────────────────────────────┐ ← 【【全量材料】】（1446 chunks，约 622 KB）
│ ...1446 个材料【【1】】~【【1446】】...
└──────────────────────────────────┘
┌──────────────────────────────────┐ ← 问题头（每个问题不同，约 580 字符）
│ PROMPT 1 (Z1-Q1)                 │
│ 问题：Pierre Janet 和 Freud...    │
│ 要求：...                        │
└──────────────────────────────────┘
```

这样从第 2 条 prompt 开始，前面的 ~622 KB（≈ 165k tokens）是 **完全相同**的 chunks 内容，DeepSeek 可以直接命中 prefix cache，只需要续算末尾 ~580 字符的新增内容。

## 字节级精确换位（字字不差）

每个文件用 `Find-BytesInBytes` 找到 marker `【【全量材料】】` 的字节位置，按字节切两段、反向拼接：

```
header = src[0 .. idx)        # idx 是 marker 的字节偏移
chunks = src[idx .. end]
out   = chunks + header       # 仅交换位置
```

## 验证结果（15/15 通过）

| 文件                | src 字节 | out 字节 | 分隔点 | 头尾一致 | chunks 一致 |
| ------------------- | -------- | -------- | ------ | -------- | ----------- |
| Z1-Q1 ~ Z4-Q4 (15) | 9,349,661 | 9,349,661 | 1029 ~ 1082 字节 | ✅ | ✅ |

- **字节级**：源文件总字节数 == 输出文件总字节数（差值 = 0）
- **头尾级**：每个文件输出末尾 ~1046 字节 == 源文件头部 ~1046 字节（问题头位置正确）
- **chunks 级**：每个文件输出前段 ~622 KB == 源文件 marker 之后 ~622 KB（chunks 完整无缺）
- **marker 位置**：输出文件的 marker 都出现在字节偏移 0（chunks 严格在 prompt 最前面）

详见 [`_reorder_result.txt`](./_reorder_result.txt)。

## 跑批预期收益

- 原本：cache 命中率 ≈ 0%
- 改后：第 1 条无命中（首次建立缓存）；第 2 条起每条都能命中前面所有 chunks 的完整前缀
- 更核心的价值在 **延迟**：cache 命中时首字返回速度通常快 5~10 倍（无需重算前缀的 KV cache）

## 文件清单

```
cot对比实验/提高缓存命中率的实验/
├── README.md                          ← 本文件
├── reorder-prompts-for-cache.js       ← 单次跑批量重排脚本（Node.js）
├── reorder-prompts-for-cache.py       ← 单次跑批量重排脚本（Python）
├── verify-reorder.ps1                 ← 字节级校验脚本（PowerShell）
├── _reorder_result.txt                ← 校验日志（15 个文件全部 OK，diff=0）
├── multipath-prompt-cot-Z1-Q1.txt     ← 15 个 chunks-first 版本的新 prompt
├── multipath-prompt-cot-Z1-Q2.txt
├── ...（共 15 个）
└── multipath-prompt-cot-Z4-Q4.txt
```

## 跑法

```bash
# 重新生成（已生成，可重复运行）
node reorder-prompts-for-cache.js     # 或 python reorder-prompts-for-cache.py

# 字节级校验（依赖 PowerShell）
powershell -ExecutionPolicy Bypass -File verify-reorder.ps1
```

## 注意事项

1. **prompt 内容约束一致**：仅交换字节顺序，任何一个字都没动。引用规范、推理策略、问题文本、chunks 文本全部原样保留。
2. **LLM 推理行为不变**：DeepThink / 多路径生成 / 引用 `【【N】】` 规范与原版相同。
3. **要跑推理**：把 `run-reasoning-cot.js` / `run-full-cot-pipeline.js` 中的 prompt 路径指向本文件夹下的新文件即可。

## 后续验证建议

跑完新版 prompt 推理后，建议对比以下指标与原版 `cot对比实验/reasoning-output-cot-<id>.json`：
- 缓存命中率（应当从 ~0% → ~93%+）
- 平均耗时（应当降低）
- 平均成本（应当降低）
- 推理内容质量（应当无显著差异，因为 prompt 内容完全等价）
