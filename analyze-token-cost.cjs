const fs = require('fs');
const path = require('path');

// DeepSeek 定价 (CNY per 1M tokens)
const PRICING = {
  prompt_cache_miss: 1.0,  // 输入缓存未命中
  prompt_cache_hit: 0.1,   // 输入缓存命中
  completion: 2.0          // 输出
};

function analyzeQuestion(questionDir) {
  const files = fs.readdirSync(questionDir);
  const responseFiles = files.filter(f => f.endsWith('-response.json'));
  
  let totalPromptCacheMiss = 0;
  let totalPromptCacheHit = 0;
  let totalCompletion = 0;
  const callDetails = [];
  
  for (const file of responseFiles) {
    const filePath = path.join(questionDir, file);
    try {
      const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      
      if (data.success && data.rawResponse && data.rawResponse.usage) {
        const usage = data.rawResponse.usage;
        const cacheMiss = usage.prompt_cache_miss_tokens || 0;
        const cacheHit = usage.prompt_cache_hit_tokens || 0;
        const completion = usage.completion_tokens || 0;
        
        totalPromptCacheMiss += cacheMiss;
        totalPromptCacheHit += cacheHit;
        totalCompletion += completion;
        
        callDetails.push({
          callId: data.callId,
          cacheMiss,
          cacheHit,
          completion,
          totalPrompt: cacheMiss + cacheHit
        });
      }
    } catch (err) {
      console.error(`Error reading ${file}:`, err.message);
    }
  }
  
  // 计算费用 (CNY)
  const costCacheMiss = (totalPromptCacheMiss / 1_000_000) * PRICING.prompt_cache_miss;
  const costCacheHit = (totalPromptCacheHit / 1_000_000) * PRICING.prompt_cache_hit;
  const costCompletion = (totalCompletion / 1_000_000) * PRICING.completion;
  const totalCost = costCacheMiss + costCacheHit + costCompletion;
  
  return {
    questionId: path.basename(questionDir),
    callCount: responseFiles.length,
    tokens: {
      promptCacheMiss: totalPromptCacheMiss,
      promptCacheHit: totalPromptCacheHit,
      completion: totalCompletion,
      totalPrompt: totalPromptCacheMiss + totalPromptCacheHit,
      total: totalPromptCacheMiss + totalPromptCacheHit + totalCompletion
    },
    cost: {
      cacheMiss: costCacheMiss,
      cacheHit: costCacheHit,
      completion: costCompletion,
      total: totalCost
    },
    callDetails
  };
}

