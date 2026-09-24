import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const configDir = 'c:\\Users\\Administrator\\Desktop\\chenggong-jiachi-master\\cot对比实验\\提高缓存命中率的实验\\llm-configs';

// 提取所有【【数字】】格式的引用
function extractCitations(text) {
    const regex = /【【(\d+)】】/g;
    const citations = new Set();
    let match;
    while ((match = regex.exec(text)) !== null) {
        citations.add(match[1]);
    }
    return Array.from(citations).sort((a, b) => parseInt(a) - parseInt(b));
}

// 检查单个文件
function verifyFile(filepath) {
    const content = fs.readFileSync(filepath, 'utf8');
    const data = JSON.parse(content);
    
    const thinkingCitations = extractCitations(data.thinkingChain || '');
    const outputCitations = extractCitations(data.llmOutput || '');
    
    // 检查 output 中的引用是否都在 thinking 中出现过
    const missingInThinking = outputCitations.filter(c => !thinkingCitations.includes(c));
    const onlyInThinking = thinkingCitations.filter(c => !outputCitations.includes(c));
    
    return {
        filename: path.basename(filepath),
        thinkingCount: thinkingCitations.length,
        outputCount: outputCitations.length,
        thinkingCitations,
        outputCitations,
        missingInThinking, // output中有但thinking中没有的
        onlyInThinking,    // thinking中有但output中没有的
        coverage: outputCitations.length > 0 
            ? ((outputCitations.length - missingInThinking.length) / outputCitations.length * 100).toFixed(1)
            : '100.0'
    };
}

// 主函数
function main() {
    const files = fs.readdirSync(configDir)
        .filter(f => f.startsWith('reasoning-output-Z') && f.endsWith('.json'))
        .sort();
    
    console.log('='.repeat(80));
    console.log('验证 thinkingChain 和 llmOutput 中材料引用的对应关系');
    console.log('='.repeat(80));
    console.log('');
    
    const results = [];
    
    for (const file of files) {
        const filepath = path.join(configDir, file);
        const result = verifyFile(filepath);
        results.push(result);
        
        console.log(`📄 ${result.filename}`);
        console.log(`   思维链引用数: ${result.thinkingCount}`);
        console.log(`   最终答案引用数: ${result.outputCount}`);
        console.log(`   覆盖率: ${result.coverage}% (最终答案中的引用在思维链中出现)`);
        
        if (result.missingInThinking.length > 0) {
            console.log(`   ⚠️  最终答案中有但思维链中没有: ${result.missingInThinking.join(', ')}`);
        }
        
        if (result.onlyInThinking.length > 0) {
            console.log(`   💭 仅在思维链中规划但未用于最终答案: ${result.onlyInThinking.slice(0, 10).join(', ')}${result.onlyInThinking.length > 10 ? '...' : ''}`);
        }
        
        console.log('');
    }
    
    // 汇总统计
    console.log('='.repeat(80));
    console.log('📊 汇总统计');
    console.log('='.repeat(80));
    
    const avgCoverage = results.reduce((sum, r) => sum + parseFloat(r.coverage), 0) / results.length;
    const perfectCoverage = results.filter(r => r.missingInThinking.length === 0).length;
    
    console.log(`总文件数: ${results.length}`);
    console.log(`平均覆盖率: ${avgCoverage.toFixed(1)}%`);
    console.log(`完美覆盖（100%）: ${perfectCoverage}/${results.length}`);
    console.log(`有缺失的文件: ${results.length - perfectCoverage}`);
    
    // 保存详细报告
    const report = {
        summary: {
            totalFiles: results.length,
            avgCoverage: parseFloat(avgCoverage.toFixed(1)),
            perfectCoverage,
            filesWithMissing: results.length - perfectCoverage
        },
        details: results
    };
    
    const reportPath = path.join(configDir, 'citation-mapping-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf8');
    console.log(`\n✅ 详细报告已保存到: ${reportPath}`);
}

main();
