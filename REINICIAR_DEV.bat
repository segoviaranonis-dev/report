@echo off
cd /d "%~dp0"
title Report dev - Aprobaciones Nivel Dios
echo.
echo === REPORT - Reinicio dev (Aprobaciones) ===
echo Acceso: rol_id=1 + categoria=DIOS en usuario_v2
echo.
echo [1/4] Liberando puertos 3000 y 3001...
echo       NOTA: si Tablet Bazzar usa :3000, volvera a ocuparlo al reiniciar tablet.
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":3000" ^| findstr LISTENING') do taskkill /F /PID %%a 2>nul
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":3001" ^| findstr LISTENING') do taskkill /F /PID %%a 2>nul
timeout /t 2 /nobreak >nul
echo [2/4] Borrando .next y node_modules\.cache...
if exist .next rmdir /s /q .next
if exist node_modules\.cache rmdir /s /q node_modules\.cache
echo [3/4] Regla: NO corras "npm run build" con el dev abierto.
echo [4/4] Iniciando next dev (3001 si Tablet ocupa 3000)...
echo.
echo URL Report (Tablet en 3000): http://localhost:3001
echo URL Report canonica:         http://localhost:3000
echo Motor precios: http://localhost:3001/proceso-importacion/motor-precios
echo.
npm run dev:clean:3001
if errorlevel 1 (
  echo.
  echo ERROR: npm run dev fallo. Revisa .env.local y node_modules.
  pause
)
