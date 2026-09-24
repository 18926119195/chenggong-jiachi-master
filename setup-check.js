#!/usr/bin/env node
/**
 * 快速安装检查脚本
 * 用法：npm run setup
 */

import fs from 'fs';
import { execSync } from 'child_process';

console.log('='.repeat(60));
console.log('📦 环境检查与配置');
console.log('='.repeat(60));

let hasErrors = false;

// 1. 检查 Node.js 版本
console.log('\n1. Node.js 版本检查...');
const nodeVersion = process.version;
const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0]);
if (majorVersion >= 18) {
  console.log(`   ✅ Node.js ${nodeVersion} (符合要求 >=18.0.0)`);
} else {
  console.log(`   ❌ Node.js ${nodeVersion} 版本过低，需要 >=18.0.0`);
  hasErrors = true;
}

// 2. 检查 Python
console.log('\n2. Python 检查...');
try {
  const pythonVersion = execSync('python --version', { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'ignore'] }).trim();
  console.log(`   ✅ ${pythonVersion}`);
} catch (err) {
  console.log('   ❌ Python 未安装或未添加到 PATH');
  console.log('      下载地址: https://www.python.org/');
  hasErrors = true;
}

// 3. 检查必要文件
console.log('\n3. 项目文件检查...');
const requiredFiles = [
  'spacy-sidecar/server.py',
  'src/core/llmClient.js',
  'test-questions.json',
  'requirements.txt'
];

for (const file of requiredFiles) {
  if (fs.existsSync(file)) {
    console.log(`   ✅ ${file}`);
  } else {
    console.log(`   ❌ ${file} 缺失`);
    hasErrors = true;
  }
}

// 4. 检查 .env
console.log('\n4. 环境配置检查...');
if (fs.existsSync('.env')) {
  console.log('   ✅ .env 文件存在');
  const envContent = fs.readFileSync('.env', 'utf-8');
  if (envContent.includes('your_deepseek_api_key_here') || !envContent.includes('LLM_API_KEY=sk-')) {
    console.log('   ⚠️  API Key 似乎未配置，请编辑 .env 文件');
  }
} else {
  console.log('   ⚠️  .env 文件不存在');
  if (fs.existsSync('.env.example')) {
    console.log('   正在从 .env.example 创建...');
    fs.copyFileSync('.env.example', '.env');
    console.log('   ✅ 已创建 .env 文件，请编辑并填入 API Key');
  } else {
    console.log('   ❌ .env.example 也不存在');
    hasErrors = true;
  }
}

// 5. 检查 Python 依赖
console.log('\n5. Python 依赖检查...');
const pythonPackages = ['flask', 'flask_cors', 'spacy'];
let missingPackages = [];

for (const pkg of pythonPackages) {
  try {
    execSync(`python -c "import ${pkg}"`, { stdio: 'ignore' });
    console.log(`   ✅ ${pkg}`);
  } catch (err) {
    console.log(`   ❌ ${pkg} 未安装`);
    missingPackages.push(pkg);
  }
}

if (missingPackages.length > 0) {
  console.log('\n   正在安装缺失的 Python 包...');
  try {
    execSync('pip install -r requirements.txt', { stdio: 'inherit' });
    console.log('   ✅ Python 依赖安装完成');
  } catch (err) {
    console.log('   ❌ Python 依赖安装失败');
    hasErrors = true;
  }
}

// 6. 检查 spaCy 模型
console.log('\n6. spaCy 模型检查...');
try {
  execSync('python -c "import spacy; spacy.load(\'fr_core_news_sm\')"', { stdio: 'ignore' });
  console.log('   ✅ fr_core_news_sm 模型已安装');
} catch (err) {
  console.log('   ❌ spaCy 模型未安装');
  console.log('   正在下载 fr_core_news_sm...');
  try {
    execSync('python -m spacy download fr_core_news_sm', { stdio: 'inherit' });
    console.log('   ✅ spaCy 模型下载完成');
  } catch (downloadErr) {
    console.log('   ❌ spaCy 模型下载失败');
    hasErrors = true;
  }
}

// 总结
console.log('\n' + '='.repeat(60));
if (hasErrors) {
  console.log('❌ 配置过程中发现问题，请根据上述提示修复');
  console.log('\n详细文档: DEPLOYMENT.md');
  process.exit(1);
} else {
  console.log('✅ 环境检查通过！');
  console.log('\n下一步:');
  console.log('  1. 编辑 .env 文件，配置 LLM_API_KEY');
  console.log('  2. 运行环境测试: npm run test:env');
  console.log('  3. 启动 spaCy 服务 (新终端): python spacy-sidecar/server.py');
  console.log('  4. 运行完整流程: npm run pipeline Z1-Q1');
  console.log('\n快速指南: QUICKSTART.md');
}
console.log('='.repeat(60));
