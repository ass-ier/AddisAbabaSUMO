# WebAssembly Quick Reference

## 🚀 First Time Setup

```powershell
# Run this once
.\setup-wasm.ps1
```

## 📋 Prerequisites

1. **Rust**: `winget install Rustlang.Rust.MSVC` or https://rustup.rs/
2. **wasm-pack**: `cargo install wasm-pack`

## 🔨 Building

```powershell
# Build WASM module
npm run build:wasm

# Start dev server
npm start

# Production build (includes WASM)
npm run build
```

## ⚡ Performance

| Metric | Before | After | Speedup |
|--------|--------|-------|---------|
| Parse Time | 10-15s | 2-4s | **3-5x** |
| Memory | 800MB | 400MB | **50%** |
| CPU | 100% | 40-60% | **50%** |

## 🔍 Verify Working

Browser console should show:
```
⚡ Using WASM parser
✅ WASM parsing complete in 2847.23ms
```

If you see `📝 Using JavaScript fallback`, run `npm run build:wasm`

## 📁 Key Files

- `wasm-parser/src/lib.rs` - Rust parser code
- `src/utils/sumoNetParserWasm.js` - JavaScript wrapper
- `wasm-parser/pkg/*.wasm` - Compiled binary (generated)

## ⚙️ Tuning Performance

Edit `wasm-parser/src/lib.rs`:

```rust
const SIMPLIFY_EPS: f64 = 5.0;           // ↑ = faster, less detail
const MAX_POINTS_PER_LANE: usize = 20;   // ↓ = faster rendering
const MAX_LANES: usize = 12000;          // ↓ = much faster load
```

Then rebuild: `npm run build:wasm`

## 🐛 Troubleshooting

| Problem | Solution |
|---------|----------|
| Build fails | Check `cargo --version` and `wasm-pack --version` |
| Always fallback | Run `npm run build:wasm` first |
| WASM not loading | Clear cache (Ctrl+Shift+R), check console |
| Module not found | Verify `wasm-parser/pkg/` directory exists |

## 📚 Documentation

- **Full Guide**: `WASM_SETUP.md`
- **Summary**: `WASM_IMPLEMENTATION_SUMMARY.md`
- **Module Docs**: `wasm-parser/README.md`

## 🎯 Common Commands

```powershell
# Check prerequisites
cargo --version
wasm-pack --version

# Build WASM only
cd wasm-parser
.\build.ps1
cd ..

# Development workflow
npm run build:wasm    # After Rust changes
npm start            # Start dev server

# Production
npm run build        # Builds WASM + React app
```

## 🌐 Browser Support

✅ Chrome 76+, Firefox 73+, Safari 14+, Edge 79+  
⚠️ IE 11 (falls back to JavaScript)

## 💡 Tips

- First build takes ~2-5 minutes (Rust compilation)
- Subsequent builds are faster (~30 seconds)
- WASM binary is ~100-150KB (small!)
- Fallback ensures old browsers still work
- Check console for performance logs

## 🔗 Quick Links

- Rust: https://rustup.rs/
- wasm-pack: https://rustwasm.github.io/wasm-pack/
- WASM Book: https://rustwasm.github.io/docs/book/
