@echo off
dir C:\Python* 2>nul
dir "C:\Program Files\Python*" 2>nul
dir "C:\Users\Administrator\AppData\Local\Programs\Python*" 2>nul
dir "C:\ProgramData\Anaconda*" 2>nul
dir "C:\Anaconda*" 2>nul
where pip 2>nul
where py 2>nul
