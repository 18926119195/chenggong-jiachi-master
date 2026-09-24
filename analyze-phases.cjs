const fs = require('fs');
const path = require('path');

// DeepSeek 定价 (CNY per 1M tokens)
const PRICING = {
  prompt_cache_miss: 1.0,
  prompt_cache_hit: 0.1,
  completion: 2.0
};

function analyzeQuestionPhases(questionDir) {
  const questionId = path.basename(questionDir);
  const files = fs.readdirSync(questionDir);
  const requestFiles = files.filter(f => f.endsWith('-request.json')).sort();
  const responseFiles = files.filter(f => f.endsWith('-response.json')).sort();
  
  // 识别粗筛阶段
  const coarseCallIds = [];
  const scoreCallIds = [];
  
  for (const reqFile of requestFiles) {
    const reqPath = path.join(questionDir, reqFile);
    const req = JSON.parse(fs.readFileSync(reqPath, 'utf8'));
    
    const isCoarse = req.promptPreview.includes('选出所有对回答这个问题可能有帮助的词');
    if (isCoarse) {
      coarseCallIds.push(req.callId);
    } else {
      scoreCallIds.push(req.callId);
    }
  }
  
  // 统计各阶段 token
  const coarseStats = { calls: 0, promptCacheMiss: 0, promptCacheHit: 0, completion: 0 };
  const scoreStats = { calls: 0, promptCacheMiss: 0, promptCacheHit: 0, completion: 0 };
  
  for (const resFile of responseFiles) {
    const resPath = path.join(questionDir, resFile);
    try {
      const res = JSON.parse(fs.readFileSync(resPath, 'utf8'));
      
      if (res.success && res.rawResponse && res.rawResponse.usage) {
        const usage = res.rawResponse.usage;
        const stats = coarseCallIds.includes(res.callId) ? coarseStats : scoreStats;
        
        stats.calls++;
        stats.promptCacheMiss += usage.prompt_cache_miss_tokens || 0;
        stats.promptCacheHit += usage.prompt_cache_hit_tokens || 0;
        stats.completion += usage.completion_tokens || 0;
      }
    } catch (err) {
      console.error(`Error reading ${resFile}:`, err.message);
    }
  }
  
  // 计算费用
  function calcCost(stats) {
    const costCacheMiss = (stats.promptCacheMiss / 1_000_000) * PRICING.prompt_cache_miss;
    const costCacheHit = (stats.promptCacheHit / 1_000_000) * PRICING.prompt_cache_hit;
    const costCompletion = (stats.completion / 1_000_000) * PRICING.completion;
    return {
      cacheMiss: costCacheMiss,
      cacheHit: costCacheHit,
      completion: costCompletion,
      total: costCacheMiss + costCacheHit + costCompletion
    };
  }
  
  return {
    questionId,
    coarse: {
      ...coarseStats,
      totalPrompt: coarseStats.promptCacheMiss + coarseStats.promptCacheHit,
      total: coarseStats.promptCacheMiss + coarseStats.promptCacheHit + coarseStats.completion,
      cost: calcCost(coarseStats)
    },
    score: {
      ...scoreStats,
      totalPrompt: scoreStats.promptCacheMiss + scoreStats.promptCacheHit,
      total: scoreStats.promptCacheMiss + scoreStats.promptCacheHit + scoreStats.completion,
      cost: calcCost(scoreStats)
    }
  };
}

