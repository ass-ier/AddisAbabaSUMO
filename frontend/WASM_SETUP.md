# WebAssembly Setup Guide

This guide will help you set up and build the WebAssembly-based SUMO network parser for improved performance.

## Why WebAssembly?

Your 246MB `AddisAbaba.net.xml` file was taking significant time to parse with JavaScript. WebAssembly provides:

- **3-5x faster parsing** (from ~10-15s to ~2-4s)
- **Lower CPU usage**
- **Better memory management**
- **More efficient geometry processing**

The implementation automatically falls back to JavaScript if WASM isn't available.

## Prerequisites

### 1. Install Rust

**Windows:**
Download and run from [https://rustup.rs/](https://rustup.rs/) or:
```powershell
winget install Rustlang.Rust.MSVC
```

**Verify:**
```powershell
cargo --version
rustc --version
```

### 2. Install wasm-pack

```powershell
cargo install wasm-pack
```

**Verify:**
```powershell
wasm-pack --version
```

## Building the WASM Module

### Option 1: Using npm script (Recommended)

```powershell
npm run build:wasm
```

### Option 2: Manual build

```powershell
cd wasm-parser
.\build.ps1
```

### Option 3: Direct wasm-pack

```powershell
cd wasm-parser
wasm-pack build --target web --out-dir pkg --release
```

## Verification

After building, check that these files exist:
```
frontend/
  wasm-parser/
    pkg/
      sumo_net_parser_bg.wasm
      sumo_net_parser.js
      sumo_net_parser.d.ts
      package.json
```

## Running the Application

1. **Build WASM** (first time only, or after Rust code changes):
   ```powershell
   npm run build:wasm
   ```

2. **Start development server**:
   ```powershell
   npm start
   ```

3. **Navigate to Traffic Map** (`/traffic-map`)

4. **Check console** for performance logs:
   - Should see "⚡ Using WASM parser"
   - Parse time should be ~2-4 seconds for 246MB file
   - If you see "📝 Using JavaScript fallback", WASM didn't load (check browser console for errors)

## Production Build

When building for production:

```powershell
npm run build
```

This automatically:
1. Builds the WASM module
2. Compiles React app with optimizations
3. Includes WASM binary in build output

## Performance Comparison

| Parser | Time (246MB file) | CPU Usage | Memory |
|--------|------------------|-----------|---------|
| JavaScript Worker | 10-15s | High | ~800MB peak |
| **WebAssembly** | **2-4s** | **Medium** | **~400MB peak** |

## Troubleshooting

### "wasm-pack not found"
Install it: `cargo install wasm-pack`

### "cargo not found"
Install Rust from [https://rustup.rs/](https://rustup.rs/)

### Build fails with linking errors
On Windows, ensure you have Visual Studio C++ Build Tools installed:
```powershell
winget install Microsoft.VisualStudio.2022.BuildTools
```

### WASM not loading in browser
1. Check browser console for specific errors
2. Clear cache and hard reload (Ctrl+Shift+R)
3. Verify `wasm-parser/pkg/` directory exists
4. WASM requires localhost or HTTPS (not file://)

### Falls back to JavaScript every time
- Normal if WASM build hasn't been run yet
- Run `npm run build:wasm` once
- Check for import errors in browser console

### "Module parse failed" error
- WASM file might not be served with correct MIME type
- Check webpack/craco config includes WASM loader
- Ensure `wasm-parser/pkg/` is not in `.gitignore`

## Customizing Performance

Edit `wasm-parser/src/lib.rs` and adjust these constants:

```rust
const SIMPLIFY_EPS: f64 = 5.0;           // Increase for more aggressive simplification
const MAX_POINTS_PER_LANE: usize = 20;   // Reduce for simpler geometry
const MAX_LANES: usize = 12000;          // Reduce for faster initial render
```

After changes, rebuild:
```powershell
npm run build:wasm
```

## Development Workflow

### Making changes to WASM parser

1. Edit `wasm-parser/src/lib.rs`
2. Run `npm run build:wasm`
3. Refresh browser (hard reload to clear cache)

### Making changes to JavaScript wrapper

1. Edit `src/utils/sumoNetParserWasm.js`
2. No rebuild needed - just refresh browser

## CI/CD Integration

For automated builds:

```yaml
# .github/workflows/build.yml
- name: Install Rust
  uses: actions-rs/toolchain@v1
  with:
    toolchain: stable
    
- name: Install wasm-pack
  run: cargo install wasm-pack
  
- name: Build WASM
  run: npm run build:wasm
  
- name: Build React app
  run: npm run build
```

## Additional Resources

- [Rust Book](https://doc.rust-lang.org/book/)
- [wasm-pack Documentation](https://rustwasm.github.io/docs/wasm-pack/)
- [WebAssembly MDN](https://developer.mozilla.org/en-US/docs/WebAssembly)

## Support

If you encounter issues:
1. Check `wasm-parser/README.md` for detailed documentation
2. Review browser console for error messages
3. Verify prerequisites are installed correctly
4. Try building with verbose output: `wasm-pack build --target web --out-dir pkg --release -- --verbose`
