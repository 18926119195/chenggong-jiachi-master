const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '主流程数据集-2026-09-22', 'llm-snapshots');
const files = fs.readdirSync(dir).filter(f => f.endsWith('-response.json'));

let total = 0, failed = 0, noThinking = 0, withThinking = 0;
const thinkingFiles = [];
const failedFiles = [];

for (const f of files) {
  total++;
  const full = path.join(dir, f);
  let json;
  try {
    json = JSON.parse(fs.readFileSync(full, 'utf8'));
  } catch (e) {
    console.log('PARSE ERROR:', f, e.message);
    continue;
  }
  if (!json.success) {
    failed++;
    failedFiles.push(f);
    continue;
  }
  const rt = json.response?.usage?.completion_tokens_details?.reasoning_tokens;
  if (rt && rt > 0) {
    withThinking++;
    thinkingFiles.push({ file: f, reasoning_tokens: rt });
  } else {
    noThinking++;
  }
}

console.log('总文件数:', total);
console.log('失败:', failed);
console.log('无thinking:', noThinking);
console.log('有thinking:', withThinking);
console.log('\n有thinking的文件(call号 + reasoning_tokens):');
for (const t of thinkingFiles) {
  console.log(' ', t.file, t.reasoning_tokens);
}
console.log('\n失败文件:');
for (const f of failedFiles) console.log(' ', f);
