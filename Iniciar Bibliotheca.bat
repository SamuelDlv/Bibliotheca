@echo off
title Bibliotheca — Inicializando...
color 0F

echo.
echo  ============================================
echo   BIBLIOTHECA v3 — Iniciando todos os servicos
echo  ============================================
echo.

:: ── Verificar .env do backend principal ─────────────────────
if not exist "%~dp0backend\.env" (
    echo [ERRO] backend\.env nao encontrado.
    echo Copie config\.env.example para backend\.env e configure.
    echo.
    pause
    exit /b 1
)

:: ── Verificar .env do backend da wishlist ───────────────────
if not exist "%~dp0wishlist\backend\.env" (
    echo [ERRO] wishlist\backend\.env nao encontrado.
    echo Copie wishlist\backend\.env.example para wishlist\backend\.env e configure.
    echo.
    pause
    exit /b 1
)

:: ── Instalar dependencias (silencioso) ──────────────────────
echo [1/3] Verificando dependencias do backend principal...
pip install -r "%~dp0backend\requirements.txt" --quiet --disable-pip-version-check

echo [2/3] Verificando dependencias do backend wishlist...
pip install -r "%~dp0wishlist\backend\requirements.txt" --quiet --disable-pip-version-check

echo [3/3] Subindo servidores...
echo.

:: ── Iniciar backend principal (porta 5000) em nova janela ───
start "Bibliotheca Backend [porta 5000]" cmd /k "title Bibliotheca Backend [5000] && cd /d "%~dp0backend" && for /f "usebackq tokens=1,* delims==" %%A in (".env") do if not "%%A"=="" set "%%A=%%B" && python app.py"

:: Aguardar 3s para o primeiro subir antes do segundo
timeout /t 3 /nobreak >nul

:: ── Iniciar backend wishlist (porta 5001) em nova janela ────
start "Bibliotheca Wishlist Backend [porta 5001]" cmd /k "title Bibliotheca Wishlist [5001] && cd /d "%~dp0wishlist\backend" && for /f "usebackq tokens=1,* delims==" %%A in (".env") do if not "%%A"=="" set "%%A=%%B" && python app.py"

:: Aguardar 3s para ambos estarem prontos antes de abrir o browser
timeout /t 3 /nobreak >nul

:: ── Abrir frontend no navegador padrão ──────────────────────
echo.
echo  Servidores rodando:
echo    Principal  → http://localhost:5000
echo    Wishlist   → http://localhost:5001
echo.
echo  Abrindo Bibliotheca no navegador...
echo.
start "" "%~dp0frontend\index.html"

echo  Para encerrar, feche as janelas dos dois backends.
echo.
pause
