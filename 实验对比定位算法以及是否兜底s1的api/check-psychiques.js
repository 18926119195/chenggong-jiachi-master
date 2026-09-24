import { readFileSync } from 'fs';
const batch = JSON.parse(readFileSync('./s1-snapshots-group2/batch-10.json', 'utf-8'));

const targets = batch.parsedNouns.filter(n => n.noun === 'psychiques' || n.noun === 'psychique');

for (const target of targets) {
  const trunc = batch.truncations.find(t => t.truncId === target.truncId);
  console.log(`LLM 标记: 【【${target.truncId}】】 -> "${target.noun}"`);
  console.log(`  该截断文本: "${trunc ? trunc.text : '(未找到)'}"`);
  console.log(`  名词在截断原文里?`, trunc ? trunc.text.toLowerCase().includes(target.noun.toLowerCase()) : false);
  console.log(`  offsets:`, JSON.stringify(target.offsets));
  console.log('');
}

console.log('=== 全部截断里包含 "psychique" 的位置 ===');
batch.truncations.forEach(t => {
  if (t.text.toLowerCase().includes('psychique')) {
    console.log(`  truncId=${t.truncId}: "${t.text}"`);
  }
});
