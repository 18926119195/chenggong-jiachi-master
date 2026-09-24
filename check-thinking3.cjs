const fs = require('fs');
const path = require('path');

const dirs = [
  'C:\\Users\\Administrator\\Desktop\\2026-09-21-master\\主流程数据集-2026-09-22\\src\\core\\llm-snapshots',
];

let total = 0, withThinking = 0, noThinking = 0, failed = 0;
const thinkingFiles = [];
const failedFiles = [];

for (const dir of dirs) {
  if (!fs.existsSync(dir)) continue;
  const files = fs.readdirSync(dir).filter(f => f.endsWith('-response.json'));
  for (const f of files) {
    total++;
    try {
      const raw = fs.readFileSync(path.join(dir, f), 'utf8');
      const json = JSON.parse(raw);
      const usage = json.response && json.response.usage;
      const rt = usage && usage.completion_tokens_details && usage.completion_tokens_details.reasoning_tokens;
      if (rt && rt > 0) {
        withThinking++;
        thinkingFiles.push(`${f} reasoning_tokens=${rt}`);
      } else {
        noThinking++;
      }
    } catch (e) {
      failed++;
      failedFiles.push(f);
    }
  }
}

console.log(`总文件数: ${total}`);
console.log(`无thinking: ${noThinking}`);
console.log(`有thinking: ${withThinking}`);
console.log(`解析失败: ${failed}`);
if (thinkingFiles.length) {
  console.log('\n有thinking的文件:');
  thinkingFiles.forEach(f => console.log(`  ${f}`));
}
if (failedFiles.length) {
  console.log('\n解析失败的文件:');
  failedFiles.forEach(f => console.log(`  ${f}`));
}
