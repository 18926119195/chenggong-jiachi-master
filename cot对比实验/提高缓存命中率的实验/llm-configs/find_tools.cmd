@echo off
where uv 2>nul
where uvx 2>nul
where py 2>nul
where pip 2>nul
where pip3 2>nul
where conda 2>nul
where node 2>nul
dir "%USERPROFILE%\.local\bin" 2>nul
echo --
echo done
