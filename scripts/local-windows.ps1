# local-windows.ps1 — Local-only Windows portable build (NO bump, NO push, NO release)
# Builds the portable app folder into D:\Projects\VibeCode\VibeIDE-win32-x64 for local testing.
# Usage:
#   .\scripts\local-windows.ps1                # full build (react + ts + gulp)
#   .\scripts\local-windows.ps1 -SkipCompile   # skip TS compile (use existing out/)
#   .\scripts\local-windows.ps1 -SkipReact     # skip scope-tailwind + tsup rebuild
# Requires: Node.js. Does NOT require gh CLI or InnoSetup.

param(
    [switch]$SkipCompile,
    [switch]$SkipReact
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$Root = Split-Path $PSScriptRoot -Parent
Set-Location $Root

# ── Helpers ───────────────────────────────────────────────────────────────────
function Step([string]$msg) { Write-Host "▶ $msg" -ForegroundColor Yellow }
function OK([string]$msg)   { Write-Host "✓ $msg" -ForegroundColor Green  }

# ── Version (read-only, no bump) ──────────────────────────────────────────────
$productPath = "$Root\product.json"
$product = Get-Content $productPath -Raw | ConvertFrom-Json
$vibeVersion = $product.vibeVersion
Write-Host "`n🧪 Local portable build of VibeIDE v$vibeVersion (Windows x64)`n" -ForegroundColor Cyan
Write-Host "   No version bump, no git push, no GitHub Release, no installer.`n" -ForegroundColor DarkGray

# ── npm / node helpers (Windows: must use .cmd wrappers) ─────────────────────
function Npm([string]$cmd) {
    cmd /c "npm $cmd"
    if ($LASTEXITCODE -ne 0) { throw "npm $cmd failed (exit $LASTEXITCODE)" }
}
function Gulp([string]$task) {
    cmd /c "node --max-old-space-size=8192 node_modules\gulp\bin\gulp.js $task"
    if ($LASTEXITCODE -ne 0) { throw "gulp $task failed (exit $LASTEXITCODE)" }
}

# ── 0. Extract VibeIDE NLS strings (pre-build i18n step) ─────────────────────
Step "Extracting VibeIDE NLS strings..."
try {
    Gulp "extract-vibeide-locale-strings"
    OK "NLS strings extracted to out/nls/"
} catch {
    Write-Host "⚠ NLS extraction failed (non-fatal): $_" -ForegroundColor Yellow
}

# ── 0b. Build language packs (if locale bundles exist) ───────────────────────
$nlsDir = "$Root\out\nls"
$hasPacks = $false
if (Test-Path $nlsDir) {
    $hasPacks = (Get-ChildItem $nlsDir -Filter "vibeide.nls.*.json" | Where-Object { $_.Name -ne "vibeide.nls.json" }).Count -gt 0
}
if ($hasPacks) {
    Step "Building VibeIDE language pack VSIXes..."
    try {
        Gulp "build-vibeide-language-packs"
        OK "Language packs built to out/language-packs/"
    } catch {
        Write-Host "⚠ Language pack build failed (non-fatal): $_" -ForegroundColor Yellow
    }
} else {
    Write-Host "⏭ No locale bundles found — skipping language pack VSIX build" -ForegroundColor DarkGray
}

# ── 0c. Rebuild React tree (scope-tailwind shadow + tsup) ────────────────────
# Keeps `react/src2/` in sync with edits in `react/src/`. Skipping this masked a
# release failure on 2026-05-12 (vibeSettingsRu.ts fix not propagated).
if (-not $SkipReact) {
    Step "Rebuilding React tree (scope-tailwind + tsup)..."
    Npm "run buildreact"
    OK "React tree rebuilt"
} else {
    Write-Host "⏭ Skipping React rebuild (-SkipReact)" -ForegroundColor DarkGray
}

# ── 1. Compile TypeScript ─────────────────────────────────────────────────────
if (-not $SkipCompile) {
    Step "Compiling TypeScript (npm run compile-build)..."
    Npm "run compile-build"
    OK "TypeScript compiled"
} else {
    Write-Host "⏭ Skipping TS compile (-SkipCompile)" -ForegroundColor DarkGray
}

# ── 2. Build Windows x64 portable app folder ──────────────────────────────────
# gulp writes the portable app to $Root\..\VibeIDE-win32-x64
# i.e. D:\Projects\VibeCode\VibeIDE-win32-x64 when this repo is at D:\Projects\VibeCode\VibeIDE.
$appOutDir = "$Root\..\VibeIDE-win32-x64"

# Make sure no leftover Code.exe is holding the output directory open. We do NOT
# kill the process — that's the user's call — just warn loudly so the gulp step
# fails fast with a clear hint instead of a cryptic EBUSY mid-build.
if (Test-Path "$appOutDir\Code.exe") {
    $running = Get-Process -Name "Code","VibeIDE" -ErrorAction SilentlyContinue |
               Where-Object { try { $_.Path -like "$appOutDir\*" } catch { $false } }
    if ($running) {
        Write-Warning "A built VibeIDE/Code.exe is running from $appOutDir — close it before continuing or gulp will fail to overwrite files."
    }
}

Step "Building Windows x64 portable app folder..."
Gulp "vscode-win32-x64"
OK "Portable app built"

# ── 3. Smoke check — verify the built exe responds ────────────────────────────
Step "Smoke-checking built application..."
$appExe = "$appOutDir\Code.exe"
if (-not (Test-Path $appExe)) {
    $appExe = "$appOutDir\VibeIDE.exe"
}
if (Test-Path $appExe) {
    $smokeOut = & $appExe --version 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Error "[local-windows] Smoke check FAILED: $appExe --version exited $LASTEXITCODE"
        exit 1
    }
    if (-not $smokeOut) {
        Write-Warning "[local-windows] Smoke check WARNING: $appExe --version produced no output (non-fatal)"
    } else {
        OK "Smoke check passed: $($smokeOut -join ' / ')"
    }
} else {
    Write-Warning "[local-windows] Smoke check SKIPPED: built exe not found at $appOutDir — verify gulp output dir."
}

# ── Done ──────────────────────────────────────────────────────────────────────
$resolved = (Resolve-Path $appOutDir).Path
Write-Host "`n🎉 Done! Portable VibeIDE v$vibeVersion is at:" -ForegroundColor Cyan
Write-Host "   $resolved" -ForegroundColor Green
Write-Host "`nRun it with:" -ForegroundColor DarkGray
Write-Host "   & `"$resolved\Code.exe`"" -ForegroundColor Gray
Write-Host ""
