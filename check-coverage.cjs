const fs = require('fs');
const path = require('path');

const TARGET_DIR = 'C:\\Users\\Administrator\\Desktop\\2026-09-21-master\\主流程数据集-2026-09-22';
const questions = JSON.parse(fs.readFileSync(path.join('C:\\Users\\Administrator\\Desktop\\2026-09-21-master', 'test-questions.json'), 'utf8'));
const recallFile = path.join(TARGET_DIR, 'noun-recall-results.json');
const recall = JSON.parse(fs.readFileSync(recallFile, 'utf8'));

const covered = new Set(recall.map(r => r.questionId));
const allIds = questions.map(q => q.id);
const missing = allIds.filter(id => !covered.has(id));

console.log('已有粗筛结果:', [...covered].join(', '));
console.log('缺失粗筛结果:', missing.join(', '));
console.log('总数:', allIds.length, '已有:', covered.size, '缺失:', missing.length);
