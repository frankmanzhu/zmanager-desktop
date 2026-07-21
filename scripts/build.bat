@echo off
setlocal enabledelayedexpansion

:: Get the root directory of the repository (parent of the scripts folder)
set "REPO_ROOT=%~dp0.."
for %%I in ("%REPO_ROOT%") do set "REPO_ROOT=%%~fI"

:: Use a short target directory to avoid Windows MAX_PATH (260 chars).
:: Build artifacts under src-tauri\target\ can reach 240+ chars with the
:: default layout; a single-level directory under the user profile saves
:: ~20 chars and decouples from the clone location.
if not defined CARGO_TARGET_DIR (
    set "CARGO_TARGET_DIR=%USERPROFILE%\.zmbuild"
)
if not exist "%CARGO_TARGET_DIR%" mkdir "%CARGO_TARGET_DIR%"
echo Cargo target directory: %CARGO_TARGET_DIR%

echo [1/4] Ensuring sibling repositories (tzap, zmanager)...
powershell -ExecutionPolicy Bypass -File "%REPO_ROOT%\scripts\ensure-sibling-repos.ps1"
if %ERRORLEVEL% neq 0 (
    echo Error: Failed to ensure sibling repositories.
    exit /b 1
)

echo [2/4] Installing frontend dependencies...
call npm install
if %ERRORLEVEL% neq 0 (
    echo Error: npm install failed.
    exit /b 1
)

echo [3/4] Generating native contracts...
call npm run generate:contracts
if %ERRORLEVEL% neq 0 (
    echo Error: Failed to generate native contracts.
    exit /b 1
)

echo [4/4] Running static Windows build and installation...
powershell -ExecutionPolicy Bypass -File "%REPO_ROOT%\scripts\build-windows-static.ps1" -Install
if %ERRORLEVEL% neq 0 (
    echo Error: Build or installation failed.
    exit /b 1
)

echo Build and installation completed successfully.
exit /b 0
