@echo off
REM Wrapper for cleanup-empty-stubs.ps1 — bypasses PowerShell's default
REM execution policy without changing it system-wide. Just run this file.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0cleanup-empty-stubs.ps1"
pause
