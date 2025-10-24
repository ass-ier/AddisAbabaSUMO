# SUMO Network Parser (WebAssembly)

High-performance SUMO `.net.xml` parser written in Rust and compiled to WebAssembly.

## Features

- **Fast XML Parsing**: Uses `roxmltree` for efficient XML parsing
- **Optimized Geometry**: Ramer-Douglas-Peucker algorithm for line simplification
- **Memory Efficient**: Processes large files (200MB+) with minimal overhead
- **Type-Safe**: Rust ensures memory safety and prevents crashes
- **Progressive Enhancement**: Automatically falls back to JavaScript if WASM fails

## Prerequisites

1. **Rust**: Install from [https://rustup.rs/](https://rustup.rs/)
2. **wasm-pack**: Install with `cargo install wasm-pack`

## Building

### Windows (PowerShell)
```powershell
cd wasm-parser
.\build.ps1
```

### Linux/macOS
```bash
cd wasm-parser
wasm-pack build --target web --out-dir pkg --release
```

### From npm script
```bash
npm run build:wasm
```

## Output

The build creates a `pkg/` directory with:
- `sumo_net_parser_bg.wasm` - The compiled WebAssembly binary
- `sumo_net_parser.js` - JavaScript bindings
- `sumo_net_parser.d.ts` - TypeScript type definitions

## Usage

The WASM parser is automatically used by the TrafficMap component via `sumoNetParserWasm.js`.

```javascript
import { parseSumoNetXml } from '../utils/sumoNetParserWasm';

const data = await parseSumoNetXml('/path/to/network.net.xml');
// Returns: { lanes, bounds, tls, junctions, junctionPoints }
```

## Performance

**Before (JavaScript Worker):**
- ~10-15 seconds for 246MB file
- High CPU usage
- Main thread blocking

**After (WebAssembly):**
- ~2-4 seconds for same file (3-5x faster)
- Lower CPU usage
- Better memory management

## Optimization Parameters

Defined in `src/lib.rs`:

```rust
const SIMPLIFY_EPS: f64 = 5.0;           // Meters - line simplification threshold
const MAX_POINTS_PER_LANE: usize = 20;   // Max points per lane geometry
const MAX_LANES: usize = 12000;          // Max lanes to render
```

Adjust these for your use case:
- Increase `SIMPLIFY_EPS` for more aggressive simplification
- Decrease `MAX_LANES` for faster rendering on slower devices

## Troubleshooting

### Build fails
- Ensure Rust and wasm-pack are installed
- Check `cargo --version` and `wasm-pack --version`

### WASM not loading in browser
- Check browser console for errors
- Verify `pkg/` directory exists with `.wasm` file
- Clear browser cache

### Falls back to JavaScript
- Normal behavior if WASM fails to load
- Check console for specific error message
- WASM requires HTTPS in production (or localhost)

## Development

To modify the parser:

1. Edit `src/lib.rs`
2. Run `.\build.ps1` (Windows) or `wasm-pack build --target web --out-dir pkg --release`
3. Refresh your browser (the JavaScript wrapper will load the new WASM)

## License

Same as parent project
