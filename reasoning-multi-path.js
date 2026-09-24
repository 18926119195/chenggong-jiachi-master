/**
 * 多轮推理 LLM（单次 LLM 调用，输出 2-4 条独立推理路径）
 *
 * 输入：noun-recall-results.json 中每个问题的 recalledTexts
 *      （拓扑链合并去重后的召回文本块，每块对应一个 chunkKey 区间）
 * 机器符码协议：与 recall-nouns-llm.js / s1-llm-fill.js 一致，用【【N】】引用材料，
 *              N 是本次 prompt 内材料的顺序号（1..batch.length），不是 chunkKey 或全局 id。
 *
 * 用法：
 *   node reasoning-multi-path.js                # 处理所有问题
 *   node reasoning-multi-path.js Z1-Q1 Z1-Q2     # 指定问题ID
 */

import fs from 'fs';
import path from 'path';
import { callLLM, LLM_BASE_URL, LLM_MODEL } from './src/core/llmClient.js';

// ============ 配置 ============
const RECALL_RESULTS_PATH = process.env.RECALL_RESULTS_PATH || path.join(process.cwd(), 'noun-recall-results.json');
const OUTPUT_PATH = process.env.OUTPUT_PATH || path.join(process.cwd(), 'reasoning-results.json');
const MAX_REASONING_OUTPUT_TOKENS = parseInt(process.env.MAX_REASONING_OUTPUT_TOKENS || '32768', 10); // V4-Flash 384K，设为 32K
const QUESTION_IDS = process.argv.slice(2).length
  ? process.argv.slice(2)
  : (process.env.QUESTION_IDS || '').split(',').filter(Boolean);

console.log(`LLM: ${LLM_BASE_URL} model=${LLM_MODEL} thinking=disabled`);

console.log('加载召回结果...');
const recallResults = JSON.parse(fs.readFileSync(RECALL_RESULTS_PATH, 'utf-8'));
console.log(`  问题数: ${recallResults.length}`);

// ============ Prompt 构建 ============
function buildReasoningPrompt(question, recalledTexts) {
  // recalledTexts = [{chunkKey, page, chainStart, chainEnd, text}, ...]
  // 为每个块分配机器符码【【N】】（N=1..recalledTexts.length）
  const materials = recalledTexts.map((item, idx) => {
    return `【【${idx + 1}】】\n${item.text}`;
  }).join('\n\n');

  return `问题：${question}

材料：

${materials}

---

要求：输出 2-4 条独立推理路径，每条路径包含多个步骤，每步可引用一个或多个材料【【N】】。

格式：

# 路径一：[标题]

步骤1：使用【【X】】，提取...
步骤2：综合【【Y】】【【Z】】，对比...

结论：[此路径结论]

（继续路径二、三...）

**引用规范**：
- 单个材料：使用【【N】】，提取...，判断...
- 多个材料：综合【【N】】【【M】】，对比/交叉验证/综合提取...

**推理策略**：
- 对比论证：对比不同材料中的矛盾或差异
- 交叉验证：从多个材料中找到互相支撑的证据
- 综合支撑：从多处提取一致的特征或模式`;
}

// ============ 输出解析 ============
/**
 * 解析 LLM 输出，提取路径结构和引用的【【N】】
 * 返回：[{ pathTitle, steps: [{ stepText, citedRefs: [1,5,17,...] }], conclusion }, ...]
 */
