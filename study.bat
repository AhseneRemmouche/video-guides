@echo off
rem Launches the local study server and opens the 30-day plan in your browser.
cd /d "%~dp0"
python serve-study.py
if errorlevel 1 (
  echo.
  echo Could not run "python". Trying the Windows launcher "py" instead...
  py serve-study.py
)
echo.
echo Server stopped. You can close this window.
pause
