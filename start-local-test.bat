@echo off
REM ============================================================================
REM DOLPHLINK Local Test Server
REM ----------------------------------------------------------------------------
REM Double-click this file to:
REM   1. Start a local HTTP server on http://localhost:5500
REM   2. Open the homepage in your default browser
REM
REM The card view is now embedded in the main page Request-Briefing modal.
REM Click the "Request Briefing" button -> "Continue with Google" to test cards.
REM
REM Press Ctrl+C in this window (or just close it) to stop the server.
REM ============================================================================

setlocal
cd /d "%~dp0"

set PORT=5500
set OPEN_CMD=cmd /c "ping 127.0.0.1 -n 3 ^>nul ^& start "" http://localhost:%PORT%/"

echo.
echo ============================================================================
echo  DOLPHLINK local test server
echo ============================================================================
echo.
echo  Folder:    %CD%
echo  Homepage:  http://localhost:%PORT%/
echo  Card view: Click "Request Briefing" -^> "Continue with Google"
echo.
echo  Press Ctrl+C or close this window to stop.
echo ============================================================================
echo.

REM ----------------------------------------------------------------------------
REM Detect a real Python or Node install (not the Microsoft Store stub).
REM We test by actually running the binary, because `where python` will return
REM 0 even when only the App Execution Alias is present.
REM ----------------------------------------------------------------------------

REM Try py launcher first (most reliable on modern Windows; not aliased to Store)
py -3 --version >nul 2>&1
if %ERRORLEVEL% equ 0 (
    echo [info] Using py launcher
    start "" /b %OPEN_CMD%
    py -3 -m http.server %PORT%
    goto :end
)

REM Try real python (with version check to bypass the Store alias)
python --version >nul 2>&1
if %ERRORLEVEL% equ 0 (
    REM The Store alias makes `python --version` print "Python was not found..."
    REM but exits 0 in some setups. Test that http.server actually loads.
    python -c "import http.server" >nul 2>&1
    if %ERRORLEVEL% equ 0 (
        echo [info] Using python http.server
        start "" /b %OPEN_CMD%
        python -m http.server %PORT%
        goto :end
    )
)

REM Try Node + npx serve
npx --version >nul 2>&1
if %ERRORLEVEL% equ 0 (
    echo [info] No Python found, falling back to npx serve
    echo [info] First run will download the 'serve' package, ~10 seconds...
    start "" /b cmd /c "ping 127.0.0.1 -n 6 ^>nul ^& start "" http://localhost:%PORT%/"
    npx --yes serve . -p %PORT% -L
    goto :end
)

REM Nothing found — show install help
echo.
echo ============================================================================
echo  ERROR — neither Python nor Node.js is installed
echo ============================================================================
echo.
echo You need ONE of these to run a local web server:
echo.
echo   Option A: Python (recommended, ~30 MB)
echo      Download:  https://www.python.org/downloads/
echo      During install, TICK "Add Python to PATH" before clicking Install Now
echo.
echo   Option B: Node.js (~50 MB; useful for other web work)
echo      Download:  https://nodejs.org/  (pick the LTS button)
echo.
echo After install, close this window and double-click start-local-test.bat again.
echo.
echo ----------------------------------------------------------------------------
echo If you already have Python "installed" but see this message, you probably
echo only have the Microsoft Store alias. Open Settings -^> Apps -^>
echo "App execution aliases", turn off the python.exe / python3.exe entries,
echo then install Python from python.org.
echo ----------------------------------------------------------------------------
echo.
pause

:end
endlocal
