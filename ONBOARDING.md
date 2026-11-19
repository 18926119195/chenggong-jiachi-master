# chenggong-jiachi-master 入库指南

[一分钟定位](#一分钟定位) · [沿聊天时间线看灵感](#沿聊天时间线看灵感) · [从代码反查来由](#从代码反查来由) · [走读与维护记录](#走读与维护记录)

## 一分钟定位

这是 Docuverse 名词召回与多路径推理的 9 月 24 日快照。当天的问题是，同一套 15 题究竟使用哪份数据、如何复跑、怎样找到每个回答的引用和调用快照。以下状态以 [`master @ 9da50bc`](https://github.com/18926119195/chenggong-jiachi-master/commit/9da50bc1f5731a2c988a1bd906f8e427044033b8) 为准。

- [当天索引](TODAY-INDEX.md)通向 12 份原始开发会话，`file-notes/` 和 `terminals-index/` 补充文件与终端脉络。
- [9.24 说明](9.24最终版本/README.md)和[阶段清单](9.24最终版本/scripts/MANIFEST.md)说明根目录脚本如何先写全局材料，再写逐题 Prompt 与推理。[`问题一/runs/`](问题一/runs/)保存含 09-23 和 09-24 的运行档案。
- [CoT 缓存实验](cot对比实验/提高缓存命中率的实验/README.md)是独立对照。按使用的题集、输入和模式来解释其结果。

借用钱学森工程控制论的观察与反馈来组织这批记录：用户关心的问题先用聊天确定，再以脚本、输入和运行批次作观察；根据差异更新对应解释，并注明每项结果的实验版本。

## 沿聊天时间线看灵感

**如何读状态。** 已实现表示在所列版本找到与灵感相符的代码路径。部分实现表示已有其中一段。未实现表示已查的入口尚无对应实现。证据不足时标待确认。归档与设计文稿按资料本身的状态描述。

下列日期均为 2026-09-24，北京时间；索引里列的是会话起始时间。

| ID | 聊天位置 | 当时的灵感或要求 | 当前状态 | 实现证据 |
| --- | --- | --- | --- | --- |
| <a name="idea-i01"></a>I01 | 10:15，索引里的 CoT 对比会话 `2e343cf4` | 在相同材料上核对 thinking 开关与缓存、速度、费用和回答差异。 [当天索引](TODAY-INDEX.md) | 部分落地 | 两题对照有运行与统计，回答质量仍标待人工评估。 [CoT 对照](cot对比实验/提高缓存命中率的实验/COMPARISON-REPORT.md) |
| <a name="idea-i02"></a>I02 | 11:06，问 API 怎样保留上下文，追查 prompt 前缀及复用条件 | 比较输入的公共前缀，尝试把共同材料放在可复用的位置。 [当天索引](TODAY-INDEX.md) | 已有实验实现 | 重排脚本把 chunks 提到问题前，实验报告展示两题中的第二题缓存指标。 [Prompt 重排](cot对比实验/提高缓存命中率的实验/reorder-prompts-for-cache.js) |
| <a name="idea-i03"></a>I03 | 14:56，询问快照备份与实验目录有什么区别 | 区分运行前备份、当时活动副本和本次最终结果。 [版本辨识会话](chats/d88c8485-40c1-48c7-9da1-12111254d869.md) | 已落为档案 | 09-23 数据版本表给出各目录角色、时间点和逐题差异；09-24 复跑也保有备份与 `final/`。 [09-23 版本表](问题一/runs/2026-09-23-cache-test-rerun-remainder/DATA-VERSIONS.md) · [09-24 复跑说明](问题一/runs/2026-09-24-cache-test-rerun/README.txt) |
| <a name="idea-i04"></a>I04 | 16:35，提供计费参照并要求按文件核算 | 让一次实验的费用能追到具体文件及阶段。 [计费会话](chats/d1fa02de-606c-472e-b761-31748b84d5ce.md) | 已有分析脚本和报告 | 根目录有 token 成本脚本；CoT 报告列有两次请求的计费比较。价格仅对应历史假定。 [成本分析](analyze-token-cost.cjs) · [历史报告](cot对比实验/提高缓存命中率的实验/COMPARISON-REPORT.md) |
| <a name="idea-i05"></a>I05 | 16:39，索引里从 Z1-Q3 指定范围追问对应的文本证据 `281b9f6a` | 从输出中引用的编号追到支撑推理路径的材料。 [当天索引](TODAY-INDEX.md) | 部分落地 | CoT 实验的脚本比对两类输出的引用编号，另有带选择逻辑的溯源脚本。编号对应和支撑语义仍是两层证据。 [编号核对](cot对比实验/提高缓存命中率的实验/verify-citation-mapping.js) · [路径溯源](cot对比实验/提高缓存命中率的实验/llm-configs/trace_mapper.ps1) |
| <a name="idea-i06"></a>I06 | 19:02，要求复刻 09-23 生产过程并重跑 15 题 | 将旧产物留在原归档边界，按题保存新一批。 [当天索引](TODAY-INDEX.md) | 已有复跑记录 | 09-24 有专用 runner、汇总及 `final/`，归档 JSON 和推理文件的题号与 15 题题库一致。 [复跑入口](问题一/runs/2026-09-24-cache-test-rerun/runner.cjs) · [说明](问题一/runs/2026-09-24-cache-test-rerun/README.txt) |

## 从代码反查来由

| 入口 | 回读聊天 | 读代码时的关注点 |
| --- | --- | --- |
| [`reorder-prompts-for-cache.js`](cot对比实验/提高缓存命中率的实验/reorder-prompts-for-cache.js) | [I01](#idea-i01)、[I02](#idea-i02) | 共同 chunks 的顺序对应缓存假设；报告的成本和质量证据各有范围。 |
| [`verify-citation-mapping.js`](cot对比实验/提高缓存命中率的实验/verify-citation-mapping.js) | [I05](#idea-i05) | 输入是回答和 thinking 文本；核心检查是引用编号的对应。 |
| [`run-test15-with-snapshot.js`](run-test15-with-snapshot.js) 与[逐题整理](9.24最终版本/scripts/reorganize-to-qfolders.cjs) | [I03](#idea-i03)、[I06](#idea-i06) | 根目录编排会写共享产物；逐题整理器用执行摘要推断调用归属。专题复跑使用另一个 `runner.cjs`。 |

## 走读与维护记录

从 09-24 [复跑说明](问题一/runs/2026-09-24-cache-test-rerun/README.txt) 选 Z3-Q2，先看它的 `final/` 产物，再沿 [I06](#idea-i06) 查为什么旧档案也有同名输出。读完应能解释哪份是 09-24 复跑、快照与最终答复分别在哪、为何缓存对照的两个问题不能概括全量复跑。日后改正指南时，注明条目及运行目录，给出支持新解释的提交或会话位置。

**指南如何更新。** 以仓库和版本划定范围，从聊天提取原始目标，再用代码与产物校正对当时决策的理解。新证据出现时，回到原编号修订记录。这种读法借鉴了钱学森的系统工程和工程控制论。 [《组织管理的技术——系统工程》](https://doi.org/10.13255/j.cnki.jusst.2011.06.020) · [《工程控制论》](https://openlibrary.org/books/OL49218199M/Engineering_cybernetics)
