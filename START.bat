@echo off
setlocal
cd /d "%~dp0"

where docker >nul 2>nul
if errorlevel 1 (
  echo Docker was not found. Install and start Docker Desktop first.
  pause
  exit /b 1
)

if not exist .env copy .env.example .env >nul
docker compose up --build -d
if errorlevel 1 (
  echo Startup failed. Run: docker compose logs
  pause
  exit /b 1
)

echo Kroky is starting at http://localhost:3000
start "" http://localhost:3000
endlocal

