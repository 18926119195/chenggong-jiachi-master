// 需要添加到 s1-llm-fill.js 的 STOPWORDS 列表中的法语数词

const MISSING_NUMERALS = [
  // 基数词 (0-20)
  'zéro', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf', 'dix',
  'onze', 'douze', 'treize', 'quatorze', 'quinze', 'seize',
  'vingt', 'trente', 'quarante', 'cinquante', 'soixante',
  'cent', 'cents', 'mille', 'million', 'millions', 'milliard', 'milliards',
  
  // 序数词
  'premier', 'première', 'premiers', 'premières',
  'second', 'seconde', 'seconds', 'secondes',
  'deuxième', 'troisième', 'quatrième', 'cinquième', 'sixième', 'septième', 'huitième', 'neuvième', 'dixième',
  'dernier', 'dernière', 'derniers', 'dernières',
  
  // 不定数量词（已有部分，补充遗漏的）
  'aucun', 'aucune', 'plusieurs', 'nombreux', 'nombreuses',
  'peu', 'beaucoup', 'assez', 'trop', 'tant',
  
  // 常见量词短语成分
  'moitié', 'quart', 'tiers', 'double', 'triple',
];

console.log('建议添加到 STOPWORDS 的数词和量词：');
console.log(MISSING_NUMERALS.join(', '));
console.log(`\n总计: ${MISSING_NUMERALS.length} 个词`);
