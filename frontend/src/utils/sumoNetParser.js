// Lightweight parser for SUMO .net.xml to render like Netedit (lane shapes in net coords)
// Usage: parseSumoNetXml("/Sumoconfigs/AddisAbaba.net.xml")
// Returns { lanes: [{ id, points: [[y,x], ...] }], bounds: { minX, minY, maxX, maxY } }

export async function parseSumoNetXml(url) {
  const res = await fetch(url, { credentials: "same-origin" });
  if (!res.ok) throw new Error(`Failed to load net file: ${res.status} ${res.statusText}`);
  const xmlText = await res.text();

  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlText, "application/xml");
  const parseErr = doc.querySelector("parsererror");
  if (parseErr) throw new Error("Invalid XML in net file");

  // Bounds from <location convBoundary="minX,minY,maxX,maxY" ... />
  const loc = doc.querySelector("location");
  let bounds = null;
  if (loc && loc.getAttribute("convBoundary")) {
    const parts = loc.getAttribute("convBoundary").split(",").map((n) => parseFloat(n));
    if (parts.length === 4 && parts.every((n) => Number.isFinite(n))) {
      bounds = { minX: parts[0], minY: parts[1], maxX: parts[2], maxY: parts[3] };
    }
  }

  // Lanes with a "shape" attribute contain polyline in net coordinates (x,y pairs separated by spaces)
  const laneNodes = Array.from(doc.querySelectorAll("edge > lane[shape], edge[type] > lane[shape], lane[shape]"));
  const lanes = laneNodes.map((lane, idx) => {
    const id = lane.getAttribute("id") || `lane_${idx}`;
    const shape = lane.getAttribute("shape") || "";
    // Example: "x1,y1 x2,y2 x3,y3"
    const points = shape
      .trim()
      .split(/\s+/)
      .map((pair) => pair.split(",").map((n) => parseFloat(n)))
      .filter((xy) => xy.length === 2 && xy.every((n) => Number.isFinite(n)))
      // Leaflet CRS.Simple uses lat=y, lng=x
      .map(([x, y]) => [y, x]);
    return { id, points };
  }).filter((l) => l.points.length >= 2);

  return { lanes, bounds };
}