function main() {
  const snapshotsDir = 'C:/Users/Administrator/Desktop/chenggong-jiachi-master/问题一/runs/2026-09-23-cache-test-rerun-remainder/snapshots';
  const questionDirs = fs.readdirSync(snapshotsDir)
    .map(name => path.join(snapshotsDir, name))
    .filter(p => fs.statSync(p).isDirectory());
  
  const results = questionDirs.map(dir => analyzeQuestion(dir));
  
  // 汇总
  const summary = {
    totalQuestions: results.length,
    totalCalls: results.reduce((sum, r) => sum + r.callCount, 0),
    totalTokens: {
      promptCacheMiss: results.reduce((sum, r) => sum + r.tokens.promptCacheMiss, 0),
      promptCacheHit: results.reduce((sum, r) => sum + r.tokens.promptCacheHit, 0),
      completion: results.reduce((sum, r) => sum + r.tokens.completion, 0)
    },
    totalCost: results.reduce((sum, r) => sum + r.cost.total, 0)
  };
  
  summary.totalTokens.totalPrompt = summary.totalTokens.promptCacheMiss + summary.totalTokens.promptCacheHit;
  summary.totalTokens.total = summary.totalTokens.totalPrompt + summary.totalTokens.completion;
  
  // 输出报告
  console.log('='.repeat(80));
  console.log('Token 消耗与费用分析报告');
  console.log('='.repeat(80));
  console.log();
  
  // 按问题输出
  results.sort((a, b) => a.questionId.localeCompare(b.questionId));
  
  for (const result of results) {
    console.log(`【${result.questionId}】`);
    console.log(`  LLM 调用次数: ${result.callCount}`);
    console.log(`  Token 消耗:`);
    console.log(`    输入 (缓存未命中): ${result.tokens.promptCacheMiss.toLocaleString()} tokens`);
    console.log(`    输入 (缓存命中):   ${result.tokens.promptCacheHit.toLocaleString()} tokens`);
    console.log(`    输出:              ${result.tokens.completion.toLocaleString()} tokens`);
    console.log(`    总输入:            ${result.tokens.totalPrompt.toLocaleString()} tokens`);
    console.log(`    总计:              ${result.tokens.total.toLocaleString()} tokens`);
    console.log(`  费用 (CNY):`);
    console.log(`    缓存未命中开销:    ¥${result.cost.cacheMiss.toFixed(6)}`);
    console.log(`    缓存命中开销:      ¥${result.cost.cacheHit.toFixed(6)}`);
    console.log(`    输出开销:          ¥${result.cost.completion.toFixed(6)}`);
    console.log(`    总费用:            ¥${result.cost.total.toFixed(6)}`);
    console.log();
  }
  
  console.log('='.repeat(80));
  console.log('汇总统计');
  console.log('='.repeat(80));
  console.log(`  问题总数:          ${summary.totalQuestions}`);
  console.log(`  LLM 调用总次数:    ${summary.totalCalls}`);
  console.log(`  Token 总消耗:`);
  console.log(`    输入 (缓存未命中): ${summary.totalTokens.promptCacheMiss.toLocaleString()} tokens`);
  console.log(`    输入 (缓存命中):   ${summary.totalTokens.promptCacheHit.toLocaleString()} tokens`);
  console.log(`    输出:              ${summary.totalTokens.completion.toLocaleString()} tokens`);
  console.log(`    总输入:            ${summary.totalTokens.totalPrompt.toLocaleString()} tokens`);
  console.log(`    总计:              ${summary.totalTokens.total.toLocaleString()} tokens`);
  console.log(`  费用总计 (CNY):`);
  console.log(`    缓存未命中开销:    ¥${(summary.totalTokens.promptCacheMiss / 1_000_000 * PRICING.prompt_cache_miss).toFixed(6)}`);
  console.log(`    缓存命中开销:      ¥${(summary.totalTokens.promptCacheHit / 1_000_000 * PRICING.prompt_cache_hit).toFixed(6)}`);
  console.log(`    输出开销:          ¥${(summary.totalTokens.completion / 1_000_000 * PRICING.completion).toFixed(6)}`);
  console.log(`    总费用:            ¥${summary.totalCost.toFixed(6)}`);
  console.log();
  
  // 计算缓存节省
  const wouldBeCostWithoutCache = ((summary.totalTokens.totalPrompt / 1_000_000) * PRICING.prompt_cache_miss) + 
                                  ((summary.totalTokens.completion / 1_000_000) * PRICING.completion);
  const savedCost = wouldBeCostWithoutCache - summary.totalCost;
  const savedPercentage = (savedCost / wouldBeCostWithoutCache) * 100;
  
  console.log('='.repeat(80));
  console.log('缓存节省分析');
  console.log('='.repeat(80));
  console.log(`  如果没有缓存，总费用: ¥${wouldBeCostWithoutCache.toFixed(6)}`);
  console.log(`  实际总费用:          ¥${summary.totalCost.toFixed(6)}`);
  console.log(`  节省费用:            ¥${savedCost.toFixed(6)}`);
  console.log(`  节省比例:            ${savedPercentage.toFixed(2)}%`);
  console.log(`  缓存命中率:          ${((summary.totalTokens.promptCacheHit / summary.totalTokens.totalPrompt) * 100).toFixed(2)}%`);
  console.log();
  
  // 保存 JSON 报告
  const outputPath = path.join(path.dirname(snapshotsDir), 'token-cost-report.json');
  fs.writeFileSync(outputPath, JSON.stringify({ summary, details: results }, null, 2));
  console.log(`详细报告已保存到: ${outputPath}`);
}

main();
