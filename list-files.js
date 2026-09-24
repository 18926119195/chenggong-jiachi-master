const fs = require('fs');
const path = require('path');

const d = 'C:\\Users\\Administrator\\Desktop\\zhongjiban-ultimate-master\\cot对比实验';

const out = fs.readdirSync(d).filter(f => f.startsWith('reasoning-output-cot-') && f.endsWith('.json')).sort();
const sn = fs.readdirSync(path.join(d, 'snapshots')).filter(f => f.startsWith('cot-input-') && f.endsWith('.txt')).sort();
const lg = fs.readdirSync(path.join(d, 'logs')).filter(f => f.startsWith('cot-run-') && f.endsWith('.log')).sort();

console.log('=== OUTPUT JSON (' + out.length + ') ===');
out.forEach(f => { const s = fs.statSync(path.join(d, f)).size; console.log('  ' + f + ' (' + Math.round(s/1024) + ' KB)'); });

console.log('\n=== INPUT SNAPSHOTS (' + sn.length + ') ===');
sn.forEach(f => { const s = fs.statSync(path.join(d, 'snapshots', f)).size; console.log('  ' + f + ' (' + Math.round(s/1024) + ' KB)'); });

console.log('\n=== LOG FILES (' + lg.length + ') ===');
lg.forEach(f => { const s = fs.statSync(path.join(d, 'logs', f)).size; console.log('  ' + f + ' (' + s + ' bytes)'); });
