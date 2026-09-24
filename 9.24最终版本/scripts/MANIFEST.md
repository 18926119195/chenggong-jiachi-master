# 脚本清单（MANIFEST）

本文档记录本实验用到的所有脚本，包括来源、用途、入口参数。

---

## 阶段 2 — 名词召回（全局，all questions at once）

### `recall-nouns-llm.js`

| 属性 | 值 |
|---|---|
| 路径 | `chenggong-jiachi-master/recall-nouns-llm.js` |
| 阶段 | 阶段 2（粗筛 + 精打分） |
| 并发 | 题间顺序逐题，题内 8 并发 chunk |
| 输入 | `final-noun-index.json`、docuverse、`noun-blacklist.json` |
| 输出 | `noun-recall-results.json` |
| LLM 调用次数 | 每题约 1 次粗筛 + 若干次精打分（按 candidate 数） |

```powershell
node recall-nouns-llm.js
```

无参数，全量跑所有 `test-questions.json` 里的问题。可用 `QUESTION_IDS=Z1-Q1,Z1-Q2` 环境变量限定题号。

---

## 阶段 3 — 构建推理输入（全局，all questions at once）

### `build-prompt-with-traceback.js`

| 属性 | 值 |
|---|---|
| 路径 | `chenggong-jiachi-master/build-prompt-with-traceback.js` |
| 阶段 | 阶段 3（拓扑链 + 溯源映射） |
| 输入 | `noun-recall-results.json` |
| 输出 | `candidate-texts-for-llm.json`、`material-traceback-map.json` |

```powershell
node build-prompt-with-traceback.js
```

无参数，全量处理。

---

## 阶段 4 — 生成 Prompt（逐题）

### `generate-multipath-prompt.js`

| 属性 | 值 |
|---|---|
| 路径 | `chenggong-jiachi-master/generate-multipath-prompt.js` |
| 阶段 | 阶段 4（生成 multipath prompt） |
| 输入 | `candidate-texts-for-llm.json`、`material-traceback-map.json`、`test-questions.json` |
| 输出 | `multipath-prompt-<QID>.txt` |
| LLM 调用次数 | 0（纯本地生成） |

```powershell
node generate-multipath-prompt.js <QID>
# 例如：
node generate-multipath-prompt.js Z1-Q1
```

**必须传 QID 参数**，不传则报错退出。

---

## 阶段 5 — 执行推理（逐题）

### `run-reasoning.js`

| 属性 | 值 |
|---|---|
| 路径 | `chenggong-jiachi-master/run-reasoning.js` |
| 阶段 | 阶段 5（LLM 推理） |
| 输入 | `multipath-prompt-<QID>.txt`、`material-traceback-map.json` |
| 输出 | `reasoning-output-<QID>.json` |
| LLM 调用次数 | 1 次（每题） |

```powershell
node run-reasoning.js <QID>
# 例如：
node run-reasoning.js Z1-Q1
```

**必须传 QID 参数**，不传则报错退出。

---

## 编排脚本

### `run-test15-with-snapshot.js`

| 属性 | 值 |
|---|---|
| 路径 | `chenggong-jiachi-master/run-test15-with-snapshot.js` |
| 作用 | 顺序调用阶段 2 → 3 → 逐题 4 → 逐题 5，全程保留快照 |
| 快照输出 | `snapshots/` 目录（4 件套 × 所有 LLM 调用） |
| 汇总报告 | `execution-summary.json` |

```powershell
cd chenggong-jiachi-master
node run-test15-with-snapshot.js
```

无参数。`cwd` 必须指向有 `final-noun-index.json` 等前置文件的目录。

---

## 事后整理脚本

### `reorganize-to-qfolders.cjs`

| 属性 | 值 |
|---|---|
| 路径 | `9.24最终版本/scripts/reorganize-to-qfolders.cjs` |
| 作用 | 将根目录的全局产物分配到 `runs/Q01/` ~ `runs/Q15/` |
| 依赖 | 阶段 2-5 已完整运行，所有产物已在根目录 |

```powershell
cd 9.24最终版本
node scripts/reorganize-to-qfolders.cjs
```

整理规则：

| 产物 | 目标位置 |
|---|---|
| `noun-recall-results.json` | 复制到 `runs/`（所有题共享） |
| `candidate-texts-for-llm.json` | 复制到 `runs/`（所有题共享） |
| `material-traceback-map.json` | 复制到 `runs/`（所有题共享） |
| `multipath-prompt-<QID>.txt` | 移动到 `runs/<QID>/` |
| `reasoning-output-<QID>.json` | 移动到 `runs/<QID>/` |
| `snapshots/` 下的文件 | 根据 `callId` 前缀映射到对应 `runs/<QID>/snapshots/`（需结合 `execution-summary.json` 溯源） |
| `execution-summary.json` | 复制到 `runs/` |

---

## 不使用的脚本（本实验排除）

| 脚本 | 排除原因 |
|---|---|
| `validate-s0-quality.js` | 阶段 1 质控，已跳过 |
| `s1-llm-fill.js` | 阶段 1 LLM 填充，已跳过 |
| `merge-s0-s1.js` | 阶段 1 合并，已跳过 |
| `merge-s0-s1-dedup.js` | 去重版，同上 |
| `setup-windows.ps1` | 环境初始化，已完成 |
| `reasoning-multi-path.js` | 多路径解析实验代码，保留但本次不调用 |
| `rerun-from-scoring.js` | 已删除（9-21 旧管线化石） |
| `analyze-token-cost.cjs` | cache-hit 对比分析，本次不需要 |
| `analyze-phases.cjs` | 同上 |
