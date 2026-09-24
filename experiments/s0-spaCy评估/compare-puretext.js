/**
 * 对比两个版本的纯文表构建是否一致
 */

import fs from 'fs';

// 主流程版本的内联逻辑
function stripHtmlTags(text) {
  return text
    .replace(/<\/?(?:div|table|tr|td|th|thead|tbody|sup|sub|span|p|br)\b[^>]*>/gi, '')
    .replace(/<[^>]+>/g, '');
}

function stripLatexResidue(text) {
  return text
    .replace(/\$\$[^$]*\$\$/g, ' ')
    .replace(/\$[^$\n]*\$/g, ' ')
    .replace(/\\[a-zA-Z]+(?:\{[^{}]*\})*/g, ' ')
    .replace(/\\+/g, ' ')
    .replace(/[\^_]\{[^{}]*\}/g, ' ')
    .replace(/\s{2,}/g, ' ');
}

function atomSearchText(chunk) {
  const text = chunk.faces?.text?.content?.trim();
  if (text && text.length >= 8) return stripLatexResidue(stripHtmlTags(text));
  const raw = (chunk.content || '').trim();
  if (raw && !raw.startsWith('[FIG:') && raw.length >= 8) return stripLatexResidue(stripHtmlTags(raw));
  if (text) return stripLatexResidue(stripHtmlTags(text));
  const note = (chunk.faces?.fig?.note || '').trim();
  return stripLatexResidue(stripHtmlTags(
    note
      .replace(/请依据可见版面回答[^。]*。?/g, '')
      .replace(/勿编造未提供的文字[^。]*。?/g, '')
      .replace(/无文字层\/未OCR[^。]*。?/g, '')
      .trim(),
  ));
}

function isRetrievableAtom(chunk) {
  const t = atomSearchText(chunk);
  if (t.length < 4) return false;
  if (chunk.kind === 'fig' && t.length < 24 && !chunk.faces?.text) return false;
  if (chunk.kind === 'fig' && !chunk.faces?.text) {
    const rawNote = chunk.faces?.fig?.note || '';
    if (/无文字层|未OCR/.test(rawNote)) return false;
  }
  return true;
}

function buildPureTextTable(bookIndex) {
  const entries = [];
  for (const chunk of bookIndex.chunks) {
    if (!isRetrievableAtom(chunk)) continue;
    const text = atomSearchText(chunk).trim();
    if (!text) continue;
    entries.push({ chunkKey: chunk.key, page: chunk.page, text });
  }
  return { entries };
}

// 加载 docuverse
const docuversePath = 'C:\\Users\\Administrator\\Desktop\\docuverse_cartographies_squizoanalythiques_Fe_lix_Guattari_1789114122714.docuverse.json';
const raw = fs.readFileSync(docuversePath, 'utf-8');
const data = JSON.parse(raw);

// 构建纯文表
const entries = buildPureTextTable(data.bookIndex).entries;

console.log('纯文表统计:');
console.log('  总 entries:', entries.length);
console.log('  总字符数:', entries.reduce((sum, e) => sum + e.text.length, 0));

// 检查前几个 chunk
console.log('\n前5个 chunk:');
for (let i = 0; i < 5; i++) {
  const e = entries[i];
  console.log(`  [${i}] chunkKey: ${e.chunkKey.slice(0, 20)}...`);
  console.log(`      text: "${e.text.slice(0, 50)}..."`);
  console.log(`      length: ${e.text.length}`);
}
