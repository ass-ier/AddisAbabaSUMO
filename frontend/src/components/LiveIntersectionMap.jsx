import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { MapContainer, Polyline, Polygon, CircleMarker, Marker, useMap } from "react-leaflet";
import L from "leaflet";
import io from "socket.io-client";
import { parseSumoNetXml } from "../utils/sumoNetParser";
import { BASE_API } from "../utils/api";
import "leaflet/dist/leaflet.css";

// Ensure default marker assets load if ever used
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: require("leaflet/dist/images/marker-icon-2x.png"),
  iconUrl: require("leaflet/dist/images/marker-icon.png"),
  shadowUrl: require("leaflet/dist/images/marker-shadow.png"),
});

const FitBoundsController = ({ bounds }) => {
  const map = useMap();
  const keyRef = useRef(null);
  useEffect(() => {
    if (!map || !bounds) return;
    const sw = bounds.getSouthWest();
    const ne = bounds.getNorthEast();
    const key = `${sw.lat},${sw.lng},${ne.lat},${ne.lng}`;
    if (keyRef.current === key) return;
    map.fitBounds(bounds, { padding: [20, 20], maxZoom: 20 });
    keyRef.current = key;
  }, [map, bounds]);
  return null;
};

// Simple 2D triangle icon pointing in vehicle heading (angle degrees)
const triangleIcon = (angleDeg = 0, color = "#1976D2", size = 16) => {
  const half = size / 2;
  const html = `
    <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
      <g transform="translate(${half},${half}) rotate(${angleDeg}) translate(-${half},-${half})">
        <polygon points="${half},2 2,${size - 2} ${size - 2},${size - 2}" fill="${color}" stroke="#111" stroke-width="1" />
      </g>
    </svg>
  `;
  return L.divIcon({ className: "vehicle-triangle", html, iconSize: [size, size], iconAnchor: [half, half] });
};

function withinBounds([lat, lng], b) {
  if (!b) return false;
  const sw = b.getSouthWest();
  const ne = b.getNorthEast();
  return lat >= sw.lat && lat <= ne.lat && lng >= sw.lng && lng <= ne.lng;
}

