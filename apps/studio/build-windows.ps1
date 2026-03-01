<#
.SYNOPSIS
  Build RevealUI Studio (Tauri) for Windows and produce an NSIS installer.

.DESCRIPTION
  Run this from Windows PowerShell in the repo root or apps/studio directory.
  It syncs from GitHub, installs dependencies, and invokes `cargo tauri build`.
  Output: apps/studio/src-tauri/target/release/bundle/nsis/*.exe

.EXAMPLE
  # From the repo root:
  powershell -ExecutionPolicy Bypass -File apps\studio\build-windows.ps1

  # From apps/studio:
  powershell -ExecutionPolicy Bypass -File build-windows.ps1

.NOTES
  Prerequisites (must be in PATH):
    - Git
    - Node.js (node, pnpm)
    - Rust toolchain (rustup, cargo)
    - Tauri CLI:  cargo install tauri-cli --version "^2"
#>

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

# ── Resolve paths ──────────────────────────────────────────────────────────────

$scriptDir  = Split-Path -Parent $MyInvocation.MyCommand.Path
$studioDir  = $scriptDir                      # apps/studio
$repoRoot   = Split-Path -Parent (Split-Path -Parent $scriptDir)  # RevealUI/

# Handle being called from any cwd
if (-not (Test-Path (Join-Path $studioDir 'src-tauri'))) {
    Write-Error "Could not locate apps/studio — run from the repo root or apps/studio."
    exit 1
}

# ── Banner ─────────────────────────────────────────────────────────────────────

Write-Host ""
Write-Host "╔══════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║     RevealUI Studio — Windows Build      ║" -ForegroundColor Cyan
Write-Host "╚══════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

function Step([string]$msg) {
    Write-Host "▶ $msg" -ForegroundColor Yellow
}

function Ok([string]$msg) {
    Write-Host "  ✓ $msg" -ForegroundColor Green
}

function Fail([string]$msg) {
    Write-Host "  ✗ $msg" -ForegroundColor Red
    exit 1
}

# ── 1. Prerequisite check ──────────────────────────────────────────────────────

Step "Checking prerequisites"

foreach ($cmd in @('git', 'node', 'pnpm', 'cargo')) {
    if (-not (Get-Command $cmd -ErrorAction SilentlyContinue)) {
        Fail "'$cmd' not found in PATH. Install it and re-run."
    }
}

# Check tauri-cli is available as a cargo subcommand
$tauriCheck = cargo tauri --version 2>&1
if ($LASTEXITCODE -ne 0) {
    Fail "tauri-cli not found. Run: cargo install tauri-cli --version '^2'"
}
Ok "All prerequisites found ($tauriCheck)"

# ── 2. Sync from GitHub ────────────────────────────────────────────────────────

Step "Pulling latest from origin/main"
Push-Location $repoRoot
try {
    git fetch origin main --quiet
    if ($LASTEXITCODE -ne 0) { Fail "git fetch failed" }
    git reset --hard origin/main --quiet
    if ($LASTEXITCODE -ne 0) { Fail "git reset failed" }
    $rev = git rev-parse --short HEAD
    Ok "At commit $rev"
} finally {
    Pop-Location
}

# ── 3. Install dependencies ────────────────────────────────────────────────────

Step "Installing pnpm dependencies"
Push-Location $repoRoot
try {
    pnpm install --frozen-lockfile --silent
    if ($LASTEXITCODE -ne 0) { Fail "pnpm install failed" }
    Ok "Dependencies up to date"
} finally {
    Pop-Location
}

# ── 4. Build frontend ──────────────────────────────────────────────────────────

Step "Building frontend (tsc + vite)"
Push-Location $studioDir
try {
    pnpm build
    if ($LASTEXITCODE -ne 0) { Fail "Frontend build failed" }
    Ok "Frontend build complete"
} finally {
    Pop-Location
}

# ── 5. Build Tauri (Rust + bundle) ────────────────────────────────────────────

Step "Building Tauri app (cargo tauri build) — this takes a few minutes"
Push-Location $studioDir
try {
    cargo tauri build
    if ($LASTEXITCODE -ne 0) { Fail "Tauri build failed" }
    Ok "Tauri build complete"
} finally {
    Pop-Location
}

# ── 6. Locate output ───────────────────────────────────────────────────────────

$bundleDir = Join-Path $studioDir 'src-tauri\target\release\bundle'
$nsisDir   = Join-Path $bundleDir 'nsis'
$msiDir    = Join-Path $bundleDir 'msi'

$installer = Get-ChildItem -Path $nsisDir -Filter '*.exe' -ErrorAction SilentlyContinue |
             Sort-Object LastWriteTime -Descending |
             Select-Object -First 1

if (-not $installer) {
    # Fall back to MSI if NSIS wasn't produced
    $installer = Get-ChildItem -Path $msiDir -Filter '*.msi' -ErrorAction SilentlyContinue |
                 Sort-Object LastWriteTime -Descending |
                 Select-Object -First 1
}

Write-Host ""
if ($installer) {
    Write-Host "══════════════════════════════════════════════" -ForegroundColor Cyan
    Write-Host "  Build successful!" -ForegroundColor Green
    Write-Host "  Installer: $($installer.FullName)" -ForegroundColor White
    Write-Host "  Size:      $([math]::Round($installer.Length / 1MB, 1)) MB" -ForegroundColor White
    Write-Host "══════════════════════════════════════════════" -ForegroundColor Cyan
    Write-Host ""

    # Open the containing folder in Explorer
    Start-Process explorer.exe -ArgumentList "/select,`"$($installer.FullName)`""
} else {
    Write-Host "  Build succeeded but no installer found in:" -ForegroundColor Yellow
    Write-Host "  $bundleDir" -ForegroundColor Yellow
    Start-Process explorer.exe $bundleDir
}
