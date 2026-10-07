@echo off
REM ============================================================================
REM Allin1 - Bootstrap para Windows (GNU Make)
REM ============================================================================
where make >nul 2>&1
if errorlevel 1 (
    echo [INFO] GNU Make no detectado. Instalando ezwinports.make via winget...
    winget install --id ezwinports.make -e --silent --accept-package-agreements --accept-source-agreements
    where make >nul 2>&1
    if errorlevel 1 (
        echo.
        echo [IMPORTANTE] GNU Make se acaba de instalar.
        echo Cierra y vuelve a abrir esta terminal para actualizar el PATH.
        echo Luego ejecuta: make install-deps
        echo.
        pause
        exit /b 0
    )
)

echo [INFO] Ejecutando make install-deps...
make install-deps
pause
