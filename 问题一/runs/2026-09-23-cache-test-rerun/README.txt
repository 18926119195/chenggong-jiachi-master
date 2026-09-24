================================================================
缓存命中率优化重跑 - Z1-Q1 和 Z2-Q2
================================================================

跑跑时间： 2026-09-23 下午 (北京时间)
目的：   对比"同题串行并发" vs 之前 15 题全局并发的 prompt-cache 命中率
跑跑的人： Cursor Assistant

----------------------------------------------------------------
本次跑跑的代码改动
----------------------------------------------------------------
在 完整的运作/recall-nouns-llm.js 的 for 循环前加了一段注释，
明确策略："题间顺序执行（for 循环），题内 8 并发（CONCURRENCY）"。
代码逻辑本身没有改，只是让策略和意图对齐。

未改任何：
  - .env / API 配置
  - src/core/llmClient.js 的重试/快照逻辑
  - test-questions.json
  - final-noun-index.json
  - 黑名单 noun-blacklist.json

----------------------------------------------------------------
目录布局
----------------------------------------------------------------
问题一/runs/2026-09-23-cache-test-rerun/
├── README.txt                    ← 本文件
├── _before-backup/               ← 跑之前的 7 个旧文件（永不动）
│   ├── noun-recall-results.json
│   ├── candidate-texts-for-llm.json
│   ├── material-traceback-map.json
│   ├── reasoning-output-Z1-Q1.json
│   ├── reasoning-output-Z2-Q2.json
│   ├── multipath-prompt-Z1-Q1.txt
│   └── multipath-prompt-Z2-Q2.txt
├── snapshots/                    ← 新的 LLM 调用快照（按 questionId 子目录）
│   ├── Z1-Q1/
│   │   ├── call-0001-request.json ... call-0048-request.json
│   │   └── call-0001-response.json ... call-0048-response.json
│   └── Z2-Q2/
├── noun-recall-results.json      ← 重跑的新结果（只含 Z1-Q1 和 Z2-Q2）
├── candidate-texts-for-llm.json  ← 重跑的新结果
├── material-traceback-map.json   ← 重跑的新结果
├── multipath-prompt-Z1-Q1.txt    ← 重跑的新 prompt
├── multipath-prompt-Z2-Q2.txt    ← 重跑的新 prompt
├── reasoning-output-Z1-Q1.json   ← 重跑的新推理输出
├── reasoning-output-Z2-Q2.json   ← 重跑的新推理输出
└── logs/
    ├── rerun-Z1-Q1.log
    ├── rerun-Z2-Q2.log
    └── rerun-summary.txt         ← 命中率对比汇总

----------------------------------------------------------------
对比方法
----------------------------------------------------------------
对比对象：
  - _before-backup/ 里的旧文件 (本次跑之前，15题全局并发，命中率 0.07%)
  - 本目录的新文件   (本次新跑，Z1-Q1 和 Z2-Q2 单独跑)

查看命中率：
  打开 snapshots/Z1-Q1/llm-calls-summary.json 或 Z2-Q2/llm-calls-summary.json
  看 aggregate.totalCacheHitTokens / aggregate.totalPromptTokens
