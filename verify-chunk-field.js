import { readFileSync } from 'fs';

const docuversePath = process.argv[2];
if (!docuversePath) {
  console.error('Usage: node verify-chunk-field.js <docuverse.json path>');
  process.exit(1);
}

console.log('Reading docuverse file...');
const raw = readFileSync(docuversePath, 'utf8');
const data = JSON.parse(raw);

if (!data.bookIndex?.chunks || data.bookIndex.chunks.length === 0) {
  console.error('No chunks found in bookIndex');
  process.exit(1);
}

const firstChunk = data.bookIndex.chunks[0];
const secondChunk = data.bookIndex.chunks[1];

console.log('\n=== First chunk fields ===');
console.log(Object.keys(firstChunk));
console.log('\n=== First chunk sample ===');
console.log(JSON.stringify(firstChunk, null, 2).slice(0, 500));

console.log('\n=== Second chunk sample ===');
console.log(JSON.stringify(secondChunk, null, 2).slice(0, 500));

console.log('\n=== Field check ===');
console.log(`chunk.key exists: ${firstChunk.key !== undefined}`);
console.log(`chunk.bookKey exists: ${firstChunk.bookKey !== undefined}`);

if (firstChunk.key) console.log(`chunk.key value: "${firstChunk.key}"`);
if (firstChunk.bookKey) console.log(`chunk.bookKey value: "${firstChunk.bookKey}"`);
