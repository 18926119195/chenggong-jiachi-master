/**
 * 测试：同一个文本多次调用 spaCy 是否一致
 */

const SPACY_URL = 'http://localhost:5001/extract_nouns';

const testText = "La pensée classique tenait l'ame éloignée de la matière essence sujet distance leur cœur";

async function testMultiple() {
  console.log('测试：同一文本多次调用 spaCy\n');
  
  const results = [];
  
  for (let i = 0; i < 3; i++) {
    const res = await fetch(SPACY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: testText,
        include_proper_nouns: true,
        include_nouns: true,
        min_length: 2,
      }),
    });
    const result = await res.json();
    results.push(result.total);
    console.log(`第${i+1}次调用: nouns=${result.nouns.length}, noun_phrases=${result.noun_phrases.length}, total=${result.total}`);
  }
  
  const allSame = results.every(r => r === results[0]);
  console.log(`\n结果一致: ${allSame ? '✅ 是' : '❌ 否'}`);
}

testMultiple().catch(console.error);
