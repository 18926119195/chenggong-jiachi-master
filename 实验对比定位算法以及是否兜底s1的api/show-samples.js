import fs from 'fs';

const data = JSON.parse(fs.readFileSync('s1-nonhigh-accurate-data.json', 'utf-8'));

console.log('前 20 条截断文本：\n');
data.slice(0, 20).forEach((e, i) => {
  console.log(`${i+1}. 批次${e.batchId} 【【${e.truncId}】】`);
  console.log(`   Prompt截断: "${e.promptTruncText}"`);
  console.log(`   LLM输出: "${e.llmOutputText}"`);
  console.log('');
});
