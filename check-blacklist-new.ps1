$json = Get-Content 'C:\Users\Administrator\Desktop\2026-09-21-master\主流程数据集-2026-09-22\final-noun-index.json' -Raw | ConvertFrom-Json
$surfaces = $json.nouns | ForEach-Object { $_.surface }
Write-Host "Total surfaces:" $surfaces.Count

$blacklistRaw = Get-Content 'C:\Users\Administrator\Desktop\2026-09-21-master\noun-blacklist.json' -Raw | ConvertFrom-Json
$bl = $blacklistRaw.blacklist
Write-Host "Manual blacklist size:" $bl.Count

$hits = @()
foreach ($s in $surfaces) {
    if ($bl -contains $s) {
        $hits += $s
    }
}
Write-Host "Exact manual-blacklist hits in new dataset:" $hits.Count
foreach ($h in $hits) {
    Write-Host " - $h"
}

# 模式匹配：句首逗号/破折号碎片
$leadingPunct = $surfaces | Where-Object { $_ -match '^[,\-;]' }
Write-Host ""
Write-Host "Leading punctuation fragments:" $leadingPunct.Count
$leadingPunct | Select-Object -First 10 | ForEach-Object { Write-Host " - $_" }

# 模式匹配：星号/井号 markdown 残留
$markdownArtifact = $surfaces | Where-Object { $_ -match '[\*#]' }
Write-Host ""
Write-Host "Markdown artifact (*, #):" $markdownArtifact.Count
$markdownArtifact | Select-Object -First 10 | ForEach-Object { Write-Host " - $_" }

# 模式匹配：CJK 混入
$cjkMixed = $surfaces | Where-Object { $_ -match '[\u4e00-\u9fff]' }
Write-Host ""
Write-Host "CJK mixed:" $cjkMixed.Count
$cjkMixed | Select-Object -First 10 | ForEach-Object { Write-Host " - $_" }
