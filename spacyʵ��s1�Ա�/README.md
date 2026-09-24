# spaCy 实验 S1 对比

本文件夹包含 spaCy 名词提取与 LLM 名词提取的对比实验数据和脚本。

## 文件说明

### 脚本文件
- **test-s1-spacy-alternative.js** - spaCy 名词提取主脚本，调用 Python spaCy 处理 S1 残文
- **compare-s1-overlap.js** - 第一版对比脚本（精确位置匹配，已废弃）
- **compare-s1-overlap-v2.js** - 第二版对比脚本（区间交集匹配）
- **compare-s1-proximity.js** - 邻近分析脚本，分析未匹配位置的距离分布

### 数据文件
- **test-s1-spacy-output.json** - spaCy 提取的 S1 名词列表（含位移量）
- **compare-s1-proximity-output.json** - 邻近分析完整结果（1799个LLM独有位置 + 1502个spaCy独有位置）

## 实验结论

### 重叠度分析（区间交集匹配）
- **重叠位置数**: 211 个（占 spaCy 的 12.3%，占 LLM 的 10.5%）
- **重叠位置中文本一致**: 169 个（80.1%）
- **LLM 独有位置**: 1799 个（89.5%）
- **spaCy 独有位置**: 1502 个（87.7%）

### 邻近分析
- 87% 的 LLM 独有名词与最近的 spaCy 位置距离 >20 字符
- 61.3% 的 spaCy 独有位置所在 chunk 内 LLM 完全没有输出
- 两者提取的词集合本质上不同，不是"同一个词、边界没对齐"

### 高频词对比
**spaCy 独有高频词**:
- abstraites (31次)、sémiotique (26次)、expressive (22次)
- 特点：单个形容词性名词，倾向抓取词根片段

**LLM 独有高频词**:
- figure (9次)、soit (7次)、c'est (7次)、pouvoir (7次)
- 特点：包含功能词、连接词，抓取范围更宽泛

### 结论
spaCy 和 LLM 是**互补关系而非替代关系**：
- 重叠率约 12%，说明核心术语有一定一致性
- 但各自独有的 87-89% 说明两者关注点本质不同
- spaCy 更严格（词性标注准确），LLM 覆盖面更广（能识别专有名词和图表标注）

## 运行方法

```bash
# 1. 运行 spaCy 提取
node test-s1-spacy-alternative.js

# 2. 运行区间交集对比
node compare-s1-overlap-v2.js

# 3. 运行邻近分析
node compare-s1-proximity.js
```

## 依赖
- Node.js 脚本需要读取 `../s1-nouns-with-offsets.json`（LLM 提取结果）
- Python 脚本需要 spaCy + fr_core_news_lg 模型
