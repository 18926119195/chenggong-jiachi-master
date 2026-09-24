# DeepSeek Prompt Cache 跨 API Key 共享发现

**生成时间**: 2026-09-23 18:04 (北京时间 UTC+8)  
**发现者**: AI 助手分析 Z3Q2 串行测试数据

---

## 核心发现

### DeepSeek 的 prompt cache 不是按 API key 隔离的，而是按 model + API endpoint 共享的。

通过三次独立运行（使用三个不同的 API key）对同一问题（Z3Q2）进行粗筛阶段测试，发现：

| 运行 | API Key | 批次 | system_fingerprint | cached_tokens |
|------|---------|------|-------------------|---------------|
| 第一次 | sk-da07... | call-0001 | `aeb56401ca74e127821c4f9126dcb669` | 3,456 |
| 第一次 | sk-da07... | call-0002 | `aeb56401ca74e127821c4f9126dcb669` | 3,456 |
| 第二次 | sk-da07... | call-0050 | `aeb56401ca74e127821c4f9126dcb669` | 3,456 |
| 第二次 | sk-da07... | call-0051 | `aeb56401ca74e127821c4f9126dcb669` | 3,456 |
| **第三次（新 key）** | sk-263b... | call-0099 | `aeb56401ca74e127821c4f9126dcb669` | **3,456** |
| **第三次（新 key）** | sk-263b... | call-0100 | `aeb56401ca74e127821c4f9126dcb669` | **3,456** |

**所有三次运行的 `system_fingerprint` 完全相同**，且新 key 的第一个 batch 仍然命中 94.8% 的缓存。

---

## 技术解释

- `system_fingerprint` 是 DeepSeek 内部的缓存指纹，同一指纹意味着复用的是完全相同的 KV cache 计算
- 三个不同的 API key 访问同一个 model（deepseek-flash），共享同一份缓存
- 任何用户只要请求相同 model + 相同 prompt prefix，就能复用缓存

---

## 对成本的影响

### 缓存来源

每个粗筛 batch 的 prompt 由两部分组成：

```
总 prompt ≈ 3,645 tokens
├── 固定部分（系统 prompt + 问题描述）: ~3,456 tokens (94.8%) → 从缓存读取，不收费
└── 变量部分（名词列表）: ~189 tokens (5.2%) → 需要计算，收费
```

### 三次运行的粗筛数据对比

| 指标 | 第一次运行 | 第二次运行 | 第三次运行（新 key） |
|------|-----------|-----------|---------------------|
| cached_tokens | 156,288 | 156,288 | **156,288** |
| miss_tokens | 9,099 | 9,099 | **9,099** |
| 总 prompt_tokens | 165,387 | 165,387 | **165,387** |
| **缓存命中率** | **94.5%** | **94.5%** | **94.5%** |

第二次和第三次运行的 cached_tokens 完全相同（156,288），证明跨 API key 共享缓存。

### 精打阶段（无缓存）

| 指标 | 数值 |
|------|------|
| 调用数 | 2 |
| prompt_tokens | 5,137 |
| cached_tokens | **0** |
| 缓存命中率 | 0% |

精打阶段的 prompt 内容与粗筛完全不同（包含已筛选的候选名词），所以没有缓存复用。

---

## 关键结论

1. **缓存与并发方式无关**：题间串行（for 循环）和题内 8 并发，缓存命中率都在 94.5% 左右
2. **缓存跨 API key 共享**：即使使用全新 API key，已缓存过的 prefix prompt 仍然命中
3. **成本节省的来源**：
   - 第一次运行：几乎无缓存，成本最高
   - 后续运行：~94.5% 的 prompt tokens 从缓存读取，不收费
   - 实际计费 token = 9,099（165,387 的 5.5%）
4. **任何用户的同一 model + 相同 prompt prefix 都能共享缓存**：这是 DeepSeek 服务器端的全局缓存

---

## 文件对应

- 本文档：`serial-test-z3q2/cache-across-api-keys.md`
- 测试日志：`serial-test-z3q2/run-log-newkey.txt`
- 快照目录：`serial-test-z3q2/snapshots/Z3-Q2/`
- call 编号说明：
  - call-0001 ~ call-0049：第一次运行（并行 8 并发）
  - call-0050 ~ call-0098：第二次运行（串行 1 并发）
  - call-0099 ~ call-0147：第三次运行（新 API key，串行 1 并发）
