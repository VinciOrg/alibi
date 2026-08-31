@echo off
cd /d "%~dp0"
where python >nul 2>nul
if %errorlevel%==0 (
  start "" http://127.0.0.1:8765
  python -m http.server 8765
) else (
  start "" index.html
)