const LiveIntersectionMap = ({ intersectionId, paddingMeters = 120, height = 380, onStats }) => {
  const [net, setNet] = useState({ lanes: [], junctions: [], junctionPoints: [], tls: [], bounds: null });
  const [viewBounds, setViewBounds] = useState(null);
  const [lanesInView, setLanesInView] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [simNetLanes, setSimNetLanes] = useState([]); // lanes from live sim (CRS.Simple)
  const socketRef = useRef(null);
  const mapRef = useRef(null);

  // Load SUMO net once
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const data = await parseSumoNetXml("/Sumoconfigs/AddisAbaba.net.xml");
        if (!mounted) return;
        setNet(data || { lanes: [], junctions: [], junctionPoints: [], tls: [], bounds: null });
      } catch (e) {
        console.error("Failed to parse SUMO net:", e);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  // Compute focus bounds around intersectionId with padding
  useEffect(() => {
    if (!intersectionId || !Array.isArray(net.tls)) return;
    const t = net.tls.find((x) => String(x.id) === String(intersectionId));
    if (!t) return;
    const pad = Math.max(20, Number(paddingMeters) || 120);
    const b = L.latLngBounds([t.lat - pad, t.lng - pad], [t.lat + pad, t.lng + pad]);
    setViewBounds(b);
  }, [intersectionId, net.tls, paddingMeters]);

  // Filter lanes to those intersecting view bounds to keep it light
  useEffect(() => {
    if (!viewBounds || !Array.isArray(net.lanes)) {
      setLanesInView([]);
      return;
    }
    const filtered = net.lanes.filter((l) =>
      l.points && l.points.some((p) => withinBounds(p, viewBounds))
    );
    setLanesInView(filtered);
  }, [net.lanes, viewBounds]);

  // Socket for live viz data (vehicles) and network lanes
  useEffect(() => {
    if (!intersectionId) return;
    socketRef.current = io(BASE_API, { transports: ["websocket", "polling"] });

    const handlePayload = (payload) => {
      if (!payload || typeof payload !== "object") return;
      if (payload.type === "viz") {
        const arr = Array.isArray(payload.vehicles) ? payload.vehicles : [];
        const vs = arr
          .map((v) => ({
            id: v.id,
            netLat: typeof v.y === "number" ? v.y : v.netLat,
            netLng: typeof v.x === "number" ? v.x : v.netLng,
            speed: typeof v.speed === "number" ? v.speed : 0,
            angle: typeof v.angle === "number" ? v.angle : 0,
            type: v.type || "car",
            edgeId: v.edgeId,
            laneId: v.laneId,
          }))
          .filter((v) => Number.isFinite(v.netLat) && Number.isFinite(v.netLng));
        setVehicles(vs);
      } else if (payload.type === "net" && Array.isArray(payload.lanes)) {
        const xyLanes = payload.lanes
          .filter((l) => Array.isArray(l.points) && l.points.length >= 2)
          .map((l) => {
            const deriveEdgeId = (laneId) => {
              if (typeof laneId !== "string") return null;
              const parts = laneId.split("_");
              if (parts.length <= 1) return laneId;
              return parts.slice(0, -1).join("_");
            };
            const edgeId = deriveEdgeId(l.id);
            const pts = l.points.map((pt) => [pt.y, pt.x]);
            return { id: l.id, edgeId, points: pts, speed: l.speed };
          });
        setSimNetLanes(xyLanes);
      }
    };

    socketRef.current.on("sumoData", handlePayload);
    socketRef.current.on("viz", handlePayload);
    socketRef.current.on("sumoNet", handlePayload);

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, [intersectionId]);

  // Compute visible vehicles and basic stats, and notify parent
  const visible = useMemo(() => {
    if (!viewBounds) return [];
    return vehicles.filter((v) => withinBounds([v.netLat, v.netLng], viewBounds));
  }, [vehicles, viewBounds]);

  useEffect(() => {
    if (typeof onStats === "function") {
      const count = visible.length;
      const avgSpeed = count
        ? visible.reduce((s, v) => s + (v.speed || 0), 0) / count
        : 0;
      onStats({ visibleVehicles: count, avgSpeedMs: avgSpeed });
    }
  }, [visible, onStats]);

  // Match TrafficMap rendering: build edge geoms and internal batches, then congestion overlay
  const edgeGeoms = useMemo(() => {
    const source = simNetLanes.length ? simNetLanes : (Array.isArray(net.lanes) ? net.lanes : []);
    const byEdge = new Map();
    for (const l of source) {
      const key = l.edgeId || (typeof l.id === "string" ? String(l.id).split("_").slice(0, -1).join("_") : l.id);
      if (!key) continue;
      const rec = byEdge.get(key) || { id: key, rep: null, speed: 0 };
      if (!rec.rep || (l.points?.length || 0) > (rec.rep.points?.length || 0)) rec.rep = l;
      if (typeof l.speed === "number" && l.speed > rec.speed) rec.speed = l.speed;
      byEdge.set(key, rec);
    }
    return Array.from(byEdge.values())
      .filter((e) => e.rep && Array.isArray(e.rep.points) && e.rep.points.length >= 2)
      .map((e) => ({ id: e.id, points: e.rep.points, speedLimit: e.speed || 13.89 }));
  }, [simNetLanes, net.lanes]);

  const internalBatches = useMemo(() => {
    const lanes = Array.isArray(net.lanes) ? net.lanes : [];
    const internals = lanes.filter((l) => l.isInternal && l.points && l.points.length >= 2);
    if (internals.length === 0) return [];
    const filtered = internals.filter((l) => l.points.some((p) => withinBounds(p, viewBounds)));
    const pts = filtered.map((l) => l.points);
    const batchSize = 300;
    const batches = [];
    for (let i = 0; i < pts.length; i += batchSize) batches.push(pts.slice(i, i + batchSize));
    return batches;
  }, [net.lanes, viewBounds]);

  const edgeBatches = useMemo(() => {
    if (!edgeGeoms.length) return [];
    const filtered = edgeGeoms.filter((e) => e.points?.some((p) => withinBounds(p, viewBounds)));
    const all = filtered.map((e) => e.points);
    const batchSize = 500;
    const batches = [];
    for (let i = 0; i < all.length; i += batchSize) batches.push(all.slice(i, i + batchSize));
    return batches;
  }, [edgeGeoms, viewBounds]);

  // Congestion overlay classes (like TrafficMap)
  const congestedClasses = useMemo(() => {
    const classes = { green: [], yellow: [], red: [], default: [] };
    const vehicleCount = new Map();
    for (const v of visible) {
      const eid = v.edgeId || v.laneId;
      if (!eid) continue;
      const actualEdgeId = typeof eid === "string" && eid.includes("_") ? eid.substring(0, eid.lastIndexOf("_")) : eid;
      vehicleCount.set(actualEdgeId, (vehicleCount.get(actualEdgeId) || 0) + 1);
    }
    for (const e of edgeGeoms) {
      if (!e.points?.some((p) => withinBounds(p, viewBounds))) continue;
      const count = vehicleCount.get(e.id) || 0;
      if (count === 0) {
        classes.default.push(e.points);
      } else if (count >= 6) {
        classes.red.push(e.points);
      } else if (count >= 3) {
        classes.yellow.push(e.points);
      } else {
        classes.green.push(e.points);
      }
    }
    return classes;
  }, [edgeGeoms, visible, viewBounds]);

  const mapStyle = { height, width: "100%", borderRadius: 12, overflow: "hidden" };

  return (
    <div className="live-intersection-map" style={{ background: "var(--card)", padding: 12, borderRadius: 12 }}>
      <div style={mapStyle}>
        <MapContainer
          whenCreated={(m) => (mapRef.current = m)}
          crs={L.CRS.Simple}
          style={{ height: "100%", width: "100%" }}
          scrollWheelZoom
          doubleClickZoom
          zoomControl
          zoomSnap={0.25}
          zoomDelta={0.5}
          minZoom={-5}
          maxZoom={24}
          preferCanvas
        >
          {viewBounds && <FitBoundsController bounds={viewBounds} />}

          {/* Junction fill polygons */}
          {Array.isArray(net.junctions) &&
            net.junctions
              .filter((j) => j.polygon?.some((p) => withinBounds(p, viewBounds)))
              .map((j) => (
                <Polygon key={`j_${j.id}`} positions={j.polygon} pathOptions={{ color: "#9ea3a8", weight: 0, fillColor: "#9ea3a8", fillOpacity: 0.95 }} />
              ))}
          {/* Fallback junction points */}
          {Array.isArray(net.junctionPoints) &&
            net.junctionPoints
              .filter((p) => withinBounds([p.lat, p.lng], viewBounds))
              .map((p) => (
                <CircleMarker key={`jp_${p.id}`} center={[p.lat, p.lng]} radius={6} pathOptions={{ color: "#9ea3a8", weight: 0, fillColor: "#9ea3a8", fillOpacity: 0.95 }} />
              ))}

          {/* Internal connectors first */}
          {internalBatches.map((batch, idx) => (
            <Polyline key={`internal_${idx}`} positions={batch} color="#9ea3a8" weight={6} opacity={0.9} lineCap="round" lineJoin="round" />
          ))}

          {/* Base merged edges */}
          {edgeBatches.map((batch, idx) => (
            <Polyline key={`edge_${idx}`} positions={batch} color="#9ea3a8" weight={6} opacity={0.85} lineCap="round" lineJoin="round" />
          ))}

          {/* Congestion overlay (same coloring) */}
          {congestedClasses.default.length > 0 && (
            <Polyline positions={congestedClasses.default} color="#4CAF50" weight={6} opacity={0.7} lineCap="round" lineJoin="round" />
          )}
          {congestedClasses.green.length > 0 && (
            <Polyline positions={congestedClasses.green} color="#4CAF50" weight={6} opacity={0.9} lineCap="round" lineJoin="round" />
          )}
          {congestedClasses.yellow.length > 0 && (
            <Polyline positions={congestedClasses.yellow} color="#FFC107" weight={6} opacity={0.9} lineCap="round" lineJoin="round" />
          )}
          {congestedClasses.red.length > 0 && (
            <Polyline positions={congestedClasses.red} color="#F44336" weight={6} opacity={0.9} lineCap="round" lineJoin="round" />
          )}

          {/* Vehicles as triangles */}
          {visible.map((v) => (
            <Marker key={v.id} position={[v.netLat, v.netLng]} icon={triangleIcon(v.angle, "#1976D2", 16)} />
          ))}
        </MapContainer>
      </div>
    </div>
  );
};

export default LiveIntersectionMap;