/**
 * 模拟两个版本的 hitMask 构建逻辑，验证差异
 */

function buildHitMaskMainFlow(chunkText, nouns) {
  const hitMask = new Array(chunkText.length).fill(false);
  const hits = [];
  for (const n of nouns) {
    const { start, end, surface } = n;
    if (start < 0 || end > chunkText.length || start >= end) continue;
    let alreadyHit = false;
    for (let i = start; i < end; i++) {
      if (hitMask[i]) { alreadyHit = true; break; }
    }
    if (!alreadyHit) {
      for (let i = start; i < end; i++) hitMask[i] = true;
      hits.push({ surface, start, end });
    }
  }
  return hitMask;
}

function buildHitMaskExperiment(chunkText, nouns) {
  const hitMask = new Array(chunkText.length).fill(false);
  for (const n of nouns) {
    if (n.start >= 0 && n.end <= chunkText.length && n.start < n.end) {
      for (let i = n.start; i < n.end; i++) hitMask[i] = true;
    }
  }
  return hitMask;
}

// 测试用例
const testCases = [
  {
    name: "完全包含",
    text: "La pensée classique",
    nouns: [
      { surface: "La pensée classique", start: 0, end: 19 },
      { surface: "pensée", start: 3, end: 9 },
      { surface: "classique", start: 10, end: 19 },
    ]
  },
  {
    name: "部分重叠",
    text: "la pensée classique",
    nouns: [
      { surface: "classique", start: 10, end: 19 },
      { surface: "pensée classique", start: 3, end: 19 },
    ]
  },
  {
    name: "真实例子",
    text: "La pensée classique tenait l'ame éloignée de la matière essence sujet distance",
    nouns: [
      { surface: "La pensée classique", start: 0, end: 19 },
      { surface: "pensée", start: 3, end: 9 },
      { surface: "l'ame", start: 27, end: 32 },
      { surface: "ame", start: 29, end: 32 },
      { surface: "la matière", start: 45, end: 55 },
      { surface: "matière", start: 48, end: 55 },
      { surface: "essence", start: 61, end: 68 },
      { surface: "sujet", start: 72, end: 77 },
      { surface: "sujet", start: 72, end: 77 },  // 重复
      { surface: "distance", start: 80, end: 88 },
    ]
  }
];

console.log('测试两个版本的 hitMask 构建逻辑\n');
console.log('='.repeat(60));

for (const tc of testCases) {
  console.log(`\n测试: ${tc.name}`);
  console.log(`文本: "${tc.text}"`);
  console.log(`名词: ${tc.nouns.map(n => `"${n.surface}"(${n.start}-${n.end})`).join(', ')}`);
  
  const mainMask = buildHitMaskMainFlow(tc.text, tc.nouns);
  const expMask = buildHitMaskExperiment(tc.text, tc.nouns);
  
  const mainHitChars = mainMask.filter(Boolean).length;
  const expHitChars = expMask.filter(Boolean).length;
  
  const masksMatch = mainMask.every((v, i) => v === expMask[i]);
  
  console.log(`\n主流程版本: hitChars=${mainHitChars}, hitMask=${mainMask.map(v => v ? '█' : '.').join('')}`);
  console.log(`实验版本:   hitChars=${expHitChars}, hitMask=${expMask.map(v => v ? '█' : '.').join('')}`);
  console.log(`hitMask 一致: ${masksMatch ? '✅' : '❌'}`);
}
