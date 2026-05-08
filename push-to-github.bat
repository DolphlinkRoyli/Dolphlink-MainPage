@echo off
cd /d "%~dp0"

echo.
echo ====================================================
echo  DOLPHLINK push to GitHub
echo ====================================================
echo  Folder: %CD%
echo.

REM ---- Check git is installed ------------------------------------------------
git --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] git is not installed.
    echo         Get it: https://git-scm.com/download/win
    pause
    exit /b 1
)

REM ---- First-time setup if .git is missing ----------------------------------
if not exist ".git\HEAD" (
    echo .git folder is missing — running first-time setup...
    echo.
    echo [1/5] git init
    git init
    echo.
    echo [2/5] git branch -M main
    git branch -M main
    echo.
    echo [3/5] adding remote: https://github.com/dolphlinkroyli/Dolphlink-MainPage.git
    git remote add origin https://github.com/dolphlinkroyli/Dolphlink-MainPage.git
    echo.
    echo [4/5] fetching remote main branch...
    git fetch origin main
    if errorlevel 1 (
        echo [ERROR] Could not fetch from GitHub. Check internet / authentication.
        pause
        exit /b 1
    )
    echo.
    echo [5/5] aligning local main with remote main (working tree untouched)...
    git update-ref refs/heads/main FETCH_HEAD
    git symbolic-ref HEAD refs/heads/main
    git branch --set-upstream-to=origin/main main 2>nul
    echo.
    echo Setup complete. Your local files will now appear as "modified" against
    echo the remote tree — that's normal. Continuing to commit + push.
    echo.
)

REM ---- Show pending changes -------------------------------------------------
echo --- Pending changes ---
git status --short
echo.

REM ---- Get commit message ---------------------------------------------------
set "MSG=%~1"
if "%MSG%"=="" set /p MSG=Commit message (Enter for "Update site"):
if "%MSG%"=="" set "MSG=Update site"

REM ---- Add / commit / push --------------------------------------------------
echo.
echo Running: git add -A
git add -A

echo Running: git commit -m "%MSG%"
git commit -m "%MSG%"

echo Running: git push origin main
git push origin main

echo.
echo ====================================================
echo  Finished. Check messages above for any errors.
echo  Site URL: https://dolphlinkroyli.github.io/Dolphlink-MainPage/
echo ====================================================
pause
