import fs from 'fs';
const data = JSON.parse(fs.readFileSync('C:\\Users\\Administrator\\Desktop\\2026-09-21-master\\experiment-length-filter\\newly-added.json', 'utf-8'));

console.log('========== 新增残文完整列表（按长度分组） ==========\n');

const byLen = {};
data.forEach(r => {
  const len = r.text.length;
  if (!byLen[len]) byLen[len] = [];
  byLen[len].push(r.text);
});

for (const len of Object.keys(byLen).sort((a,b) => a-b)) {
  console.log(`\n--- 长度 ${len} (${byLen[len].length} 条) ---`);
  byLen[len].forEach((t, i) => {
    console.log(`  [${i+1}] "${t}"`);
  });
}

console.log('\n========== 统计总结 ==========');
console.log(`总新增: ${data.length} 条`);
console.log(`总字符数: ${data.reduce((s, r) => s + r.text.length, 0)}`);
