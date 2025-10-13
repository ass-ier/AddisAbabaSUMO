// Lightweight parser for SUMO .net.xml to render like Netedit (lane shapes in net coords)
// Usage: parseSumoNetXml("/Sumoconfigs/AddisAbaba.net.xml")
// Returns {
//   lanes: [{ id, points: [[y,x], ...] }],
//   bounds: { minX, minY, maxX, maxY },
//   tls: [{ id, lat, lng }]
// }

// Prefer offloading to a Web Worker; fall back to main-thread DOM parsing if worker fails
export async function parseSumoNetXml(url) {
  // Try worker first
  if (typeof Worker !== "undefined") {
    try {
      const worker = new Worker(
        new URL("../workers/sumoNetWorker.js", import.meta.url)
      );
      const result = await new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          try {
            worker.terminate();
          } catch (_) {}
          reject(new Error("SUMO net parsing timed out"));
        }, 120000); // 2 minutes for very large nets
        worker.onmessage = (e) => {
          const { type, data, message } = e.data || {};
          if (type === "result") {
            clearTimeout(timer);
            resolve(data);
            try {
              worker.terminate();
            } catch (_) {}
          } else if (type === "error") {
            clearTimeout(timer);
            reject(new Error(message || "Worker error"));
            try {
              worker.terminate();
            } catch (_) {}
          }
        };
        worker.onerror = (err) => {
          clearTimeout(timer);
          reject(new Error(err.message || "Worker failed"));
          try {
            worker.terminate();
          } catch (_) {}
        };
        worker.postMessage({ url });
      });
      return result;
    } catch (_) {
      // Fall through to main-thread parse if worker construction fails
    }
  }

  // Fallback: main-thread parsing (may be slow on very large files)
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
  if (!res.ok)
    throw new Error(`Failed to load net file: ${res.status} ${res.statusText}`);
  const xmlText = await res.text();
  if (!xmlText || !xmlText.trim()) throw new Error("Empty net file response");

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
      const x = parseFloat(jn.getAttribute("x"));
      const y = parseFloat(jn.getAttribute("y"));
      if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
      return { id, lat: y, lng: x };
    })
    .filter(Boolean);

  return { lanes, bounds, tls };
}
