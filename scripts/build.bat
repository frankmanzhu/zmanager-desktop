@echo off
setlocal enabledelayedexpansion

:: Get the root directory of the repository (parent of the scripts folder)
set "REPO_ROOT=%~dp0.."
:: Resolve REPO_ROOT to absolute path
for %%I in ("%REPO_ROOT%") do set "REPO_ROOT=%%~fI"

:: Find an available drive letter
set "SUBST_DRIVE="
for %%L in (Z Y X W V U T S R Q P O N M L K J I H G F E D) do (
    subst %%L: >nul 2>&1
    if errorlevel 1 (
        :: Drive is not used by subst, let's check if it exists at all
        if not exist %%L:\ (
            set "SUBST_DRIVE=%%L:"
            goto :found_drive
        )
    )
)

echo Warning: No available drive letters found for subst. Running build in-place (may fail due to Windows MAX_PATH limit)...
goto :run_inplace

:found_drive
echo Mapping virtual drive %SUBST_DRIVE% to bypass Windows path limit...
subst %SUBST_DRIVE% "%REPO_ROOT%"
if %ERRORLEVEL% neq 0 (
    echo Warning: subst failed. Running build in-place...
    goto :run_inplace
)

:: Switch to the virtual drive
cd /d %SUBST_DRIVE%
echo Switched to drive %SUBST_DRIVE%

:run_inplace
echo [1/3] Installing frontend dependencies...
call npm install
if %ERRORLEVEL% neq 0 (
    echo Error: npm install failed.
    goto :cleanup
)

echo [2/3] Generating native contracts...
call npm run generate:contracts
if %ERRORLEVEL% neq 0 (
    echo Error: Failed to generate native contracts.
    goto :cleanup
)

echo [3/3] Running static Windows build and installation...
powershell -ExecutionPolicy Bypass -File "%CD%\scripts\build-windows-static.ps1" -Install
if %ERRORLEVEL% neq 0 (
    echo Error: Build or installation failed.
    goto :cleanup
)

echo Build and installation completed successfully.
set "BUILD_STATUS=0"
goto :final_cleanup

:cleanup
set "BUILD_STATUS=1"

:final_cleanup
if defined SUBST_DRIVE (
    echo Unmapping virtual drive %SUBST_DRIVE%...
    cd /d "%REPO_ROOT%"
    subst %SUBST_DRIVE% /D >nul 2>&1
)
exit /b %BUILD_STATUS%
