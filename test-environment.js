#!/usr/bin/env node
/**
 * 环境验证测试脚本
 * 
 * 用途：验证 Node.js、Python、spaCy 服务和 LLM API 是否正确配置
 * 用法：node test-environment.js
 */

import { LLM_API_KEY, callLLM } from './src/core/llmClient.js';
import fs from 'fs';

async function testEnvironment() {
  console.log('='.repeat(60));
  console.log('🔍 环境验证测试');
  console.log('='.repeat(60));
  
  let allPassed = true;
  
  // 1. 检查必要文件
  console.log('\n📁 1. 检查项目文件...');
  const requiredFiles = [
    'package.json',
    'src/core/llmClient.js',
    'spacy-sidecar/server.py',
    'test-questions.json',
    'final-noun-index.json'
  ];
  
  for (const file of requiredFiles) {
    if (fs.existsSync(file)) {
      console.log(`   ✅ ${file}`);
    } else {
      console.log(`   ❌ ${file} 缺失`);
      allPassed = false;
    }
  }
  
  // 2. 检查 .env 配置
  console.log('\n⚙️  2. 检查环境配置...');
  if (!fs.existsSync('.env')) {
    console.log('   ⚠️  .env 文件不存在，请复制 .env.example 并配置');
    console.log('      命令: Copy-Item .env.example .env (PowerShell)');
    allPassed = false;
  } else {
    console.log('   ✅ .env 文件存在');
  }
  
  // 3. 检查 API Key
  console.log('\n🔑 3. 检查 LLM API Key...');
  if (!LLM_API_KEY || LLM_API_KEY.length < 10 || LLM_API_KEY.includes('your')) {
    console.log('   ❌ API Key 未配置或无效');
    console.log('      请在 .env 文件中设置正确的 LLM_API_KEY');
    allPassed = false;
  } else {
    console.log(`   ✅ API Key 已配置 (${LLM_API_KEY.slice(0, 10)}...)`);
  }
  
  // 4. 检查 spaCy 服务
  console.log('\n🐍 4. 检查 spaCy 服务 (http://localhost:5001)...');
  try {
    const res = await fetch('http://localhost:5001/health', { 
      signal: AbortSignal.timeout(3000) 
    });
    if (res.ok) {
      const data = await res.json();
      console.log('   ✅ spaCy 服务正常运行');
      console.log(`      模型: ${data.model}`);
      console.log(`      状态: ${data.status}`);
    } else {
      console.log(`   ❌ spaCy 服务响应异常 (${res.status})`);
      allPassed = false;
    }
  } catch (err) {
    console.log('   ❌ spaCy 服务未启动或无法连接');
    console.log('      请在另一个终端运行: python spacy-sidecar/server.py');
    console.log(`      错误: ${err.message}`);
    allPassed = false;
  }
  
  // 5. 测试 LLM 调用
  console.log('\n🤖 5. 测试 LLM API 调用...');
  if (!LLM_API_KEY || LLM_API_KEY.includes('your')) {
    console.log('   ⏭️  跳过（API Key 未配置）');
  } else {
    try {
      console.log('   正在调用 DeepSeek API（可能需要几秒）...');
      const result = await callLLM('请用一句话回复：测试成功', { 
        maxTokens: 256,
        temperature: 0
      });
      
      if (result && result.text) {
        console.log('   ✅ LLM 调用成功');
        console.log(`      响应: ${result.text.slice(0, 100).trim()}`);
        if (result.usage) {
          console.log(`      Token 使用: ${result.usage.total_tokens}`);
        }
      } else {
        console.log('   ❌ LLM 调用失败，返回为空');
        allPassed = false;
      }
    } catch (err) {
      console.log('   ❌ LLM 调用失败');
      console.log(`      错误: ${err.message}`);
      allPassed = false;
    }
  }
  
  // 总结
  console.log('\n' + '='.repeat(60));
  if (allPassed) {
    console.log('✅ 所有测试通过！环境配置正确');
    console.log('\n下一步：运行完整流程');
    console.log('  node run-full-pipeline.js Z1-Q1');
  } else {
    console.log('❌ 部分测试失败，请根据上述提示修复问题');
    console.log('\n常见问题解决：');
    console.log('  1. Node.js 未安装: 访问 https://nodejs.org/');
    console.log('  2. Python 未安装: 访问 https://www.python.org/');
    console.log('  3. spaCy 模型未下载: python -m spacy download fr_core_news_sm');
    console.log('  4. API Key 未配置: 编辑 .env 文件');
    console.log('\n详细文档: DEPLOYMENT.md');
  }
  console.log('='.repeat(60));
  
  process.exit(allPassed ? 0 : 1);
}

testEnvironment().catch(err => {
  console.error('\n💥 测试脚本执行失败:');
  console.error(err);
  process.exit(1);
});
