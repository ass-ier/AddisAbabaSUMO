/* eslint-disable no-restricted-globals */
// sumoNetWorker.js - Parses large SUMO .net.xml off the main thread
// Receives: { url: string }
// Responds: { type: 'result', data } or { type: 'error', message }

// Ramer–Douglas–Peucker simplification on [x,y] points in net coordinates (meters)
function simplifyRDP(points, epsilon) {
  if (!Array.isArray(points) || points.length <= 2 || !epsilon || epsilon <= 0)
    return points;
  const sq = (n) => n * n;
  const distSqToSegment = (p, v, w) => {
    // Return minimum distance squared from point p to segment vw
    const l2 = sq(v[0] - w[0]) + sq(v[1] - w[1]);
    if (l2 === 0) return sq(p[0] - v[0]) + sq(p[1] - v[1]);
    let t =
      ((p[0] - v[0]) * (w[0] - v[0]) + (p[1] - v[1]) * (w[1] - v[1])) / l2;
    t = Math.max(0, Math.min(1, t));
    const proj = [v[0] + t * (w[0] - v[0]), v[1] + t * (w[1] - v[1])];
    return sq(p[0] - proj[0]) + sq(p[1] - proj[1]);
  };
  const epsilonSq = epsilon * epsilon;
  const keep = new Array(points.length).fill(false);
  keep[0] = true;
  keep[points.length - 1] = true;
  const stack = [[0, points.length - 1]];
  while (stack.length) {
    const [start, end] = stack.pop();
    let idx = -1;
    let maxDistSq = 0;
    for (let i = start + 1; i < end; i++) {
      const d = distSqToSegment(points[i], points[start], points[end]);
      if (d > maxDistSq) {
        maxDistSq = d;
        idx = i;
      }
    }
    if (maxDistSq > epsilonSq && idx !== -1) {
      keep[idx] = true;
      stack.push([start, idx]);
      stack.push([idx, end]);
    }
  }
  const out = [];
  for (let i = 0; i < points.length; i++) if (keep[i]) out.push(points[i]);
  return out;
}

function sampleEveryN(points, maxPoints) {
  if (!Array.isArray(points) || points.length <= maxPoints) return points;
  const step = Math.ceil(points.length / maxPoints);
  const out = [];
  for (let i = 0; i < points.length; i += step) out.push(points[i]);
  if (out[out.length - 1] !== points[points.length - 1])
    out.push(points[points.length - 1]);
  return out;
}

async function parseXmlInWorker(url) {
  // Bust cache to avoid 304 with empty body from dev server/static middleware
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

  // Bounds from <location convBoundary="minX,minY,maxX,maxY" ... />
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

  // Include internal edges (they connect junctions); for non-internal, keep only major road families
  const allEdges = Array.from(doc.querySelectorAll("edge"));
  const MAJOR_TYPES_RE = /(trunk|primary|secondary)/i;
  const filteredEdges = allEdges.filter((e) => {
    const fn = e.getAttribute("function") || "";
    if (fn === "internal") return true;
    const t = e.getAttribute("type") || "";
    // If type missing, include; otherwise allow only major families
    return !t || MAJOR_TYPES_RE.test(t);
  });

  const laneNodes = filteredEdges.flatMap((e) =>
    Array.from(e.querySelectorAll("lane[shape]"))
  );

  // Faster geometry settings
  const SIMPLIFY_EPS_METERS = 5.0; // larger epsilon = fewer points
  const MAX_POINTS_PER_LANE = 20; // more aggressive cap

  const lanes = [];
  for (let idx = 0; idx < laneNodes.length; idx++) {
    const lane = laneNodes[idx];
    const id = lane.getAttribute("id") || `lane_${idx}`;
    const edgeEl = lane.parentElement;
    const edgeId = edgeEl ? edgeEl.getAttribute("id") || null : null;
    const fnAttr = edgeEl ? edgeEl.getAttribute("function") || "" : "";
    const isInternal = fnAttr === "internal";
    const shape = lane.getAttribute("shape") || "";
    const speedAttr = lane.getAttribute("speed");
    const speed = speedAttr ? parseFloat(speedAttr) : undefined;
    if (!shape) continue;
    // Prepare points in net coords [x,y]
    let pts = shape
      .trim()
      .split(/\s+/)
      .map((pair) => pair.split(",").map((n) => parseFloat(n)))
      .filter((xy) => xy.length === 2 && xy.every((n) => Number.isFinite(n)));
    if (pts.length < 2) continue;
    // Simplify then sample
    if (pts.length > 4) pts = simplifyRDP(pts, SIMPLIFY_EPS_METERS);
    if (pts.length > MAX_POINTS_PER_LANE)
      pts = sampleEveryN(pts, MAX_POINTS_PER_LANE);
    // Convert to Leaflet [lat, lng] as [y, x]
    const latlngs = pts.map(([x, y]) => [y, x]);
    if (latlngs.length >= 2)
      lanes.push({ id, edgeId, points: latlngs, speed, isInternal });
  }

  // Global thinning: hard cap of total lanes
  const MAX_LANES = 12000; // much lower for faster UI
  let finalLanes = lanes;
  if (lanes.length > MAX_LANES) {
    const step = Math.ceil(lanes.length / MAX_LANES);
    finalLanes = lanes.filter((_, i) => i % step === 0);
  }

  // Traffic lights with x,y (subset of junctions)
  const jTls = Array.from(
    doc.querySelectorAll('junction[type="traffic_light"]')
  );
  const tls = jTls
    .map((jn) => {
      const id = jn.getAttribute("id") || "";
      const clusterId = jn.getAttribute("tl") || id; // SUMO joined-TLS id
      const x = parseFloat(jn.getAttribute("x"));
      const y = parseFloat(jn.getAttribute("y"));
      if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
      return { id, clusterId, lat: y, lng: x };
    })
    .filter(Boolean);

  // Junction polygons (fill intersection centers)
  const jAll = Array.from(doc.querySelectorAll("junction[shape]"));
  const junctions = jAll
    .map((jn, idx) => {
      const id = jn.getAttribute("id") || `j_${idx}`;
      const type = jn.getAttribute("type") || "";
      const shape = jn.getAttribute("shape") || "";
      const pts = shape
        .trim()
        .split(/\s+/)
        .map((pair) => pair.split(",").map((n) => parseFloat(n)))
        .filter((xy) => xy.length === 2 && xy.every((n) => Number.isFinite(n)))
        .map(([x, y]) => [y, x]);
      if (pts.length >= 3) {
        return { id, type, polygon: pts };
      }
      return null;
    })
    .filter(Boolean);

  // Junction centers (points) for fallback fill
  const junctionPoints = Array.from(doc.querySelectorAll("junction[x][y]"))
    .map((jn) => {
      const id = jn.getAttribute("id") || "";
      const x = parseFloat(jn.getAttribute("x"));
      const y = parseFloat(jn.getAttribute("y"));
      if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
      return { id, lat: y, lng: x };
    })
    .filter(Boolean);

  return { lanes: finalLanes, bounds, tls, junctions, junctionPoints };
}

self.onmessage = async (e) => {
  const { url } = e.data || {};
  if (!url) {
    self.postMessage({ type: "error", message: "No URL provided to worker" });
    return;
  }
  try {
    // Optional progress messages could be posted here for UI feedback
    const data = await parseXmlInWorker(url);
    self.postMessage({ type: "result", data });
  } catch (err) {
    self.postMessage({
      type: "error",
      message: err && err.message ? err.message : String(err),
    });
  }
};
