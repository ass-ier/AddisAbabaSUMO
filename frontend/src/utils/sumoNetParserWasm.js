// WASM-accelerated parser for SUMO .net.xml files with JavaScript fallback
// This wrapper handles loading the WASM module and provides a unified API

let wasmModule = null;
let wasmLoadPromise = null;

// Attempt to load WASM module (lazy loading)
async function loadWasmModule() {
  if (wasmModule) return wasmModule;
  if (wasmLoadPromise) return wasmLoadPromise;

  wasmLoadPromise = (async () => {
    try {
      // Dynamic import of the WASM module
      const wasm = await import("sumo-net-parser");
      await wasm.default(); // Initialize WASM
      wasmModule = wasm;
      console.log("✅ WASM parser loaded successfully");
      return wasm;
    } catch (error) {
      console.warn("⚠️ Failed to load WASM parser:", error);
      wasmModule = null;
      wasmLoadPromise = null;
      throw error;
    }
  })();

  return wasmLoadPromise;
}

// Fetch XML file with cache busting
async function fetchXmlText(url) {
  const bustUrl = url.includes("?")
    ? `${url}&_=${Date.now()}`
    : `${url}?_=${Date.now()}`;

  let res = await fetch(bustUrl, {
    cache: "no-store",
    credentials: "same-origin",
  });

  if (!res.ok) {
    res = await fetch(bustUrl, {
      cache: "reload",
      credentials: "same-origin",
      headers: { "Cache-Control": "no-cache", Pragma: "no-cache" },
    });
  }

  if (!res.ok) {
    throw new Error(`Failed to load net file: ${res.status} ${res.statusText}`);
  }

  const xmlText = await res.text();
  if (!xmlText || !xmlText.trim()) {
    throw new Error("Empty net file response");
  }

  return xmlText;
}

// JavaScript fallback parser (same as current implementation)
async function parseWithJavaScript(xmlText) {
  console.log("📝 Using JavaScript fallback parser");

  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlText, "application/xml");
  const parseErr = doc.querySelector("parsererror");
  if (parseErr) throw new Error("Invalid XML in net file");

  const loc = doc.querySelector("location");
  let bounds = null;
  if (loc && loc.getAttribute("convBoundary")) {
    const parts = loc
      .getAttribute("convBoundary")
      .split(",")
      .map((n) => parseFloat(n));
    if (parts.length === 4 && parts.every((n) => Number.isFinite(n))) {
      bounds = {
        minX: parts[0],
        minY: parts[1],
        maxX: parts[2],
        maxY: parts[3],
      };
    }
  }

  const laneNodes = Array.from(
    doc.querySelectorAll(
      "edge > lane[shape], edge[type] > lane[shape], lane[shape]"
    )
  );

  const lanes = laneNodes
    .map((lane, idx) => {
      const id = lane.getAttribute("id") || `lane_${idx}`;
      const shape = lane.getAttribute("shape") || "";
      const points = shape
        .trim()
        .split(/\s+/)
        .map((pair) => pair.split(",").map((n) => parseFloat(n)))
        .filter((xy) => xy.length === 2 && xy.every((n) => Number.isFinite(n)))
        .map(([x, y]) => [y, x]);
      return { id, points };
    })
    .filter((l) => l.points.length >= 2);

  const jNodes = Array.from(
    doc.querySelectorAll('junction[type="traffic_light"]')
  );
  const tls = jNodes
    .map((jn) => {
      const id = jn.getAttribute("id") || "";
      const clusterId = jn.getAttribute("tl") || id;
      const x = parseFloat(jn.getAttribute("x"));
      const y = parseFloat(jn.getAttribute("y"));
      if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
      return { id, clusterId, lat: y, lng: x };
    })
    .filter(Boolean);

  return { lanes, bounds, tls, junctions: [], junctionPoints: [] };
}

// Main parsing function with WASM + fallback
export async function parseSumoNetXml(url) {
  console.log(`🚀 Starting SUMO network parsing: ${url}`);
  const startTime = performance.now();

  try {
    // Fetch the XML file
    const xmlText = await fetchXmlText(url);
    console.log(
      `📥 Downloaded XML: ${(xmlText.length / 1024 / 1024).toFixed(2)} MB`
    );

    // Try WASM parser first
    try {
      const wasm = await loadWasmModule();
      console.log("⚡ Using WASM parser");

      const result = wasm.parse_sumo_net_xml(xmlText);
      const elapsed = performance.now() - startTime;
      console.log(`✅ WASM parsing complete in ${elapsed.toFixed(2)}ms`);

      return result;
    } catch (wasmError) {
      console.warn("⚠️ WASM parsing failed, falling back to JavaScript:", wasmError);

      // Fallback to JavaScript parser
      const result = await parseWithJavaScript(xmlText);
      const elapsed = performance.now() - startTime;
      console.log(`✅ JavaScript parsing complete in ${elapsed.toFixed(2)}ms`);

      return result;
    }
  } catch (error) {
    console.error("❌ Failed to parse SUMO network:", error);
    throw error;
  }
}

// Export for direct access if needed
export { loadWasmModule, parseWithJavaScript };
