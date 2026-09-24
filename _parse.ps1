$ErrorActionPreference = 'Stop'
$path = 'C:\Users\Administrator\Desktop\zhongjiban-ultimate-master\cot对比实验\src-cot\cot推理llm的过程记录'
$lines = Get-Content -LiteralPath $path -Encoding UTF8
Write-Output ("TOTAL_LINES=" + $lines.Count)
for ($i = 0; $i -lt $lines.Count; $i++) {
    if ($lines[$i] -like '问题：*') {
        Write-Output (($i + 1).ToString() + " >>> " + $lines[$i])
    }
}
