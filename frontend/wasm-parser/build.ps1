# Build script for WASM parser
# Run this to compile the Rust code to WebAssembly

Write-Host " Building WASM parser..." -ForegroundColor Cyan

# Check if wasm-pack is installed
if (!(Get-Command wasm-pack -ErrorAction SilentlyContinue)) {
    Write-Host " wasm-pack not found!" -ForegroundColor Red
    Write-Host "Install it with: cargo install wasm-pack" -ForegroundColor Yellow
    exit 1
}

# Check if cargo is installed
if (!(Get-Command cargo -ErrorAction SilentlyContinue)) {
    Write-Host " cargo (Rust) not found!" -ForegroundColor Red
    Write-Host "Install Rust from: https://rustup.rs/" -ForegroundColor Yellow
    exit 1
}

Write-Host " Prerequisites found" -ForegroundColor Green

# Build with wasm-pack
Write-Host "Building WASM module..." -ForegroundColor Cyan
wasm-pack build --target web --out-dir pkg --release

if ($LASTEXITCODE -eq 0) {
    Write-Host " WASM build successful!" -ForegroundColor Green
    Write-Host " Output: wasm-parser/pkg/" -ForegroundColor Cyan
} else {
    Write-Host " Build failed!" -ForegroundColor Red
    exit 1
}
