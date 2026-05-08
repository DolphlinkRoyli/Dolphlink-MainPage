# ============================================================================
# DOLPHLINK — Push to GitHub
# ----------------------------------------------------------------------------
# One-shot deploy script. Stages all changes, commits with the message you
# type (or a timestamped fallback if you just press Enter), and pushes to the
# default remote/branch.
#
# Unicode-path resilience
#   This repo lives in `E:\百悟\dolphlink\`. Windows PowerShell 5 (the default
#   on Windows 10/11) re-encodes external-process arguments through the
#   system ANSI code page, which mangles non-ASCII characters when they
#   reach Git for Windows. So we MUST NOT pass the repo path as an argument
#   (`git -C "<path>"` fails on this machine because E: has 8.3 short names
#   disabled, so the fallback returns the same Chinese-bearing long path).
#
#   Fix: just `Set-Location` to the repo. PowerShell sets the process cwd
#   via SetCurrentDirectoryW (Unicode). Git reads cwd via GetCurrentDirectoryW
#   (Unicode). No ANSI conversion ever happens — the Chinese folder name
#   survives untouched. Then we run plain `git status` / `git commit` etc.
#   with no path argument and git operates on cwd correctly.
#
# USAGE
#   1. Double-click `push-to-github.bat` (the friendly wrapper), OR
#   2. Right-click `push-to-github.ps1` -> "Run with PowerShell", OR
#   3. From a terminal:
#        powershell -ExecutionPolicy Bypass -File .\push-to-github.ps1
#        powershell -ExecutionPolicy Bypass -File .\push-to-github.ps1 "msg"
# ============================================================================

# UTF-8 console so Chinese chars render right.
$OutputEncoding = [System.Text.Encoding]::UTF8
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

# Locate the repo: the folder this .ps1 lives in.
$repo = $PSScriptRoot
if (-not $repo) { $repo = Split-Path -Parent $MyInvocation.MyCommand.Path }

# CRITICAL: change into the repo. Set-Location uses the Unicode Windows API,
# so even folders with Chinese chars are honoured exactly. After this, every
# git command we run will inherit the right cwd — no -C argument needed.
Set-Location -LiteralPath $repo

# --- 0. Sanity checks ---------------------------------------------------------
$gitCmd = Get-Command git -ErrorAction SilentlyContinue
if (-not $gitCmd) {
    Write-Host ""
    Write-Host "[ERROR] git is not installed or not on PATH." -ForegroundColor Red
    Write-Host "        Download Git for Windows: https://git-scm.com/download/win"
    Write-Host ""
    Read-Host "Press Enter to exit"
    exit 1
}

# Verify we landed in a git repo. NO -C argument; relies on Set-Location above.
& git rev-parse --is-inside-work-tree 2>$null | Out-Null
if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "[ERROR] This folder is not a git repository." -ForegroundColor Red
    Write-Host "        Folder checked: $repo"
    Write-Host "        PowerShell cwd: $((Get-Location).Path)"
    Write-Host ""
    Write-Host "        Verify a `.git` directory exists in this folder."
    Write-Host "        If not, run `git init` here, or check you double-clicked"
    Write-Host "        the right .bat file."
    Write-Host ""
    Read-Host "Press Enter to exit"
    exit 1
}

# --- 1. Show context ---------------------------------------------------------
$branch = & git rev-parse --abbrev-ref HEAD
$remote = & git remote get-url origin 2>$null
if (-not $remote) { $remote = "(no remote `origin` configured)" }

Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host " DOLPHLINK -> GitHub" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host " Folder : $repo"
Write-Host " Branch : $branch"
Write-Host " Remote : $remote"
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""

# --- 2. Show what will be committed ------------------------------------------
$status = & git status --porcelain
if (-not $status) {
    Write-Host "[info] Working tree is clean — nothing to commit." -ForegroundColor Yellow
    Write-Host ""
    $pushAnyway = Read-Host "Push existing local commits anyway? (y/N)"
    if ($pushAnyway -notmatch '^[yY]') {
        Write-Host "Aborted." -ForegroundColor Yellow
        Read-Host "Press Enter to exit"
        exit 0
    }
} else {
    Write-Host "[changes detected]" -ForegroundColor Green
    & git status --short
    Write-Host ""
}

# --- 3. Get commit message ---------------------------------------------------
$msg = $args -join ' '
if (-not $msg -and $status) {
    $defaultMsg = "Update site — $(Get-Date -Format 'yyyy-MM-dd HH:mm')"
    Write-Host "Commit message (press Enter for default):"
    Write-Host "  default: $defaultMsg" -ForegroundColor DarkGray
    $msg = Read-Host "  message"
    if (-not $msg) { $msg = $defaultMsg }
}

# --- 4. Stage + commit -------------------------------------------------------
if ($status) {
    Write-Host ""
    Write-Host "[1/3] Staging all changes..." -ForegroundColor Cyan
    & git add -A
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[ERROR] git add failed." -ForegroundColor Red
        Read-Host "Press Enter to exit"
        exit 1
    }

    Write-Host "[2/3] Committing..." -ForegroundColor Cyan
    Write-Host "      message: $msg"
    # Write the commit message to a temp UTF-8 file and pass via -F. This
    # bypasses PowerShell's ANSI-encoded argv conversion, so commit messages
    # containing Chinese / Japanese / accented chars survive intact.
    $msgFile = Join-Path $env:TEMP "dolphlink-commit-msg-$([guid]::NewGuid()).txt"
    try {
        [System.IO.File]::WriteAllText(
            $msgFile, $msg,
            (New-Object System.Text.UTF8Encoding($false))  # UTF-8 without BOM
        )
        & git commit -F $msgFile
    }
    finally {
        if (Test-Path -LiteralPath $msgFile) { Remove-Item -LiteralPath $msgFile -Force }
    }
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[ERROR] git commit failed (see message above)." -ForegroundColor Red
        Read-Host "Press Enter to exit"
        exit 1
    }
}

# --- 5. Push -----------------------------------------------------------------
Write-Host "[3/3] Pushing to origin/$branch..." -ForegroundColor Cyan
& git push origin $branch
if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "[ERROR] git push failed." -ForegroundColor Red
    Write-Host "        - If this is a fresh repo, set the remote first:"
    Write-Host "             git remote add origin https://github.com/<you>/<repo>.git"
    Write-Host "        - If your branch is new, push with --set-upstream:"
    Write-Host "             git push --set-upstream origin $branch"
    Write-Host "        - If you need credentials, install GitHub CLI or set up SSH."
    Read-Host "Press Enter to exit"
    exit 1
}

Write-Host ""
Write-Host "============================================================" -ForegroundColor Green
Write-Host " Done. Pushed to origin/$branch." -ForegroundColor Green
if ($remote -match 'github\.com[:/](.+?)(?:\.git)?$') {
    $repoSlug = $Matches[1]
    Write-Host " Repo  : https://github.com/$repoSlug" -ForegroundColor Green
    if ($repoSlug -match '^([^/]+)/(.+)$') {
        $user = $Matches[1]
        $name = $Matches[2]
        Write-Host " Pages : https://$user.github.io/$name/" -ForegroundColor Green
    }
}
Write-Host "============================================================" -ForegroundColor Green
Write-Host ""

Read-Host "Press Enter to close this window"