function parseReasoningOutput(rawOutput) {
  if (!rawOutput || rawOutput.trim().length === 0) return [];

  const paths = [];
  // 按 "# 路径" 分段（支持 "# 路径一" / "# 路径1" / "## 路径一"）
  const pathBlocks = rawOutput.split(/\n(?=#\s*路径)/);

  for (const block of pathBlocks) {
    if (!block.trim()) continue;

    // 提取标题（首行 # 后内容）
    const titleMatch = block.match(/^#\s*路径[一二三四1-4][:：]?\s*(.*)$/m);
    const pathTitle = titleMatch ? titleMatch[1].trim() : '未命名路径';

    // 提取结论（最后一段以"结论"开头的内容）
    const conclusionMatch = block.match(/结论[:：]\s*(.+?)(?=\n#|$)/s);
    const conclusion = conclusionMatch ? conclusionMatch[1].trim() : '';

    // 提取步骤（"步骤N" 开头的段落）
    const stepMatches = [...block.matchAll(/步骤\d+[:：]\s*(.+?)(?=\n步骤\d+|结论|$)/gs)];
    const steps = stepMatches.map(m => {
      const stepText = m[1].trim();
      // 从步骤文本中提取所有【【N】】
      const refMatches = [...stepText.matchAll(/【【(\d+)】】/g)];
      const citedRefs = [...new Set(refMatches.map(r => parseInt(r[1], 10)))].sort((a, b) => a - b);
      return { stepText, citedRefs };
    });

    paths.push({ pathTitle, steps, conclusion });
  }

  return paths;
}

/**
 * 将路径中引用的【【N】】映射回 chunkKey（供溯源高亮）
 * recalledTexts[N-1] -> chunkKey
 */
function mapRefsToChunkKeys(paths, recalledTexts) {
  return paths.map(path => ({
    ...path,
    steps: path.steps.map(step => ({
      ...step,
      citedChunks: step.citedRefs
        .filter(n => n >= 1 && n <= recalledTexts.length)
        .map(n => ({
          ref: n,
          chunkKey: recalledTexts[n - 1].chunkKey,
          page: recalledTexts[n - 1].page,
          chainStart: recalledTexts[n - 1].chainStart,
          chainEnd: recalledTexts[n - 1].chainEnd,
        })),
    })),
  }));
}

// ============ 主流程 ============
async function main() {
  const qList = recallResults.filter(r => !QUESTION_IDS.length || QUESTION_IDS.includes(r.questionId));
  console.log(`========== 多路径推理引擎 ==========`);
  console.log(`处理问题数: ${qList.length}, 最大输出: ${MAX_REASONING_OUTPUT_TOKENS} tokens\n`);

  const allResults = [];

  for (const r of qList) {
    console.log(`\n--- [${r.questionId}] ${r.question} ---`);
    const t0 = Date.now();

    const { recalledTexts } = r;
    if (!recalledTexts || recalledTexts.length === 0) {
      console.log(`  ⚠️  无召回材料，跳过`);
      allResults.push({
        questionId: r.questionId,
        question: r.question,
        materialCount: 0,
        paths: [],
        llmRawOutput: null,
        error: '无召回材料',
        elapsedSecs: 0,
      });
      continue;
    }

    console.log(`  召回材料数: ${recalledTexts.length}`);

    // 构建 prompt
    const prompt = buildReasoningPrompt(r.question, recalledTexts);
    const promptTokensEst = Math.ceil(prompt.length / 3.5);
    console.log(`  Prompt 长度: ${prompt.length} 字符 (≈${promptTokensEst} tokens)`);

    // 调用 LLM
    let llmRawOutput = null;
    let paths = [];
    let error = null;
    let tokenUsage = { promptTokens: 0, completionTokens: 0 };

    try {
      const res = await callLLM(prompt, { maxTokens: MAX_REASONING_OUTPUT_TOKENS });
      if (res?.text) {
        llmRawOutput = res.text;
        if (res.usage) {
          tokenUsage.promptTokens = res.usage.prompt_tokens || 0;
          tokenUsage.completionTokens = res.usage.completion_tokens || 0;
        }
        // 解析路径
        paths = parseReasoningOutput(llmRawOutput);
        // 映射【【N】】-> chunkKey
        paths = mapRefsToChunkKeys(paths, recalledTexts);
        console.log(`  ✅ LLM 返回 ${paths.length} 条路径`);
      } else {
        error = 'LLM 无返回内容';
        console.log(`  ❌ ${error}`);
      }
    } catch (err) {
      error = err.message;
      console.log(`  ❌ LLM 调用失败: ${error}`);
    }

    const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
    const result = {
      questionId: r.questionId,
      question: r.question,
      zone: r.zone,
      materialCount: recalledTexts.length,
      paths,
      llmRawOutput,
      tokenUsage,
      elapsedSecs: parseFloat(elapsed),
      error,
    };

    allResults.push(result);
    console.log(`  耗时: ${elapsed}s, tokens: ${tokenUsage.promptTokens}+${tokenUsage.completionTokens}`);

    // 增量保存
    fs.writeFileSync(OUTPUT_PATH, JSON.stringify(allResults, null, 2), 'utf-8');
    console.log(`  已增量保存到: ${OUTPUT_PATH}`);
  }

  console.log(`\n完成，结果已保存: ${OUTPUT_PATH}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
