/**
 * 测试：用 spaCy 替代 LLM 处理 S1 残文
 * 
 * 目的：对比 spaCy 在残文上的名词抽取效果 vs LLM 的效果
 * 
 * 输入：s0-quality-report.json 中的 inputTruncations（残文列表）
 * 输出：test-s1-spacy-output.json（仅供对比，不影响主流程）
 * 
 * 用法：node test-s1-spacy-alternative.js
 */

import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';

// ============ 配置 ============
const S0_REPORT_PATH = process.env.S0_REPORT_PATH || path.join(process.cwd(), 's0-quality-report.json');
const OUTPUT_PATH = path.join(process.cwd(), 'test-s1-spacy-output.json');
const SPACY_MODEL = process.env.SPACY_MODEL || 'fr_core_news_sm';
const TEMP_DIR = path.join(process.cwd(), '.temp-spacy-test');

console.log('========================================');
console.log('测试：spaCy 替代 LLM 处理 S1 残文');
console.log('========================================');
console.log(`spaCy 模型: ${SPACY_MODEL}`);
console.log(`输入: ${S0_REPORT_PATH}`);
console.log(`输出: ${OUTPUT_PATH}\n`);

// ============ 1. 读取 S0 残文数据 ============
if (!fs.existsSync(S0_REPORT_PATH)) {
  console.error(`错误: 未找到 ${S0_REPORT_PATH}`);
  console.error('请先运行 validate-s0-quality.js 生成 S0 质量报告');
  process.exit(1);
}

const s0Report = JSON.parse(fs.readFileSync(S0_REPORT_PATH, 'utf-8'));
const truncations = s0Report.residuals || [];

if (truncations.length === 0) {
  console.error('错误: S0 报告中没有残文数据');
  process.exit(1);
}

console.log(`加载残文数据: ${truncations.length} 个 chunk`);

// ============ 2. 准备临时文件 ============
if (!fs.existsSync(TEMP_DIR)) {
  fs.mkdirSync(TEMP_DIR, { recursive: true });
}

// 将残文写入临时文件（每行一个 chunk，JSON 格式）
const tempInputPath = path.join(TEMP_DIR, 'residuals.jsonl');
const lines = truncations.map(t => JSON.stringify({
  chunkKey: t.chunkKey,
  page: t.page,
  text: t.text,
  residualStart: t.start,
  residualEnd: t.end
}));
fs.writeFileSync(tempInputPath, lines.join('\n'), 'utf-8');

console.log(`临时文件: ${tempInputPath}`);

// ============ 3. 创建 Python spaCy 处理脚本 ============
const pythonScript = `
import sys
import json
import spacy

# 加载 spaCy 模型
print(f"加载 spaCy 模型: ${SPACY_MODEL}", file=sys.stderr)
nlp = spacy.load("${SPACY_MODEL}")

input_file = "${tempInputPath.replace(/\\/g, '\\\\')}"
output_file = "${path.join(TEMP_DIR, 'spacy-results.jsonl').replace(/\\/g, '\\\\')}"

processed_count = 0
total_nouns = 0

with open(input_file, 'r', encoding='utf-8') as f_in:
    with open(output_file, 'w', encoding='utf-8') as f_out:
        for line in f_in:
            entry = json.loads(line.strip())
            chunk_key = entry['chunkKey']
            page = entry['page']
            text = entry['text']
            residual_start = entry['residualStart']
            residual_end = entry['residualEnd']
            
            # 用 spaCy 处理
            doc = nlp(text)
            
            # 提取名词（NOUN 和 PROPN）
            # start/end 换算成 chunk 全局偏移: residual_start + 局部偏移
            nouns = []
            for token in doc:
                if token.pos_ in ('NOUN', 'PROPN') and not token.is_stop and len(token.text.strip()) > 1:
                    nouns.append({
                        'text': token.text,
                        'lemma': token.lemma_,
                        'pos': token.pos_,
                        'start': residual_start + token.idx,
                        'end': residual_start + token.idx + len(token.text)
                    })
            
            result = {
                'chunkKey': chunk_key,
                'page': page,
                'residualStart': residual_start,
                'residualEnd': residual_end,
                'nouns': nouns
            }
            
            f_out.write(json.dumps(result, ensure_ascii=False) + '\\n')
            
            processed_count += 1
            total_nouns += len(nouns)
            
            if processed_count % 100 == 0:
                print(f"已处理: {processed_count} chunks", file=sys.stderr)

print(f"\\n完成！处理 {processed_count} 个 chunk，提取 {total_nouns} 个名词", file=sys.stderr)
`;

const pythonScriptPath = path.join(TEMP_DIR, 'run_spacy.py');
fs.writeFileSync(pythonScriptPath, pythonScript, 'utf-8');

// ============ 4. 运行 Python 脚本 ============
console.log('\n运行 spaCy 处理...');
const t0 = Date.now();

