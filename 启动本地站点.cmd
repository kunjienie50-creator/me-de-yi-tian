@echo off
setlocal
cd /d "%~dp0"
set "LOCAL_SITE_NODE=node.exe"
if exist "%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe" set "LOCAL_SITE_NODE=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
if not exist "%~dp0node_modules\vite\bin\vite.js" (
  echo Project dependencies are missing. Install them before starting.
  pause
  exit /b 1
)
echo Local site: http://localhost:5173/
echo Keep this window open while using the site. Press Ctrl+C to stop.
"%LOCAL_SITE_NODE%" "%~dp0node_modules\vite\bin\vite.js" --host 127.0.0.1 --port 5173 --strictPort
if errorlevel 1 pause
