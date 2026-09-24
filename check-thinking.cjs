const fs = require('fs');
const path = require('path');

const dir = 'C:\\Users\\Administrator\\Desktop\\2026-09-21-master\\主流程数据集-2026-09-22\\llm-snapshots';

const files = fs.readdirSync(dir).filter(f => /^call-\d+-response\.json$/.test(f));

let total = 0;
let failed = 0;
let withReasoning = 0;
let noReasoning = 0;
const reasoningFiles = [];
const failedFiles = [];

for (const f of files) {
  total++;
  let j;
  try {
    j = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
  } catch (e) {
    continue;
  }
  if (j.success === false) {
    failed++;
    failedFiles.push(f);
    continue;
  }
  const usage = j.response && j.response.usage;
  const rt = usage && usage.completion_tokens_details && usage.completion_tokens_details.reasoning_tokens;
  const hasReasoningContent = j.response && (j.response.reasoning_content || (j.rawResponse && j.rawResponse.choices && j.rawResponse.choices[0] && j.rawResponse.choices[0].message && j.rawResponse.choices[0].message.reasoning_content));
  if ((rt && rt > 0) || hasReasoningContent) {
    withReasoning++;
    reasoningFiles.push(f);
  } else {
    noReasoning++;
  }
}

console.log('总文件数:', total);
console.log('失败(fetch failed等):', failed);
console.log('成功且无thinking:', noReasoning);
console.log('成功且含thinking(reasoning):', withReasoning);
if (reasoningFiles.length > 0) {
  console.log('含thinking的文件列表:', reasoningFiles.join(', '));
}
console.log('失败文件列表:', failedFiles.join(', '));
