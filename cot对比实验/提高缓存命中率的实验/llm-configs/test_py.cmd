@echo off
set PYTHONEXE=C:\Users\Administrator\AppData\Local\Microsoft\WindowsApps\python.exe
"%PYTHONEXE%" -c "print('HELLO FROM PYTHON'); import sys; sys.stdout.flush()"
echo Done. ERRORLEVEL=%ERRORLEVEL%
