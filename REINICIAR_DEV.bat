@echo off
cd /d "%~dp0"
title Report dev - Aprobaciones Nivel Dios
echo.
echo === REPORT - Reinicio dev (Aprobaciones) ===
echo Acceso: rol_id=1 + categoria=DIOS en usuario_v2
echo.
echo [1/4] Liberando puertos 3000 y 3001...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":3000" ^| findstr LISTENING') do taskkill /F /PID %%a 2>nul
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":3001" ^| findstr LISTENING') do taskkill /F /PID %%a 2>nul
timeout /t 2 /nobreak >nul
echo [2/4] Borrando .next si existe...
if exist .next (
  rmdir /s /q .next
)
echo [3/4] Regla: NO corras "npm run build" con el dev abierto.
echo [4/4] Iniciando next dev...
echo.
echo URL: http://localhost:3000/aprobaciones
echo (si 3000 ocupado: http://localhost:3001/aprobaciones)
echo.
npm run dev
if errorlevel 1 (
  echo.
  echo ERROR: npm run dev fallo. Revisa .env.local y node_modules.
  pause
)
