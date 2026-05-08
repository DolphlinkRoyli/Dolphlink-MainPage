@echo off
REM ============================================================================
REM compress-poster.bat -- re-encode media/img/video-poster.webp at higher
REM compression. Saves ~50 KiB with no visible quality loss.
REM Usage: double-click, OR run from any terminal at the project root.
REM ============================================================================

REM ALWAYS pause on exit so a double-click run shows the result instead
REM of vanishing. Single :end label below; every code path goto :end.
setlocal
cd /d "%~dp0"

set "INPUT=media\img\video-poster.webp"
set "BACKUP=media\img\video-poster.original.webp"
set "TMP=media\img\video-poster.tmp.webp"
set "CWEBP="

REM ---------- Sanity check ----------
if not exist "%INPUT%" (
  echo [ERROR] Cannot find %INPUT%
  echo Make sure you are running this from the project root ^(E:\baidu\dolphlink^).
  goto :end
)

REM ---------- Locate cwebp -----------------------------------------------
REM 1. Try PATH.
where cwebp >nul 2>&1
if %ERRORLEVEL%==0 (
  set "CWEBP=cwebp"
  goto :have_cwebp
)

REM 2. Recursive scan of common install dirs. dir /s /b handles wildcards
REM    properly (the `for %%P in (... pattern ...)` form does NOT).
echo [info] cwebp not on PATH -- searching common install dirs...

call :scan "%ProgramFiles%\libwebp"
if defined CWEBP goto :have_cwebp
call :scan "%ProgramFiles(x86)%\libwebp"
if defined CWEBP goto :have_cwebp
call :scan "%LOCALAPPDATA%\Microsoft\WinGet\Packages"
if defined CWEBP goto :have_cwebp
call :scan "%~dp0lib"
if defined CWEBP goto :have_cwebp

REM 3. Not found -- print install instructions, do NOT auto-winget
REM    (winget can hang or prompt for UAC, which makes a "double-click
REM    and forget" run feel broken).
echo.
echo [INSTALL NEEDED] cwebp.exe not found.
echo.
echo Pick ONE of the following:
echo.
echo   A^) winget install Google.WebP        ^(easiest if you have winget^)
echo   B^) Download portable from
echo      https://developers.google.com/speed/webp/download
echo      Extract to E:\baidu\dolphlink\lib\libwebp\
echo   C^) Use the web encoder at https://squoosh.app
echo      ^(drop the file in, set WebP quality 55-65, save back over it^)
echo.
echo Then re-run this script.
goto :end

:scan
REM Recursively find cwebp.exe under the path passed in %1.
REM First match wins.
if not exist %1 exit /b 0
for /f "delims=" %%P in ('dir /s /b "%~1\cwebp.exe" 2^>nul') do (
  set "CWEBP=%%P"
  exit /b 0
)
exit /b 0

:have_cwebp
echo [info] Using cwebp: %CWEBP%
echo.

REM ---------- Backup original ----------
if not exist "%BACKUP%" (
  echo [info] Backing up original to %BACKUP%
  copy /y "%INPUT%" "%BACKUP%" >nul
)

REM ---------- Sizes ----------
for %%S in ("%INPUT%") do set "BEFORE=%%~zS"
echo Before: %BEFORE% bytes

REM ---------- Re-encode via temp file ----------
"%CWEBP%" -q 60 -m 6 -mt -af "%INPUT%" -o "%TMP%"
if %ERRORLEVEL% NEQ 0 (
  echo.
  echo [ERROR] cwebp encode failed.
  if exist "%TMP%" del "%TMP%"
  goto :end
)

for %%S in ("%TMP%") do set "AFTER=%%~zS"
echo After:  %AFTER% bytes
echo.

REM ---------- Replace only if smaller ----------
if %AFTER% LSS %BEFORE% (
  move /y "%TMP%" "%INPUT%" >nul
  set /a "SAVED=(BEFORE - AFTER) / 1024"
  echo [done] Saved %SAVED% KiB. Original kept at %BACKUP%.
  echo.
  echo Next step: bump CACHE_VERSION in sw.js and ship.
) else (
  if exist "%TMP%" del "%TMP%"
  echo [skip] New encode is not smaller -- original kept.
)

:end
echo.
echo ============================================================================
pause
endlocal
