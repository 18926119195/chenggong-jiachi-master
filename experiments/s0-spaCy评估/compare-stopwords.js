/**
 * 对比两个版本的虚词表差异
 */

import fs from 'fs';

// 主流程版本虚词表
const mainFlowStopWords = new Set([
  'le', 'la', 'les', 'l', 'un', 'une', 'des', 'du', 'au', 'aux',
  'de', 'à', 'a', 'en', 'sur', 'sous', 'dans', 'par', 'pour', 'avec', 'sans',
  'vers', 'chez', 'entre', 'depuis', 'pendant', 'devant', 'derrière', 'jusque', 'jusqu',
  'contre', 'selon', 'malgré', 'outre', 'parmi', 'hors',
  'et', 'ou', 'ni', 'mais', 'donc', 'car', 'or', 'que', 'qu', 'si', 's',
  'comme', 'quand', 'lorsque', 'puisque', 'quoique',
  'qui', 'quoi', 'dont', 'où', 'ce', 'cet', 'cette', 'ces', 'celui', 'celle', 'ceux', 'celles',
  'il', 'elle', 'ils', 'elles', 'on', 'nous', 'vous', 'je', 'tu', 'te', 't', 'me', 'm',
  'lui', 'leur', 'leurs', 'son', 'sa', 'ses', 'notre', 'nos', 'votre', 'vos', 'mon', 'ma', 'mes',
  'y', 'en2', 'se', 'soi',  // 注意：这里是 en2 而不是 en
  'd', 'n', 'j', 'c',
  'est', 'sont', 'être', 'a', 'ont', 'avoir', 'fut', 'était', 'étaient',
  'ne', 'pas', 'plus', 'moins', 'très', 'bien', 'aussi', 'ainsi', 'alors', 'donc',
  'là', 'ici', 'déjà', 'encore', 'toujours', 'jamais', 'peu', 'trop',
]);

// 实验版本虚词表
const experimentStopWords = new Set([
  'le', 'la', 'les', 'l', 'un', 'une', 'des', 'du', 'au', 'aux',
  'de', 'à', 'a', 'en', 'sur', 'sous', 'dans', 'par', 'pour', 'avec', 'sans',
  'vers', 'chez', 'entre', 'depuis', 'pendant', 'devant', 'derrière', 'jusque', 'jusqu',
  'contre', 'selon', 'malgré', 'outre', 'parmi', 'hors',
  'et', 'ou', 'ni', 'mais', 'donc', 'car', 'or', 'que', 'qu', 'si', 's',
  'comme', 'quand', 'lorsque', 'puisque', 'quoique',
  'qui', 'quoi', 'dont', 'où', 'ce', 'cet', 'cette', 'ces', 'celui', 'celle', 'ceux', 'celles',
  'il', 'elle', 'ils', 'elles', 'on', 'nous', 'vous', 'je', 'tu', 'te', 't', 'me', 'm',
  'lui', 'leur', 'leurs', 'son', 'sa', 'ses', 'notre', 'nos', 'votre', 'vos', 'mon', 'ma', 'mes',
  'y', 'en', 'se', 'soi',  // 注意：这里是 en
  'd', 'n', 'j', 'c',
  'est', 'sont', 'être', 'a', 'ont', 'avoir', 'fut', 'était', 'étaient',
  'ne', 'pas', 'plus', 'moins', 'très', 'bien', 'aussi', 'ainsi', 'alors', 'donc',
  'là', 'ici', 'déjà', 'encore', 'toujours', 'jamais', 'peu', 'trop',
]);

console.log('虚词表差异分析:\n');

// 找出差异
const onlyInMainFlow = [];
const onlyInExperiment = [];

for (const word of mainFlowStopWords) {
  if (!experimentStopWords.has(word)) {
    onlyInMainFlow.push(word);
  }
}

for (const word of experimentStopWords) {
  if (!mainFlowStopWords.has(word)) {
    onlyInExperiment.push(word);
  }
}

console.log('只在主流程版本中:');
console.log(`  ${onlyInMainFlow.join(', ')}`);

console.log('\n只在实验版本中:');
console.log(`  ${onlyInExperiment.join(', ')}`);

console.log('\n总词数:');
console.log(`  主流程版本: ${mainFlowStopWords.size}`);
console.log(`  实验版本: ${experimentStopWords.size}`);

// 测试 "en" 是否在两个版本中
console.log('\n关键测试:');
console.log(`  主流程版本有 'en': ${mainFlowStopWords.has('en')}`);
console.log(`  实验版本有 'en': ${experimentStopWords.has('en')}`);
console.log(`  主流程版本有 'en2': ${mainFlowStopWords.has('en2')}`);
console.log(`  实验版本有 'en2': ${experimentStopWords.has('en2')}`);
