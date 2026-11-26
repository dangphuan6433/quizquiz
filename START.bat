@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Please install Node.js from https://nodejs.org/ first.
  pause
  exit /b 1
)
start "QuickQuiz Server" cmd /k node server.js
timeout /t 2 /nobreak >nul
start "" http://localhost:3000