function main() {
  const snapshotsDir = 'C:/Users/Administrator/Desktop/chenggong-jiachi-master/问题一/runs/2026-09-23-cache-test-rerun-remainder/snapshots';
  const questionDirs = fs.readdirSync(snapshotsDir)
    .map(name => path.join(snapshotsDir, name))
    .filter(p => fs.statSync(p).isDirectory());
  
  const results = questionDirs.map(dir => analyzeQuestionPhases(dir));
  results.sort((a, b) => a.questionId.localeCompare(b.questionId));
  
  // 汇总
  const totalCoarse = {
    calls: 0,
    promptCacheMiss: 0,
    promptCacheHit: 0,
    completion: 0,
    totalPrompt: 0,
    total: 0,
    costTotal: 0
  };
  
  const totalScore = {
    calls: 0,
    promptCacheMiss: 0,
    promptCacheHit: 0,
    completion: 0,
    totalPrompt: 0,
    total: 0,
    costTotal: 0
  };
  
  console.log('='.repeat(100));
  console.log('粗筛阶段 vs 打分阶段 Token 消耗对比');
  console.log('='.repeat(100));
  console.log();
  
  for (const result of results) {
    console.log(`【${result.questionId}】`);
    console.log(`  粗筛阶段 (${result.coarse.calls} 次调用):`);
    console.log(`    输入缓存未命中:  ${result.coarse.promptCacheMiss.toLocaleString()} tokens`);
    console.log(`    输入缓存命中:    ${result.coarse.promptCacheHit.toLocaleString()} tokens`);
    console.log(`    输出:            ${result.coarse.completion.toLocaleString()} tokens`);
    console.log(`    总计:            ${result.coarse.total.toLocaleString()} tokens`);
    console.log(`    费用:            ¥${result.coarse.cost.total.toFixed(6)}`);
    console.log();
    console.log(`  打分阶段 (${result.score.calls} 次调用):`);
    console.log(`    输入缓存未命中:  ${result.score.promptCacheMiss.toLocaleString()} tokens`);
    console.log(`    输入缓存命中:    ${result.score.promptCacheHit.toLocaleString()} tokens`);
    console.log(`    输出:            ${result.score.completion.toLocaleString()} tokens`);
    console.log(`    总计:            ${result.score.total.toLocaleString()} tokens`);
    console.log(`    费用:            ¥${result.score.cost.total.toFixed(6)}`);
    console.log();
    console.log(`  粗筛占比: ${(result.coarse.total / (result.coarse.total + result.score.total) * 100).toFixed(1)}% tokens, ${(result.coarse.cost.total / (result.coarse.cost.total + result.score.cost.total) * 100).toFixed(1)}% 费用`);
    console.log();
    
    totalCoarse.calls += result.coarse.calls;
    totalCoarse.promptCacheMiss += result.coarse.promptCacheMiss;
    totalCoarse.promptCacheHit += result.coarse.promptCacheHit;
    totalCoarse.completion += result.coarse.completion;
    totalCoarse.total += result.coarse.total;
    totalCoarse.costTotal += result.coarse.cost.total;
    
    totalScore.calls += result.score.calls;
    totalScore.promptCacheMiss += result.score.promptCacheMiss;
    totalScore.promptCacheHit += result.score.promptCacheHit;
    totalScore.completion += result.score.completion;
    totalScore.total += result.score.total;
    totalScore.costTotal += result.score.cost.total;
  }
  
  totalCoarse.totalPrompt = totalCoarse.promptCacheMiss + totalCoarse.promptCacheHit;
  totalScore.totalPrompt = totalScore.promptCacheMiss + totalScore.promptCacheHit;
  
  console.log('='.repeat(100));
  console.log('汇总统计');
  console.log('='.repeat(100));
  console.log();
  console.log(`粗筛阶段总计 (${totalCoarse.calls} 次调用):`);
  console.log(`  输入缓存未命中:  ${totalCoarse.promptCacheMiss.toLocaleString()} tokens`);
  console.log(`  输入缓存命中:    ${totalCoarse.promptCacheHit.toLocaleString()} tokens`);
  console.log(`  输出:            ${totalCoarse.completion.toLocaleString()} tokens`);
  console.log(`  总输入:          ${totalCoarse.totalPrompt.toLocaleString()} tokens`);
  console.log(`  总计:            ${totalCoarse.total.toLocaleString()} tokens`);
  console.log(`  费用:            ¥${totalCoarse.costTotal.toFixed(6)}`);
  console.log();
  console.log(`打分阶段总计 (${totalScore.calls} 次调用):`);
  console.log(`  输入缓存未命中:  ${totalScore.promptCacheMiss.toLocaleString()} tokens`);
  console.log(`  输入缓存命中:    ${totalScore.promptCacheHit.toLocaleString()} tokens`);
  console.log(`  输出:            ${totalScore.completion.toLocaleString()} tokens`);
  console.log(`  总输入:          ${totalScore.totalPrompt.toLocaleString()} tokens`);
  console.log(`  总计:            ${totalScore.total.toLocaleString()} tokens`);
  console.log(`  费用:            ¥${totalScore.costTotal.toFixed(6)}`);
  console.log();
  
  const grandTotal = totalCoarse.total + totalScore.total;
  const grandCost = totalCoarse.costTotal + totalScore.costTotal;
  
  console.log('='.repeat(100));
  console.log('阶段占比分析');
  console.log('='.repeat(100));
  console.log(`粗筛阶段占比: ${(totalCoarse.total / grandTotal * 100).toFixed(2)}% tokens, ${(totalCoarse.costTotal / grandCost * 100).toFixed(2)}% 费用`);
  console.log(`打分阶段占比: ${(totalScore.total / grandTotal * 100).toFixed(2)}% tokens, ${(totalScore.costTotal / grandCost * 100).toFixed(2)}% 费用`);
  console.log();
  
  // 保存详细报告
  const outputPath = path.join(path.dirname(snapshotsDir), 'token-cost-by-phase.json');
  fs.writeFileSync(outputPath, JSON.stringify({
    coarseTotal: totalCoarse,
    scoreTotal: totalScore,
    details: results
  }, null, 2));
  console.log(`详细报告已保存到: ${outputPath}`);
}

main();
