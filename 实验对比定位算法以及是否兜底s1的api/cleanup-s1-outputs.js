/**
 * 清理旧的 s1 输出文件
 * 
 * 删除：
 *   - s1-nouns-with-offsets.json（原始输出）
 *   - s1-nouns-with-offsets-group1.json
 *   - s1-nouns-with-offsets-group2.json
 *   - s1-snapshots-group1/* (所有快照)
 *   - s1-snapshots-group2/* (所有快照)
 */

import fs from 'fs';
import path from 'path';

const files = [
  's1-nouns-with-offsets.json',
  's1-nouns-with-offsets-group1.json',
  's1-nouns-with-offsets-group2.json',
];

const dirs = [
  's1-snapshots-group1',
  's1-snapshots-group2',
];

console.log('========== 清理 s1 输出文件 ==========\n');

for (const file of files) {
  const filePath = path.join(process.cwd(), file);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
    console.log(`✓ 删除文件: ${file}`);
  } else {
    console.log(`- 跳过（不存在）: ${file}`);
  }
}

console.log('');

for (const dir of dirs) {
  const dirPath = path.join(process.cwd(), dir);
  if (fs.existsSync(dirPath)) {
    const files = fs.readdirSync(dirPath);
    for (const file of files) {
      fs.unlinkSync(path.join(dirPath, file));
    }
    console.log(`✓ 清空目录: ${dir} (删除了 ${files.length} 个快照文件)`);
  } else {
    console.log(`- 跳过（不存在）: ${dir}`);
  }
}

console.log('\n========== 清理完成 ==========');
