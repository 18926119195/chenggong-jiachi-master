/**
 * 快速验证：用同一段文本测试两个版本的 spaCy 调用
 */

const SPACY_URL = 'http://localhost:5001/extract_nouns';

const testChunk = {
  text: "La pensée classique tenait l'ame éloignée de la matière essence sujet distance leur cœur les marxistes superstructures raptures production infrastructuraux",
  chunkKey: "test-1",
  page: 0
};

async function testSpacyCall() {
  console.log('测试 spaCy 调用...\n');
  console.log('文本:', testChunk.text.slice(0, 80) + '...\n');
  
  const res = await fetch(SPACY_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text: testChunk.text,
      include_proper_nouns: true,
      include_nouns: true,
      min_length: 2,
    }),
  });
  
  const result = await res.json();
  
  console.log('spaCy 返回:');
  console.log('  nouns:', result.nouns.length);
  console.log('  noun_phrases:', result.noun_phrases.length);
  console.log('  总计:', result.total);
  
  console.log('\n名词列表:');
  for (const n of result.nouns) {
    console.log(`  - "${n.surface}" [${n.pos}] ${n.start}-${n.end}`);
  }
  
  console.log('\n名词短语:');
  for (const p of result.noun_phrases) {
    console.log(`  - "${p.surface}" [${p.pos}] ${p.start}-${p.end}`);
  }
}

testSpacyCall().catch(console.error);
