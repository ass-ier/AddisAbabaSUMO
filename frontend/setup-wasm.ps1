# Quick setup script for WebAssembly parser
# Run this once after cloning the repository

$ErrorActionPreference = "Stop"

Write-Host "Setting up WebAssembly SUMO Network Parser" -ForegroundColor Cyan
Write-Host ""

# Check prerequisites
Write-Host "Checking prerequisites..." -ForegroundColor Yellow

$hasRust = Get-Command cargo -ErrorAction SilentlyContinue
if (-not $hasRust) {
    Write-Host "ERROR: Rust not found!" -ForegroundColor Red
    Write-Host ""
    Write-Host "Please install Rust:" -ForegroundColor Yellow
    Write-Host "  1. Visit: https://rustup.rs/" -ForegroundColor Cyan
    Write-Host "  2. Or run: winget install Rustlang.Rust.MSVC" -ForegroundColor Cyan
    Write-Host ""
    exit 1
}

Write-Host "OK: Rust installed: $(cargo --version)" -ForegroundColor Green

$hasWasmPack = Get-Command wasm-pack -ErrorAction SilentlyContinue
if (-not $hasWasmPack) {
    Write-Host "WARNING: wasm-pack not found. Installing..." -ForegroundColor Yellow
    cargo install wasm-pack
    if ($LASTEXITCODE -ne 0) {
        Write-Host "ERROR: Failed to install wasm-pack" -ForegroundColor Red
        exit 1
    }
    Write-Host "OK: wasm-pack installed" -ForegroundColor Green
} else {
    Write-Host "OK: wasm-pack installed: $(wasm-pack --version)" -ForegroundColor Green
}

Write-Host ""
Write-Host "Building WASM module..." -ForegroundColor Yellow

# Build WASM
Push-Location wasm-parser
try {
    wasm-pack build --target web --out-dir pkg --release
    if ($LASTEXITCODE -ne 0) {
        throw "Build failed"
    }
} catch {
    Write-Host "ERROR: WASM build failed!" -ForegroundColor Red
    Pop-Location
    exit 1
}
Pop-Location

Write-Host "SUCCESS: WASM build successful!" -ForegroundColor Green
Write-Host ""

# Verify output
if (Test-Path "wasm-parser\pkg\sumo_net_parser_bg.wasm") {
    $wasmSize = (Get-Item "wasm-parser\pkg\sumo_net_parser_bg.wasm").Length
    Write-Host "WASM binary size: $([math]::Round($wasmSize / 1024, 2)) KB" -ForegroundColor Cyan
} else {
    Write-Host "WARNING: WASM binary not found" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "SUCCESS: Setup complete!" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "  1. Run: npm start" -ForegroundColor White
Write-Host "  2. Navigate to: /traffic-map" -ForegroundColor White
Write-Host "  3. Check browser console for WASM performance logs" -ForegroundColor White
Write-Host ""
Write-Host "See WASM_SETUP.md for detailed documentation" -ForegroundColor Yellow
