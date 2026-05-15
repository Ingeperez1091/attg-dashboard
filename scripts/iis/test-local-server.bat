@REM Local Build & Test Script for IIS Deployment (Windows Batch)
@REM Runs Node.js server locally to verify it works before IIS deployment
@REM Usage: .\scripts\iis\test-local-server.bat

@echo off
setlocal enabledelayedexpansion

color 0A
title Local Server Test for IIS Deployment

echo.
echo ========================================
echo Local Server Test for IIS Deployment
echo ========================================
echo.

REM Check if Node.js is installed
echo [1/5] Checking Node.js installation...
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    color 0C
    echo ERROR: Node.js is not installed
    color 0A
    exit /b 1
)
for /f "tokens=*" %%i in ('node --version') do set NODE_VERSION=%%i
echo [OK] Node.js %NODE_VERSION% found
echo.

REM Get the script directory
set SCRIPT_DIR=%~dp0
set SCRIPT_DIR=%SCRIPT_DIR:~0,-1%
for %%I in ("%SCRIPT_DIR%\..\..") do set REPO_ROOT=%%~fI
set FRONTEND_DIR=%REPO_ROOT%\src\frontend

REM Check if frontend directory exists
if not exist "%FRONTEND_DIR%" (
    color 0C
    echo ERROR: Frontend directory not found at %FRONTEND_DIR%
    color 0A
    exit /b 1
)

REM Check if .next/standalone exists
echo [2/5] Checking for build output...
if not exist "%FRONTEND_DIR%\.next\standalone" (
    color 0E
    echo WARNING: Build output not found. Running build...
    color 0A
    cd /d "%FRONTEND_DIR%"
    call npm ci
    call npm run build
    cd /d "%SCRIPT_DIR%"
)
echo [OK] Build output found at %FRONTEND_DIR%\.next\standalone
echo.

REM Check environment variables
echo [3/5] Checking environment variables...
setlocal
set MISSING_VARS=0

if "!AUTH_URL!"=="" (
    set MISSING_VARS=1
    echo [WARN] Missing: AUTH_URL
)
if "!AUTH_SECRET!"=="" (
    set MISSING_VARS=1
    echo [WARN] Missing: AUTH_SECRET
)
if "!AUTH_MICROSOFT_ENTRA_ID_ID!"=="" (
    set MISSING_VARS=1
    echo [WARN] Missing: AUTH_MICROSOFT_ENTRA_ID_ID
)
if "!AUTH_MICROSOFT_ENTRA_ID_SECRET!"=="" (
    set MISSING_VARS=1
    echo [WARN] Missing: AUTH_MICROSOFT_ENTRA_ID_SECRET
)
if "!AUTH_MICROSOFT_ENTRA_ID_TENANT_ID!"=="" (
    set MISSING_VARS=1
    echo [WARN] Missing: AUTH_MICROSOFT_ENTRA_ID_TENANT_ID
)

if !MISSING_VARS! EQU 1 (
    echo.
    echo Required environment variables to set:
    echo   AUTH_URL (e.g., https://localhost/auth)
    echo   AUTH_SECRET (generate with: openssl rand -base64 32 ^| pwsh -c 'Add-Content $_')
    echo   AUTH_MICROSOFT_ENTRA_ID_ID
    echo   AUTH_MICROSOFT_ENTRA_ID_SECRET
    echo   AUTH_MICROSOFT_ENTRA_ID_TENANT_ID
    echo.
    set /p CONTINUE="Continue without env vars? (y/n): "
    if /i not "!CONTINUE!"=="y" exit /b 1
) else (
    echo [OK] All environment variables are set
)
echo.

REM Verify Node dependencies
echo [4/5] Checking Node dependencies...
cd /d "%FRONTEND_DIR%\.next\standalone\src\frontend"
if not exist "node_modules" (
    color 0E
    echo WARNING: Installing dependencies...
    color 0A
    cd /d "%FRONTEND_DIR%\.next\standalone"
    call npm ci --production
    cd /d "%FRONTEND_DIR%\.next\standalone\src\frontend"
)
echo [OK] Dependencies ready
echo.

REM Start the server
echo [5/5] Starting Node.js server...
echo.
if exist "server.js" (
    copy /Y "server.js" "server.cjs" >nul
)
color 0B
echo Server is starting on http://localhost:3000
echo Press Ctrl+C to stop
color 0A
echo.
echo ========== Server Output ==========
echo.

set NODE_ENV=production
node server.cjs

REM Handle Ctrl+C gracefully
echo.
color 0A
echo Server stopped.
pause
