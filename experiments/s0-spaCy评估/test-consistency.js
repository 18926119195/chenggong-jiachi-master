/**
 * 测试 spaCy 服务的一致性
 * 用相同的文本调用两次，验证结果是否一致
 */

const SPACY_URL = 'http://localhost:5001/extract_nouns';

const testText = "Cartographies schizoanalytiques Felix Guattari pensee ame matiere essence sujet";

async function testConsistency() {
  console.log('测试 spaCy 服务的一致性...\n');
  
  // 第一次调用
  const res1 = await fetch(SPACY_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text: testText,
      include_proper_nouns: true,
      include_nouns: true,
      min_length: 2,
    }),
  });
  const result1 = await res1.json();
  
  // 第二次调用
  const res2 = await fetch(SPACY_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text: testText,
      include_proper_nouns: true,
      include_nouns: true,
      min_length: 2,
    }),
  });
  const result2 = await res2.json();
  
  console.log('第一次调用:');
  console.log('  nouns:', result1.nouns.length);
  console.log('  noun_phrases:', result1.noun_phrases.length);
  console.log('  名词:', result1.nouns.map(n => n.surface).join(', '));
  
  console.log('\n第二次调用:');
  console.log('  nouns:', result2.nouns.length);
  console.log('  noun_phrases:', result2.noun_phrases.length);
  console.log('  名词:', result2.nouns.map(n => n.surface).join(', '));
  
  const same = JSON.stringify(result1) === JSON.stringify(result2);
  console.log('\n结果是否一致:', same ? '✅ 是' : '❌ 否');
  
  if (!same) {
    console.log('\n差异:');
    console.log('  nouns:', result1.nouns.length, 'vs', result2.nouns.length);
    console.log('  noun_phrases:', result1.noun_phrases.length, 'vs', result2.noun_phrases.length);
  }
}

testConsistency().catch(console.error);
