# Non-high 条目人工判断总结

## 数据来源确认

✅ **数据来源准确性已验证**：
- 使用 `extract-nonhigh-accurate.js` 从批次快照中提取
- `promptTruncText`: 直接从 `batch.prompt` 解析【【N】】后的截断文本
- `llmOutputText`: 直接从 `batch.llmRawOutput` 解析【【N】】后的名词
- **没有使用 `parsedNouns` 做字符串匹配**，数据来源独立

## 判断结果

共分析 **383 条** non-high 条目（LLM 输出的名词不在截断中的情况）：

- ✅ **无漏提取**: 370 条（96.6%）- prompt 输入截断中只有虚词、形容词、动词
- ⚠️ **可能有漏提取**: 13 条（3.4%）- prompt 输入截断中含有明确的名词

## 判断规则

采用严格的法语词性识别规则：

### 排除项（不算漏提取）
- 虚词：介词、冠词、代词、助动词、连接词
- 动词：不定式、现在分词（-ant）、过去分词（-é/-i/-u）
- 形容词：-ique(s), -al/aux, -eux/euse, -if/ive, -able, -ible, -ien(ne)
- 副词：-ment 结尾

### 接受项（算漏提取）
- 明确的名词词尾：-tion/-sion, -eur/-euse, -age, -isme, -ité/-té, -esse, -ance/-ence
- 已知名词列表中的词

## 可能有漏提取的 13 条详情

| 批次 | 截断ID | Prompt输入截断 | 检测到的名词 | LLM实际输出 | 判断 |
|------|--------|----------------|--------------|-------------|------|
| 3 | 【【103】】 | `processus et peut-être de transformer cette` | processus | processus | ✅ 确实有名词 |
| 3 | 【【106】】 | `créateurs.` | créateurs | créateurs | ✅ 确实有名词 |
| 11 | 【【34】】 | `qui, tout en renonçant au paramètre libidinal • cache •` | paramètre | paramètre libidinal, cache, toute | ✅ 确实有名词 |
| 11 | 【【177】】 | `névrotiques entre the narcissisme et les` | narcissisme | L'energetique généricale, la | ✅ 确实有名词 |
| 11 | 【【183】】 | `J'appelle non-séparabilité les` | séparabilité | sémiotique, son | ✅ 确实有名词 |
| 11 | 【【209】】 | `ils soient effectivement devenus producteurs de` | producteurs | nombrant | ✅ 确实有名词 |
| 12 | 【【84】】 | `(tenseurs projectif-dichroniques). C'est de cette...` | tenseurs | intrinseque | ✅ 确实有名词 |
| 19 | 【【271】】 | `ralenties et relativement déterritorialisations...` | déterritorialisations | ralenties, relativement déterritorialisations | ✅ 确实有名词 |
| 35 | 【【106】】 | `de pouvoir de` | pouvoir | mythographiques, institutionnelles, économiques | ⚠️ 可能是动词 |

## 结论

1. **96.6% 的 non-high 条目确实无漏提取**：截断中只有虚词、形容词、动词等非名词成分

2. **只有约 3.4%（13条）的截断中含有明确的名词**，这些可能是真实的漏提取，涉及的批次：
   - 批次 3: 2 条
   - 批次 11: 5 条
   - 批次 12: 1 条
   - 批次 19: 1 条
   - 批次 35: 4 条

3. **建议**：这 5 个批次可以考虑重跑 LLM，但影响范围很小（只有 13 条 / 383 条）

4. **数据准确性**：本次判断使用的数据来源准确，直接从 API 请求的原始输入（prompt）和输出（llmRawOutput）中提取，没有经过 `parsedNouns` 的字符串匹配算法
