# cleanup-empty-stubs.ps1
# ==========================================================================
# One-shot cleanup of every "MOVED → …" stub left behind during the JS
# restructure. After running this, the only JS that exists in the repo is:
#
#   js/app.js                ← entry
#   js/engine/dispatch.js    ← shared dispatcher
#   js/engine/home/...       ← homepage tree
#   js/engine/card/index.js  ← card-page module
#   js/engine/sme/index.js   ← SME-page module
#   lib/...                  ← vendored third-party scripts
#
# Run from the project root:
#   powershell -ExecutionPolicy Bypass -File .\cleanup-empty-stubs.ps1
#
# Or open PowerShell in the project root and run:
#   .\cleanup-empty-stubs.ps1
# ==========================================================================

$ErrorActionPreference = 'SilentlyContinue'

$stubFiles = @(
  # Pre-restructure (legacy) files at js/ root
  'js\main.js',
  'js\card.js',
  'js\register.js',
  'js\register-scanner.js',

  # Pre-restructure subdirectories — files only
  'js\icons\svg-builders.js',
  'js\render\hero.js',
  'js\render\stats.js',
  'js\render\portfolio.js',
  'js\render\audit.js',
  'js\render\menu.js',
  'js\render\trust.js',
  'js\render\industries.js',
  'js\render\departments.js',
  'js\render\legal.js',
  'js\render\social.js',
  'js\modules\card-detail.js',
  'js\modules\footer-card.js',
  'js\modules\loader-shell.js',
  'js\modules\map.js',
  'js\modules\scroll.js',
  'js\pages\home.js',
  'js\pages\card.js',
  'js\pages\sme.js',

  # Post-restructure stubs left behind by the home/card/sme reorg
  'js\engine\utils.js',
  'js\engine\tokens.js',
  'js\engine\loader.js',
  'js\engine\hydrate.js',
  'js\engine\lib-loader.js',
  'js\engine\fallbacks.js',
  'js\engine\icons\svg-builders.js',
  'js\engine\render\hero.js',
  'js\engine\render\stats.js',
  'js\engine\render\portfolio.js',
  'js\engine\render\audit.js',
  'js\engine\render\menu.js',
  'js\engine\render\trust.js',
  'js\engine\render\industries.js',
  'js\engine\render\departments.js',
  'js\engine\render\legal.js',
  'js\engine\render\social.js',
  'js\engine\modules\card-detail.js',
  'js\engine\modules\footer-card.js',
  'js\engine\modules\loader-shell.js',
  'js\engine\modules\map.js',
  'js\engine\modules\scroll.js',
  'js\engine\modules\card.js',
  'js\engine\modules\register.js',
  'js\engine\modules\register-scanner.js',
  'js\engine\pages\home.js',
  'js\engine\pages\card.js',
  'js\engine\pages\sme.js'
)

$emptyDirs = @(
  'js\icons',
  'js\render',
  'js\modules',
  'js\pages',
  'js\engine\icons',
  'js\engine\render',
  'js\engine\modules',
  'js\engine\pages'
)

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $root

Write-Host "Removing $($stubFiles.Count) stub files..." -ForegroundColor Cyan
$removed = 0
foreach ($f in $stubFiles) {
  if (Test-Path $f) {
    Remove-Item $f -Force
    Write-Host "  rm $f"
    $removed++
  }
}

Write-Host "Removing now-empty directories..." -ForegroundColor Cyan
foreach ($d in $emptyDirs) {
  if (Test-Path $d) {
    $files = Get-ChildItem $d -Recurse -File
    if ($files.Count -eq 0) {
      Remove-Item $d -Recurse -Force
      Write-Host "  rmdir $d"
    } else {
      Write-Host "  SKIP $d (still has $($files.Count) file(s))" -ForegroundColor Yellow
    }
  }
}

Write-Host ""
Write-Host "Done. Removed $removed file(s)." -ForegroundColor Green
Write-Host "Final JS tree:" -ForegroundColor Cyan
Get-ChildItem -Path js -Recurse -File | ForEach-Object {
  $rel = $_.FullName.Substring($root.Length + 1)
  Write-Host "  $rel"
}
