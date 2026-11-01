@echo off
title Habitik - Panel de Control del Servidor Local
color 0A
cls

echo ========================================================
echo   HABITIK - INICIANDO PANEL DE CONTROL VISUAL
echo ========================================================
echo.
echo [1/2] Levantando servicio de control en http://localhost:3333...
cd /d "%~dp0"
if exist "backend" cd backend

start "" "http://localhost:3333"

echo [2/2] Abriendo navegador con el panel de control interactivo...
echo.
echo ========================================================
echo   Panel activo. Manten esta ventana abierta mientras
echo   quieras usar el panel o encender/apagar servicios.
echo   Para cerrar el panel, presiona Ctrl+C o cierra la ventana.
echo ========================================================
echo.

node scripts/control_gui.js
pause
