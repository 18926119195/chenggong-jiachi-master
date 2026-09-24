# 9.24 最终版本

## 概述

本目录用于运行完整的 15 问题推理流程（阶段 2 → 阶段 5），并以**每个问题为界限**存储中间数据、最终结果和 LLM 快照。

## 文件夹结构

```
9.24最终版本/
├── README.md                   ← 本文件
├── .env                        ← LLM 配置（API_KEY 必填，其余已预填）
├── config/
│   └── llm-config.json         ← 当前 LLM 配置快照（方便核对）
├── scripts/
│   ├── MANIFEST.md             ← 脚本清单（每个脚本的用途和调用方式）
│   ├── recall-nouns-llm.js
│   ├── build-prompt-with-traceback.js
│   ├── generate-multipath-prompt.js
│   ├── run-reasoning.js
│   └── reorganize-to-qfolders.cjs   ← 跑完后将产物重新分配到 runs/ 子文件夹
└── runs/                       ← 跑完后自动生成，每题一个子文件夹
    ├── Q01/
    │   ├── multipath-prompt.txt
    │   ├── reasoning-output.json
    │   └── snapshots/          ← 该题相关的 LLM 调用快照
    │       ├── call-NNNN-request.json
    │       ├── call-NNNN-prompt.txt
    │       ├── call-NNNN-response.json
    │       └── call-NNNN-output.txt
    ├── Q02/
    │   └── ...
    └── Q15/
```

## 数据流向（全局 → 分题）

```
阶段 2  [全量]  recall-nouns-llm.js          → noun-recall-results.json
阶段 3  [全量]  build-prompt-with-traceback.js → candidate-texts-for-llm.json
                                                material-traceback-map.json
阶段 4  [逐题]  generate-multipath-prompt.js  → multipath-prompt-<QID>.txt
阶段 5  [逐题]  run-reasoning.js              → reasoning-output-<QID>.json
                                                      ↓
                                           runs/<QID>/（由 reorganize 脚本分配）
```

## 前置条件

运行前确认以下文件已就位于 `chenggong-jiachi-master/` 根目录：

| 文件 | 说明 |
|---|---|
| `final-noun-index.json` | 阶段 1 输出的名词索引（必填） |
| `test-questions.json` | 15 题题库 |
| `noun-blacklist.json` | 召回黑名单 |
| `src/core/llmClient.js` | LLM 调用（含快照功能，`SNAPSHOT_DIR` 已改为 `process.cwd()/snapshots`） |
| `src/core/pureTextTable.js` | 纯文本检索表 |
| `.env` | API key 配置（已复制到本目录，需确认） |

docuverse 文件路径由 `DOCUVERSE_PATH` 环境变量决定，当前 fallback 值为：
```
C:\Users\Administrator\Desktop\docuverse_cartographies_squizoanalythiques_Fe_lix_Guattari_1789114122714.docuverse.json
```
请确认该文件存在。

## 运行步骤

### 步骤 1 — 确认配置

1. 打开 `.env`，确认 `LLM_API_KEY` 已填写。
2. 打开 `config/llm-config.json`，与 `.env` 比对确认一致。

### 步骤 2 — 跑完整流程（不分组）

```powershell
cd C:\Users\Administrator\Desktop\chenggong-jiachi-master
node run-test15-with-snapshot.js
```

所有产物默认落在 `chenggong-jiachi-master/` 根目录（`noun-recall-results.json` 等全局文件 + `snapshots/` 快照目录 + `multipath-prompt-*.txt` / `reasoning-output-*.json` × 15）。

### 步骤 3 — 按题分配到子文件夹

```powershell
cd C:\Users\Administrator\Desktop\chenggong-jiachi-master\9.24最终版本
node scripts/reorganize-to-qfolders.cjs
```

将全局产物重新分配到 `runs/Q01/` ~ `runs/Q15/` 各子目录，详见 `scripts/MANIFEST.md`。

## LLM 配置（当前）

见 `config/llm-config.json`。

## 快照机制

LLM 调用快照由 `src/core/llmClient.js` 自动生成，写入 `snapshots/` 目录，每个调用产生 4 个文件：

| 文件 | 内容 |
|---|---|
| `call-NNNN-request.json` | 请求元数据（timestamp、promptLength、options） |
| `call-NNNN-prompt.txt` | 完整输入 prompt |
| `call-NNNN-response.json` | 响应元数据（usage、truncated、elapsed） |
| `call-NNNN-output.txt` | 完整输出文本 |

`callId` 在每次进程启动时从 `call-0001` 重新计数。
