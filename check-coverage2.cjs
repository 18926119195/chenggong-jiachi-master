const fs = require('fs');
const p = 'C:\\Users\\Administrator\\Desktop\\2026-09-21-master\\noun-recall-results.json';
const data = JSON.parse(fs.readFileSync(p, 'utf8'));
console.log('文件:', p);
console.log('问题数:', data.length);
console.log('问题ID:', data.map(d => d.questionId).join(', '));
