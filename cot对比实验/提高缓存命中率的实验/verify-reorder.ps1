# 纯字节级校验 - 完全基于原始字节，不做字符串解释
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8
$utf8 = [System.Text.Encoding]::UTF8

$SRC = 'C:\Users\Administrator\Desktop\chenggong-jiachi-master\cot对比实验'
$OUT_DIR = 'C:\Users\Administrator\Desktop\chenggong-jiachi-master\cot对比实验\提高缓存命中率的实验'

# marker 字节序列 (UTF-8):  【【全量材料】】
#  【 = E3 80 90 (0x3010)
#  】 = E3 80 91 (0x3011)
#  全 = E5 85 A8 (0x5168)
#  量 = E9 87 8F (0x91CF)
#  材 = E6 9D 90 (0x6750)
#  料 = E6 96 99 (0x6599)
$MARKER_BYTES = [byte[]](
  0xE3,0x80,0x90,    # 【
  0xE3,0x80,0x90,    # 【
  0xE5,0x85,0xA8,    # 全
  0xE9,0x87,0x8F,    # 量
  0xE6,0x9D,0x90,    # 材
  0xE6,0x96,0x99,    # 料
  0xE3,0x80,0x91,    # 】
  0xE3,0x80,0x91     # 】
)

function Find-BytesInBytes([byte[]]$haystack, [byte[]]$needle) {
  for ($i = 0; $i -le $haystack.Length - $needle.Length; $i++) {
    $match = $true
    for ($j = 0; $j -lt $needle.Length; $j++) {
      if ($haystack[$i + $j] -ne $needle[$j]) { $match = $false; break }
    }
    if ($match) { return $i }
  }
  return -1
}

function Compare-ByteRanges([byte[]]$a, [byte[]]$b) {
  if ($a.Length -ne $b.Length) { return $false }
  for ($i = 0; $i -lt $a.Length; $i++) {
    if ($a[$i] -ne $b[$i]) { return $false }
  }
  return $true
}

function Copy-ByteRange([byte[]]$src, [int]$start, [int]$len) {
  $dst = New-Object 'byte[]' $len
  [Array]::Copy($src, $start, $dst, 0, $len)
  return $dst
}

$qids = @('Z1-Q1','Z1-Q2','Z1-Q3','Z1-Q4','Z2-Q1','Z2-Q2','Z2-Q3','Z2-Q4','Z3-Q1','Z3-Q2','Z3-Q3','Z4-Q1','Z4-Q2','Z4-Q3','Z4-Q4')

$log = New-Object System.Collections.Generic.List[string]
$totalSrc = 0
$totalOut = 0
$allOk = $true

$log.Add('==== CoT 对比实验：缓存命中率优化版（chunks 前置）字节校验 ====')
$log.Add("SRC: $SRC")
$log.Add("OUT: $OUT_DIR")
$log.Add('')

foreach ($qid in $qids) {
  $srcPath = "$SRC\multipath-prompt-cot-$qid.txt"
  $outPath = "$OUT_DIR\multipath-prompt-cot-$qid.txt"

  if (-not (Test-Path -LiteralPath $srcPath)) { $log.Add("[FAIL] $qid source missing"); $allOk = $false; continue }
  if (-not (Test-Path -LiteralPath $outPath)) { $log.Add("[FAIL] $qid output missing"); $allOk = $false; continue }

  $srcBytes = [System.IO.File]::ReadAllBytes($srcPath)
  $outBytes = [System.IO.File]::ReadAllBytes($outPath)
  $totalSrc += $srcBytes.Length
  $totalOut += $outBytes.Length

  $srcIdx = Find-BytesInBytes $srcBytes $MARKER_BYTES
  $outIdx = Find-BytesInBytes $outBytes $MARKER_BYTES

  if ($srcIdx -lt 0) { $log.Add("[FAIL] $qid marker not in source"); $allOk = $false; continue }
  if ($outIdx -lt 0) { $log.Add("[FAIL] $qid marker not in output"); $allOk = $false; continue }

  $headerLen = $srcIdx

  $srcHeader = Copy-ByteRange $srcBytes 0 $headerLen
  $srcChunks = Copy-ByteRange $srcBytes $headerLen ($srcBytes.Length - $headerLen)

  $outHeader = Copy-ByteRange $outBytes ($outBytes.Length - $headerLen) $headerLen
  $outChunks = Copy-ByteRange $outBytes 0 ($outBytes.Length - $headerLen)

  $headerOk = Compare-ByteRanges $srcHeader $outHeader
  $chunksOk = Compare-ByteRanges $srcChunks $outChunks
  $bytesOk = $srcBytes.Length -eq $outBytes.Length

  $status = if ($headerOk -and $chunksOk -and $bytesOk) { 'OK  ' } else { 'FAIL' }
  if (-not ($headerOk -and $chunksOk -and $bytesOk)) { $allOk = $false }
  $hStr = if ($headerOk) { 'OK' } else { 'FAIL' }
  $cStr = if ($chunksOk) { 'OK' } else { 'FAIL' }
  $line = "[$status] $qid : src=$($srcBytes.Length)B out=$($outBytes.Length)B split@$srcIdx out-split@$outIdx header-tail=$hStr chunks-head=$cStr"
  Write-Host $line
  $log.Add($line)
}

$log.Add('')
$log.Add("TOTAL src=$totalSrc bytes  out=$totalOut bytes  diff=$($totalOut - $totalSrc)")
$log.Add('')
$log.Add("ALL FILES PASS: $(if($allOk){'YES'}else{'NO'})")

$logPath = "$OUT_DIR\_reorder_result.txt"
[System.IO.File]::WriteAllText($logPath, ($log -join "`r`n") + "`r`n", (New-Object System.Text.UTF8Encoding $false))
Write-Host ""
Write-Host "Log saved: $logPath"
