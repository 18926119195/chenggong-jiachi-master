import fs from 'fs';
import 'dotenv/config';

const dedup = JSON.parse(fs.readFileSync('./final-noun-index.json', 'utf-8'));

// 分批处理：每批 200 个词，避免超长 prompt
const BATCH_SIZE = 200;
const allNouns = dedup.nouns.map(n => n.surface);

async function auditBatch(batch, batchIndex) {
  const prompt = `你是一个法语语言学家。以下是从法语学术文本中提取的${batch.length}个候选名词，请逐个判断是否为实词（名词、专有名词、名词短语）。

虚词包括：冠词（le/la/les/un/une/des）、介词（de/à/en/dans/pour/avec/sur）、连词（et/ou/mais）、代词（je/tu/il/elle/ce/qui/que）、助动词（être/avoir的变位形式）。

标点碎片、单字母、纯数字、纯符号也应标记为无效。

请输出 JSON 数组格式，每个元素包含：
{ "surface": "原词", "valid": true/false, "reason": "简短原因（仅 valid=false 时需要）" }

候选词列表：
${batch.map((w, i) => `${i + 1}. ${w}`).join('\n')}

只返回 JSON 数组，不要其他解释文字。`;

  const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.LLM_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.1,
    }),
  });

  const data = await response.json();
  
  if (!response.ok || !data.choices || data.choices.length === 0) {
    console.error('API 响应错误:', JSON.stringify(data, null, 2));
    throw new Error('API 调用失败');
  }
  
  const content = data.choices[0].message.content.trim();
  
  // 提取 JSON（可能被包裹在 ```json ... ``` 中）
  const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/) || content.match(/\[[\s\S]*\]/);
  if (!jsonMatch) {
    throw new Error('LLM 返回格式错误: ' + content.slice(0, 200));
  }
  
  const results = JSON.parse(jsonMatch[1] || jsonMatch[0]);
  
  console.log(`批次 ${batchIndex + 1}/${Math.ceil(allNouns.length / BATCH_SIZE)} 完成，检测到 ${results.filter(r => !r.valid).length} 个无效词`);
  
  return results;
}

async function main() {
  const allResults = [];
  
  for (let i = 0; i < allNouns.length; i += BATCH_SIZE) {
    const batch = allNouns.slice(i, i + BATCH_SIZE);
    const batchIndex = Math.floor(i / BATCH_SIZE);
    
    try {
      const results = await auditBatch(batch, batchIndex);
      allResults.push(...results);
      
      // 保存中间结果（防止中断）
      fs.writeFileSync(
        `./audit-progress-${batchIndex}.json`,
        JSON.stringify(results, null, 2)
      );
      
      // API 限速：每批间隔 2 秒
      if (i + BATCH_SIZE < allNouns.length) {
        await new Promise(r => setTimeout(r, 2000));
      }
    } catch (err) {
      console.error(`批次 ${batchIndex} 失败:`, err.message);
      // 保存当前进度
      fs.writeFileSync('./audit-results-partial.json', JSON.stringify(allResults, null, 2));
      throw err;
    }
  }
  
  // 汇总结果
  const invalidWords = allResults.filter(r => !r.valid);
  
  fs.writeFileSync('./audit-stopwords-full.json', JSON.stringify({
    total: allResults.length,
    invalid: invalidWords.length,
    validRate: ((allResults.length - invalidWords.length) / allResults.length * 100).toFixed(2) + '%',
    invalidList: invalidWords
  }, null, 2));
  
  console.log('\n===== 全量审查完成 =====');
  console.log('总词数:', allResults.length);
  console.log('无效词数:', invalidWords.length);
  console.log('有效率:', ((allResults.length - invalidWords.length) / allResults.length * 100).toFixed(2) + '%');
  console.log('\n结果已保存至 audit-stopwords-full.json');
}

main().catch(console.error);
