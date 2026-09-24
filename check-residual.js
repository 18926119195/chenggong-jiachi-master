import fs from 'fs';
const report = JSON.parse(fs.readFileSync('./s0-quality-report.json', 'utf-8'));
const target = 'h1.P84ABCn3NGL2gt2L6I_txUCsSiOqaLwoWEqH3f6zgTkiY5sDQ_ZNvLPKgxJG7glfI2QXTXFUZHq1TbgaM94VqdpXzgjS3rpQADnEowuVCl6XRh4ngZUHn7z7rI6xP1vvqjO4uAczGm9QPlUnziJm';
const residuals = report.residuals.filter(r => r.chunkKey === target);
console.log('该 chunkKey 的全部残文条数:', residuals.length);
residuals.forEach((r, i) => {
  console.log('');
  console.log('残文 #' + (i + 1) + ':');
  console.log('  位置: ' + r.start + '-' + r.end);
  console.log('  文本: "' + r.text + '"');
});
