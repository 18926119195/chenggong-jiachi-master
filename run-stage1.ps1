Set-Location "C:\Users\Administrator\Desktop\2026-09-21-master"
$env:S0_HITS_PATH = "C:\Users\Administrator\Desktop\2026-09-21-master\主流程数据集-2026-09-22\s0-hits.json"
$env:REPORT_PATH = "C:\Users\Administrator\Desktop\2026-09-21-master\主流程数据集-2026-09-22\s0-quality-report.json"
node validate-s0-quality.js "C:\Users\Administrator\Desktop\docuverse_cartographies_squizoanalythiques_Fe_lix_Guattari_1789114122714.docuverse.json"
