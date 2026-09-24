# 2026-09-23 Cache Test Rerun - Remainder（13题补跑）

## 实验说明

本次补跑剩余 13 道题（Z1-Q2~Z4-Q4），保留上午已跑的 Z1-Q1 和 Z2-Q2，与旧版（2026-08-23，15题全局并发）形成对照。

## 数据保存策略

- `_before-backup/`：跑前备份当前 `完整的运作/` 全部文件（5 json + 15 multipath-prompt + 15 reasoning-output）
- `snapshots/`：13 题 LLM 调用快照（逐题子目录）
- `logs/`：各步骤日志和汇总报告
- `final/`：跑完后 15 题最终输出副本（3 json + 15 prompt + 15 reasoning）
- `完整的运作/`：最终合并结果（15题），与 `final/` 内容一致

## 核心改动（recall-nouns-llm.js）

在 `for (const q of qList)` 循环前明确策略注释：
- 题间顺序执行（for 循环）：最大化 prompt-cache 命中率
- 题内 8 批次并发：保持召回效率
- 精打阶段攒满一轮粗筛结果再并发：保证精打缓存命中率

代码逻辑本身不变，仅让策略注释与实际行为对齐。

## 各步骤耗时估算

| 步骤 | 耗时 |
|------|------|
| recall-nouns-llm（13题，串行） | ~3 分钟 |
| build-prompt-with-traceback | ~5 秒 |
| generate-multipath-prompt（×13） | ~1 秒/题 |
| run-reasoning（×13，LLM推理） | ~3-5 分钟/题 |
| **合计** | **约 10-15 分钟** |

## 关键结果

| 指标 | 旧版（15题并发） | 新版（单题串行） |
|------|----------------|----------------|
| 缓存命中率 | 0.07% | 96-99.9% |
| 粗筛 completion tokens/题 | ~170,784 | 132-6,086 |
| 召回耗时/题 | ~48s | ~10-13s |

## 文件清单

### _before-backup/
- noun-recall-results.json（跑前版本）
- candidate-texts-for-llm.json（跑前版本）
- material-traceback-map.json（跑前版本）
- final-noun-index.json
- multipath-prompt-*.txt × 15
- reasoning-output-*.json × 15

### snapshots/
- Z1-Q2/（99 calls）
- Z1-Q3/（49 calls）
- Z1-Q4/（48 calls）
- Z2-Q1/（50 calls）
- Z2-Q3/（49 calls）
- Z2-Q4/（53 calls）
- Z3-Q1/（49 calls）
- Z3-Q2/（49 calls）
- Z3-Q3/（48 calls）
- Z4-Q1/（50 calls）
- Z4-Q2/（50 calls）
- Z4-Q3/（48 calls）
- Z4-Q4/（48 calls）

注：Z1-Q1 和 Z2-Q2 的快照在 runs/2026-09-23-cache-test-rerun/snapshots/

### logs/
- rerun-all-13q.log（13题召回日志）
- rerun-build-prompt.log
- rerun-prompt-*.log × 13
- rerun-reasoning-*.log × 13
- rerun-summary.txt（命中率对比汇总）
