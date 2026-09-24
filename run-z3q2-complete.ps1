# Z3-Q2 完整运行脚本
# 问题：精神分析如何处理精神病性结构？有哪些临床策略？
# API Key: sk-df0ae9e78ee14baaa4c1604c447ee835

# 设置 API Key 和环境变量
$env:LLM_API_KEY='sk-df0ae9e78ee14baaa4c1604c447ee835'
$env:QUESTIONS_PATH=''
$env:QUESTION_IDS='Z3-Q2'

$node = "C:\Program Files\nodejs\node.exe"
$workDir = "C:\Users\Administrator\Desktop\chenggong-jiachi-master"

Set-Location $workDir

Write-Host "========================================" -ForegroundColor Magenta
Write-Host "Z3-Q2 完整推理流程" -ForegroundColor Magenta
Write-Host "API Key: sk-df0ae9e78ee14baaa4c1604c447ee835" -ForegroundColor Magenta
Write-Host "========================================`n" -ForegroundColor Magenta

# 步骤 1: 召回阶段
Write-Host "===== 步骤 1/4: 召回阶段 (recall-nouns-llm.js) =====" -ForegroundColor Cyan
Write-Host "预计耗时: 15-20秒" -ForegroundColor Gray
$recallStart = Get-Date
& $node recall-nouns-llm.js
$recallEnd = Get-Date
$recallDuration = ($recallEnd - $recallStart).TotalSeconds
Write-Host "✓ 召回完成，耗时: $([math]::Round($recallDuration, 1))秒`n" -ForegroundColor Green

# 步骤 2: 构建 Prompt
Write-Host "===== 步骤 2/4: 构建 Prompt (build-prompt-with-traceback.js) =====" -ForegroundColor Cyan
$buildStart = Get-Date
& $node build-prompt-with-traceback.js
$buildEnd = Get-Date
$buildDuration = ($buildEnd - $buildStart).TotalSeconds
Write-Host "✓ Prompt 构建完成，耗时: $([math]::Round($buildDuration, 1))秒`n" -ForegroundColor Green

# 步骤 3: 生成多路径 Prompt
Write-Host "===== 步骤 3/4: 生成多路径 Prompt (generate-multipath-prompt.js) =====" -ForegroundColor Cyan
$genStart = Get-Date
& $node generate-multipath-prompt.js Z3-Q2
$genEnd = Get-Date
$genDuration = ($genEnd - $genStart).TotalSeconds
Write-Host "✓ 多路径 Prompt 生成完成，耗时: $([math]::Round($genDuration, 1))秒`n" -ForegroundColor Green

# 步骤 4: 推理生成
Write-Host "===== 步骤 4/4: 推理生成 (run-reasoning.js) =====" -ForegroundColor Cyan
Write-Host "预计耗时: 8-12秒" -ForegroundColor Gray
$reasonStart = Get-Date
& $node run-reasoning.js Z3-Q2
$reasonEnd = Get-Date
$reasonDuration = ($reasonEnd - $reasonStart).TotalSeconds
Write-Host "✓ 推理完成，耗时: $([math]::Round($reasonDuration, 1))秒`n" -ForegroundColor Green

# 总结
$totalDuration = ($reasonEnd - $recallStart).TotalSeconds
Write-Host "========================================" -ForegroundColor Magenta
Write-Host "✅ 全流程完成！" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Magenta
Write-Host "总耗时: $([math]::Round($totalDuration, 1))秒" -ForegroundColor Yellow
Write-Host "`n输出文件:" -ForegroundColor Cyan
Write-Host "  • noun-recall-results.json" -ForegroundColor White
Write-Host "  • candidate-texts-for-llm.json" -ForegroundColor White
Write-Host "  • material-traceback-map.json" -ForegroundColor White
Write-Host "  • multipath-prompt-Z3-Q2.txt" -ForegroundColor White
Write-Host "  • reasoning-output-Z3-Q2.json (最终结果)" -ForegroundColor Yellow
Write-Host "`n查看结果:" -ForegroundColor Cyan
Write-Host "  Get-Content reasoning-output-Z3-Q2.json | ConvertFrom-Json | Select-Object -ExpandProperty answer" -ForegroundColor Gray
