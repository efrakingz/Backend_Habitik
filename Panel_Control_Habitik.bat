@echo off
title Habitik - Panel de Control del Servidor Local
color 0A
cls

echo ========================================================
echo   HABITIK - INICIANDO PANEL DE CONTROL PRO
echo ========================================================
echo.

:: Detectar ruta del proyecto de forma universal
if exist "%~dp0scripts\control_gui.js" (
    cd /d "%~dp0"
    goto :found
)

if exist "%~dp0backend\scripts\control_gui.js" (
    cd /d "%~dp0backend"
    goto :found
)

if exist "%~dp0..\backend\scripts\control_gui.js" (
    cd /d "%~dp0..\backend"
    goto :found
)

if exist "c:\Users\efrak\OneDrive\Documentos\Proyectos\proyecto Habitik\backend\scripts\control_gui.js" (
    cd /d "c:\Users\efrak\OneDrive\Documentos\Proyectos\proyecto Habitik\backend"
    goto :found
)

echo [ERROR] No se encontro la carpeta del backend de Habitik.
echo Por favor ejecuta este archivo desde la carpeta del proyecto.
pause
exit /b 1

:found
echo [1/2] Conectado a: %CD%
echo [2/2] Abriendo panel interactivo en el navegador...
start "" "http://localhost:3333"

echo.
echo ========================================================
echo   Panel activo en: http://localhost:3333
echo   Manten esta ventana abierta mientras uses el panel.
echo ========================================================
echo.

node scripts/control_gui.js
pause
