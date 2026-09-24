const fs = require('fs');
const data = JSON.parse(fs.readFileSync('final-noun-index.json', 'utf8'));
const nouns = data.nouns;
console.log('total noun entries:', nouns.length);
const idCount = {};
const surfaceLowerMap = {};
for (const n of nouns) {
  idCount[n.id] = (idCount[n.id] || 0) + 1;
  const key = (n.surface || '').toLowerCase();
  if (!surfaceLowerMap[key]) surfaceLowerMap[key] = [];
  surfaceLowerMap[key].push(n.surface);
}
const dupIds = Object.entries(idCount).filter(([k, v]) => v > 1);
const dupSurfaceLower = Object.entries(surfaceLowerMap).filter(([k, v]) => v.length > 1);
console.log('duplicate ids (exact id collision):', dupIds.length);
console.log(JSON.stringify(dupIds.slice(0, 20)));
console.log('duplicate surface (case-insensitive) groups:', dupSurfaceLower.length);
console.log(JSON.stringify(dupSurfaceLower.slice(0, 30)));
