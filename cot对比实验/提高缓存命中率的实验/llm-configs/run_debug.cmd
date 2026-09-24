@echo off
set PY=C:\Users\Administrator\AppData\Local\Microsoft\WindowsApps\python.exe
cd /d "C:\Users\Administrator\Desktop\chenggong-jiachi-master\cot对比实验\提高缓存命中率的实验\llm-configs"
"%PY%" debug_l24.py
echo Exit code: %ERRORLEVEL%