const result = spawnSync('python', [pythonScriptPath], {
  encoding: 'utf-8',
  stdio: ['inherit', 'pipe', 'pipe'],
  maxBuffer: 50 * 1024 * 1024
});

const elapsed = ((Date.now() - t0) / 1000).toFixed(1);

if (result.error) {
  console.error('错误: Python 执行失败');
  console.error(result.error);
  process.exit(1);
}

if (result.status !== 0) {
  console.error('错误: spaCy 处理失败');
  console.error(result.stderr);
  process.exit(1);
}

console.log(result.stderr);
console.log(`耗时: ${elapsed}s`);

// ============ 5. 读取结果并统计 ============
const spacyResultsPath = path.join(TEMP_DIR, 'spacy-results.jsonl');
if (!fs.existsSync(spacyResultsPath)) {
  console.error('错误: spaCy 未生成结果文件');
  process.exit(1);
}

const spacyLines = fs.readFileSync(spacyResultsPath, 'utf-8').trim().split('\n');
const spacyResults = spacyLines.map(line => JSON.parse(line));

// 统计
const totalChunks = spacyResults.length;
const totalNouns = spacyResults.reduce((sum, r) => sum + r.nouns.length, 0);
const chunksWithNouns = spacyResults.filter(r => r.nouns.length > 0).length;

// 转换为类似 s1-nouns-with-offsets.json 的格式（按名词聚合）
const nounMap = new Map();

for (const chunk of spacyResults) {
  for (const noun of chunk.nouns) {
    const key = noun.lemma.toLowerCase();
    if (!nounMap.has(key)) {
      nounMap.set(key, {
        id: key,
        surface: noun.text,
        lemma: noun.lemma,
        pos: noun.pos,
        offsets: []
      });
    }
    nounMap.get(key).offsets.push({
      chunkKey: chunk.chunkKey,
      page: chunk.page,
      start: noun.start,
      end: noun.end
    });
  }
}

const outputNouns = Array.from(nounMap.values())
  .sort((a, b) => b.offsets.length - a.offsets.length);

const totalOffsets = outputNouns.reduce((sum, n) => sum + n.offsets.length, 0);

// ============ 6. 生成对比报告 ============
const output = {
  meta: {
    source: 'S1 spaCy 测试（替代 LLM）',
    spacyModel: SPACY_MODEL,
    inputSource: S0_REPORT_PATH,
    chunkCount: totalChunks,
    chunksWithNouns: chunksWithNouns,
    outputNouns: outputNouns.length,
    totalOffsets: totalOffsets,
    elapsedSeconds: parseFloat(elapsed),
    note: '此文件仅供测试对比，不影响主流程'
  },
  nouns: outputNouns
};

fs.writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 2), 'utf-8');

// ============ 7. 对比 LLM 结果 ============
console.log('\n========================================');
console.log('spaCy 测试结果');
console.log('========================================');
console.log(`处理 chunk 数: ${totalChunks}`);
console.log(`有名词的 chunk: ${chunksWithNouns} (${(chunksWithNouns/totalChunks*100).toFixed(1)}%)`);
console.log(`输出名词数: ${outputNouns.length}`);
console.log(`总位置数: ${totalOffsets}`);
console.log(`平均每名词: ${(totalOffsets/outputNouns.length).toFixed(1)} 个位置`);
console.log(`耗时: ${elapsed}s`);

// 读取 LLM 结果对比
const s1LLMPath = path.join(process.cwd(), 's1-nouns-with-offsets.json');
if (fs.existsSync(s1LLMPath)) {
  const s1LLM = JSON.parse(fs.readFileSync(s1LLMPath, 'utf-8'));
  console.log('\n与 LLM 方案对比:');
  console.log('----------------------------------------');
  console.log(`              spaCy    LLM (原方案)`);
  console.log(`Chunk 数      ${totalChunks}      ${s1LLM.meta.chunkCount}`);
  console.log(`名词数        ${outputNouns.length}      ${s1LLM.meta.outputNouns}`);
  console.log(`总位置数      ${totalOffsets}      ${s1LLM.meta.totalOffsets}`);
  console.log(`耗时          ${elapsed}s      ${s1LLM.meta.elapsedSeconds}s`);
  console.log(`成本          $0       ~$0.04 USD`);
  
  const spacyRate = (outputNouns.length / totalChunks * 100).toFixed(1);
  const llmRate = (s1LLM.meta.outputNouns / s1LLM.meta.chunkCount * 100).toFixed(1);
  console.log(`产出率        ${spacyRate}%     ${llmRate}%`);
}

console.log('\n✅ 测试完成！结果已保存: ' + OUTPUT_PATH);
console.log('\n提示：这是测试文件，不会影响主流程。');
console.log('如需查看详细对比，可打开：');
console.log(`  - ${OUTPUT_PATH} (spaCy 结果)`);
console.log(`  - s1-nouns-with-offsets.json (LLM 结果)`);
