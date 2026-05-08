@echo off
REM ============================================================================
REM git-push.bat -- safe push helper for the Dolphlink-MainPage repo.
REM
REM Flow:
REM   1. git fetch origin (no merge yet)
REM   2. Show what is on remote that you don't have locally
REM   3. Ask: rebase + push, force-with-lease push, or cancel
REM
REM Usage: double-click, OR run from any terminal at the project root.
REM Pauses on every exit so a double-click run never silently disappears.
REM ============================================================================

setlocal enabledelayedexpansion
cd /d "%~dp0"

echo.
echo ============================================================
echo  DOLPHLINK GIT PUSH HELPER
echo ============================================================
echo.

REM ---------- Sanity: are we in a git repo? ----------
git rev-parse --is-inside-work-tree >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
  echo [ERROR] Not a git repository.
  echo Run this batch from the project root ^(E:\baidu\dolphlink^).
  goto :end
)

REM ---------- Show current branch + status summary ----------
for /f "delims=" %%B in ('git rev-parse --abbrev-ref HEAD') do set "BRANCH=%%B"
echo Current branch: %BRANCH%
echo.

git status --short
if %ERRORLEVEL% NEQ 0 goto :end

REM ---------- Stage 1: fetch (read-only, never modifies working tree) ----------
echo.
echo [1/3] Fetching latest from origin...
git fetch origin
if %ERRORLEVEL% NEQ 0 (
  echo.
  echo [ERROR] git fetch failed. Check your network / credentials.
  goto :end
)

REM ---------- Stage 2: how far ahead/behind are we? ----------
echo.
echo [2/3] Comparing local %BRANCH% vs origin/%BRANCH%:
echo.

set "AHEAD=0"
set "BEHIND=0"
for /f %%A in ('git rev-list --count origin/%BRANCH%..%BRANCH% 2^>nul') do set "AHEAD=%%A"
for /f %%B in ('git rev-list --count %BRANCH%..origin/%BRANCH% 2^>nul') do set "BEHIND=%%B"

echo   Ahead   ^(your local commits not on remote^)  : %AHEAD%
echo   Behind  ^(remote commits not in your local^) : %BEHIND%
echo.

if "%BEHIND%"=="0" (
  if "%AHEAD%"=="0" (
    echo [info] Nothing to push. Local is in sync with remote.
    goto :end
  )
  echo Remote has no new commits. A plain push will work.
  echo.
  set /p OK="Push %AHEAD% commit(s) to origin/%BRANCH%? [y/N] "
  if /i "!OK!"=="y" (
    git push origin %BRANCH%
    if !ERRORLEVEL!==0 ( echo. & echo [done] Pushed cleanly. ) else ( echo. & echo [ERROR] Push failed. )
  ) else (
    echo [skip] Cancelled.
  )
  goto :end
)

REM ---------- Stage 3: divergence — show remote commits + ask user ----------
echo Remote commits you don't have locally:
echo ------------------------------------------------------------
git log %BRANCH%..origin/%BRANCH% --oneline --decorate --color=never
echo ------------------------------------------------------------
echo.
echo Choose how to integrate:
echo.
echo   [R] Rebase + push   ^(safe — replay your %AHEAD% commit^(s^) on top of remote, then push^)
echo   [F] Force-with-lease push   ^(DANGEROUS — overwrite remote, kills the %BEHIND% commit^(s^) above^)
echo   [C] Cancel
echo.
set /p CHOICE="Your choice [R/F/C]: "

if /i "%CHOICE%"=="R" goto :do_rebase
if /i "%CHOICE%"=="F" goto :do_force
if /i "%CHOICE%"=="C" ( echo [skip] Cancelled. & goto :end )
echo [error] Invalid choice. Cancelled.
goto :end

:do_rebase
echo.
echo [3/3] Rebasing onto origin/%BRANCH%...
git pull --rebase origin %BRANCH%
if %ERRORLEVEL% NEQ 0 (
  echo.
  echo [ERROR] Rebase hit a conflict. Resolve in your editor, then run:
  echo    git add ^<files^>
  echo    git rebase --continue
  echo    git push origin %BRANCH%
  echo or to abort:    git rebase --abort
  goto :end
)
echo.
echo Rebase clean. Pushing...
git push origin %BRANCH%
if %ERRORLEVEL%==0 ( echo. & echo [done] Rebased + pushed. ) else ( echo. & echo [ERROR] Push failed after rebase. )
goto :end

:do_force
echo.
echo [WARN] Force-with-lease will REPLACE remote %BRANCH% with your local %BRANCH%.
echo        The %BEHIND% commit^(s^) shown above will disappear from origin/%BRANCH%.
echo        Anyone else who pulled them will need to reset.
echo.
set /p CONFIRM="Type FORCE to confirm: "
if /i not "%CONFIRM%"=="FORCE" ( echo [skip] Cancelled. & goto :end )

echo.
echo [3/3] Pushing with --force-with-lease...
git push --force-with-lease origin %BRANCH%
if %ERRORLEVEL%==0 ( echo. & echo [done] Force-pushed. ) else ( echo. & echo [ERROR] Push failed. )
goto :end

:end
echo.
echo ============================================================================
pause
endlocal
