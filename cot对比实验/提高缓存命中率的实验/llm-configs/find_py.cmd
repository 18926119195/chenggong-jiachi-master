@echo off
where python
echo --------
where python.exe
echo --------
where python3
echo --------
dir "C:\Python*" 2>nul
echo --------
dir "C:\Users\Administrator\AppData\Local\Microsoft\WindowsApps\python*" 2>nul
echo --------
echo PATH:
echo %PATH%
