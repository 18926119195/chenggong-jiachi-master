/**
 * 基于 stopwords-manual-audit.json 审计类别，
 * 扫描 all-noun-surfaces.txt 命中黑名单模式，
 * 生成 noun-blacklist.json。
 *
 * 用法：
 *   node build-noun-blacklist.cjs
 *
 * 输出：noun-blacklist.json
 *   {
 *     "generated_at": "...",
 *     "total_surfaces": N,
 *     "blacklisted_count": M,
 *     "patterns": [...],
 *     "blacklist": ["...", "..."]
 *   }
 *
 * 注意：这是**诊断性**黑名单，仅用于 LLM 召回阶段过滤，
 * 不修改 final-noun-index.json（保持其它脚本兼容）。
 */

import fs from 'fs';
import path from 'path';

const ROOT = process.cwd();
const NOUN_SURFACES_PATH = path.join(ROOT, 'all-noun-surfaces.txt');
const AUDIT_PATH = path.join(ROOT, 'stopwords-manual-audit.json');
const OUTPUT_PATH = path.join(ROOT, 'noun-blacklist.json');

// ============ 黑名单模式（基于审计类别）============
const PATTERNS = [
  // 类别1: OCR 损坏（含不常见字符组合或非 ASCII 噪音）
  {
    id: 'ocr_garbled',
    description: 'OCR 损坏字符（包含替换字符、合并异常、字母异常替换）',
    regex: /[\uFFFD\u0000-\u001F]|[a-zà-ÿ]+(?:é|è|ê|ë|à|â|ç|î|ï|ô|ù|û|ü|ÿ)(?:[a-zà-ÿ]*)(?:é|è|ê|ë|à|â|ç|î|ï|ô|ù|û|ü|ÿ){2,}/i,
    // 注：此模式过于激进，启用需更精确，下面用具体前缀规则替代
    enabled: false,
  },
  // 类别2: CJK 混入
  {
    id: 'cjk_mixed',
    description: 'CJK 字符混入',
    regex: /[\u4e00-\u9fff\u3040-\u309f\u30a0-\u30ff]/,
    enabled: true,
  },
  // 类别3: 句首碎片（带逗号、破折号）
  {
    id: 'leading_punct_fragment',
    description: '句首逗号/破折号/分号前缀（", du fait", "- le premier" 等）',
    regex: /^[,;\-:]\s*\S/,
    enabled: true,
  },
  // 类别4: 孤立符号或 Markdown 残留
  {
    id: 'punctuation_only',
    description: '孤立符号或 Markdown 残留（*, **, ##, *** 等）',
    regex: /^[*#]+$|^[*#]\S+|^\s*[*#]+\s*$|\*\*+/,
    enabled: true,
  },
  // 类别5: 公式/图表符号（含希腊字母、特殊数学符号）
  {
    id: 'equation_chart_marker',
    description: '公式/图表符号（含希腊字母、特殊符号、数学标记）',
    // 精确匹配：希腊字母单独成词；或已知图表标记缩写；或含特殊数学符号
    regex: /^[ΦΔΣΩπσμθαβγδλ]+(\.|\b)|F\.T\.Φ|F\.Φ\.U|ΔF|P\+|Sa\)|F=|Fig\.|ibid\.|n°|№/,
    enabled: true,
  },
  // 类别6: 合并异常（"Flux instancies)Dis-position", "P P" 等）
  {
    id: 'concatenation_artifact',
    description: '合并异常（多词合并、括号闭合异常）',
    regex: /\)\S|\S\(.*\)/,
    enabled: true,
  },
  // 类别7: 单词太短且高频（可能是 "du", "de" 等被误判，但保留作为额外保险）
  // 暂时不启用，避免误杀合法短词
  // 类别8: 纯形容词裸露 - 谨慎策略：仅当词以 -es 结尾且长度 <= 12 时（高度怀疑）
  // 暂时不启用，因为 "sociales"、"religieuses" 已经在审计 examples 中，可以手动加
  {
    id: 'selon_special',
    description: 'selon（spaCy 误判为 NOUN 的介词）',
    regex: /^selon$/,
    enabled: true,
  },
];

// ============ 手动补充黑名单（基于审计 examples）============
// 即使正则没命中，这些是审计明确标注的典型虚词
const MANUAL_BLACKLIST = new Set([
  // 类别1: OCR 损坏（来自审计 examples）
  'l\'autoriferenée', 'sesdutude', 'reagnement', 'essbrouche', 'ilece', 'circité', 'marbre boré', 'l\'anthrologie',
  // 类别3: 句首碎片（来自审计 examples）
  'le pied', 'le vent', 'la cuisse', 'moyen',
  // 类别4: 形容词裸露（来自审计 examples）
  'sociales', 'religieuses', 'militaires', 'scientifiques',
  'monacales', 'anthropologiques',
  // 类别5: 公式符号（来自审计 examples）
  'ΔF', 'F.T.Φ.U.', 'P+', 'p.',
  // 类别6: 合并异常
  'Flux instancies)Dis-position', 'P P',
  // 类别7: 句首逗号片段
  ', du fait', ', en effet',
  // 类别8: selon
  'selon',
  // 类别9: 动词原形/过去分词（高风险）
  'voulu', 'survivre', 'réfèrent', 'garantissent',
]);

// ============ 读取名词表面 ============
console.log(`读取 ${NOUN_SURFACES_PATH}...`);
const allSurfaces = fs.readFileSync(NOUN_SURFACES_PATH, 'utf-8')
  .split('\n').map((l) => l.trim()).filter(Boolean);
console.log(`  总条目: ${allSurfaces.length}`);

// ============ 命中黑名单 ============
const blacklistSet = new Set();
const patternHits = {};

for (const pattern of PATTERNS) {
  if (!pattern.enabled) continue;
  const hits = [];
  for (const surface of allSurfaces) {
    if (pattern.regex.test(surface)) {
      hits.push(surface);
      blacklistSet.add(surface);
    }
  }
  patternHits[pattern.id] = { description: pattern.description, count: hits.length, examples: hits.slice(0, 5) };
  console.log(`  ${pattern.id}: 命中 ${hits.length} 条`);
}

// 加入手动黑名单
let manualHits = 0;
for (const surface of allSurfaces) {
  if (MANUAL_BLACKLIST.has(surface)) {
    if (!blacklistSet.has(surface)) manualHits++;
    blacklistSet.add(surface);
  }
}
console.log(`  manual_blacklist: 新增 ${manualHits} 条（总计 ${MANUAL_BLACKLIST.size}）`);

const blacklist = [...blacklistSet].sort();
console.log(`\n总黑名单: ${blacklist.length} 条 (${(blacklist.length / allSurfaces.length * 100).toFixed(2)}%)`);

// ============ 写入 noun-blacklist.json ============
const output = {
  generated_at: new Date().toISOString(),
  total_surfaces: allSurfaces.length,
  blacklisted_count: blacklist.length,
  pattern_summary: patternHits,
  manual_blacklist_size: MANUAL_BLACKLIST.size,
  blacklist,
};

fs.writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 2), 'utf-8');
console.log(`\n✅ 已保存到 ${OUTPUT_PATH}`);
console.log(`\n样例（前10个）:`);
for (const s of blacklist.slice(0, 10)) console.log(`  - ${s}`);
console.log(`\n样例（后10个）:`);
for (const s of blacklist.slice(-10)) console.log(`  - ${s}`);
