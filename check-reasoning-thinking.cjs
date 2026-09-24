const fs = require('fs');
const path = require('path');

const dir = 'C:\\Users\\Administrator\\Desktop\\2026-09-21-master\\主流程数据集-2026-09-22';
const files = fs.readdirSync(dir).filter(f => f.startsWith('reasoning-output-') && f.endsWith('.json'));

let total = 0, withThinking = 0, noThinking = 0;
const thinkingFiles = [];

for (const f of files) {
  total++;
  const json = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
  const usage = json.usage;
  const rt = usage && usage.completion_tokens_details && usage.completion_tokens_details.reasoning_tokens;
  if (rt && rt > 0) {
    withThinking++;
    thinkingFiles.push(`${f} reasoning_tokens=${rt}`);
  } else {
    noThinking++;
  }
}

console.log(`总推理文件数: ${total}`);
console.log(`无thinking: ${noThinking}`);
console.log(`有thinking: ${withThinking}`);
if (thinkingFiles.length) {
  console.log('\n有thinking的文件:');
  thinkingFiles.forEach(f => console.log(`  ${f}`));
}
