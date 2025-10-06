import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  MapContainer,
  Marker,
  Popup,
  Polyline,
  Polygon,
  CircleMarker,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import PageLayout from "./PageLayout";
import "./TrafficMap.css";
import io from "socket.io-client";
import { useAuth } from "../contexts/AuthContext";
import { api } from "../utils/api";
import { parseSumoNetXml } from "../utils/sumoNetParser";
// Optional clustering: keep footprint tiny without extra deps by grouping by grid

// Fix for default markers in react-leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: require("leaflet/dist/images/marker-icon-2x.png"),
  iconUrl: require("leaflet/dist/images/marker-icon.png"),
  shadowUrl: require("leaflet/dist/images/marker-shadow.png"),
});

// Vehicle palette for variety
const VEHICLE_COLORS = [
  "#1976D2",
  "#E53935",
  "#8E24AA",
  "#00897B",
  "#FDD835",
  "#5E35B1",
  "#039BE5",
  "#FB8C00",
  "#43A047",
  "#6D4C41",
];

const getVehicleBaseColor = (id, type) => {
  if (type === "taxi") return "#FDD835";
  if (type === "bus") return "#1565C0";
  if (type === "truck") return "#546E7A";
  if (type === "ambulance") return "#E53935";
  if (type === "fire_truck") return "#B71C1C";
  const index =
    Math.abs(
      String(id)
        .split("")
        .reduce((a, c) => a + c.charCodeAt(0), 0)
    ) % VEHICLE_COLORS.length;
  return VEHICLE_COLORS[index];
};

// Create a simple, recognizable SVG for vehicles with rotation by heading
const createVehicleIcon = (vehicle) => {
  const { id, type = "sedan", angle = 0 } = vehicle || {};
  const color = getVehicleBaseColor(id, type);
  const bodyLength = type === "bus" ? 36 : type === "truck" ? 34 : 28;
  const bodyWidth = type === "bus" || type === "truck" ? 16 : 14;
  const wheelColor = "#222";
  const roofColor = "#ffffff";
  const stroke = "#111";
  const rotation = typeof angle === "number" ? angle : 0; // SUMO angle degrees

  const svg = `
    <svg width="44" height="44" viewBox="0 0 44 44" xmlns="http://www.w3.org/2000/svg" class="vehicle-icon">
      <g transform="translate(22,22) rotate(${rotation}) translate(-22,-22)">
        <!-- wheels -->
        <rect x="${22 - bodyWidth / 2 - 2}" y="${
    22 - bodyLength / 2 + 4
  }" width="4" height="10" rx="1" fill="${wheelColor}"/>
        <rect x="${22 + bodyWidth / 2 - 2}" y="${
    22 - bodyLength / 2 + 4
  }" width="4" height="10" rx="1" fill="${wheelColor}"/>
        <rect x="${22 - bodyWidth / 2 - 2}" y="${
    22 + bodyLength / 2 - 14
  }" width="4" height="10" rx="1" fill="${wheelColor}"/>
        <rect x="${22 + bodyWidth / 2 - 2}" y="${
    22 + bodyLength / 2 - 14
  }" width="4" height="10" rx="1" fill="${wheelColor}"/>
        <!-- body -->
        <rect x="${22 - bodyWidth / 2}" y="${
    22 - bodyLength / 2
  }" rx="3" ry="3" width="${bodyWidth}" height="${bodyLength}" fill="${color}" stroke="${stroke}" stroke-width="1"/>
        <!-- roof/windshield -->
        <rect x="${22 - (bodyWidth - 4) / 2}" y="${
    22 - bodyLength / 2 + 3
  }" width="${
    bodyWidth - 4
  }" height="10" rx="2" fill="${roofColor}" opacity="0.9"/>
        <!-- type marker -->
        ${
          type === "taxi"
            ? `<rect x="${22 - 6}" y="${
                22 - bodyLength / 2 + 1
              }" width="12" height="4" rx="1" fill="#111" />`
            : type === "bus"
            ? `<rect x="${22 - 8}" y="${
                22 - bodyLength / 2 + 1
              }" width="16" height="4" rx="1" fill="#0D47A1" />`
            : type === "truck" || type === "fire_truck"
            ? `<rect x="${22 - bodyWidth / 2}" y="${
                22 - 6
              }" width="${bodyWidth}" height="10" fill="#CFD8DC" stroke="#263238" stroke-width="1" />`
            : ""
        }
        <!-- direction arrow tip -->
        <polygon points="${22},${22 - bodyLength / 2 - 4} ${22 - 4},${
    22 - bodyLength / 2 + 2
  } ${22 + 4},${22 - bodyLength / 2 + 2}" fill="${stroke}" opacity="0.7"/>
      </g>
    </svg>
  `;

  return L.divIcon({
    className: "custom-traffic-icon",
    html: svg,
    iconSize: [44, 44],
    iconAnchor: [22, 22],
  });
};



// Fit helper for SUMO bounds (guarded to avoid repeated fits/loops)
const FitBoundsController = ({ bounds }) => {
  const map = useMap();
  const fittedKeyRef = useRef(null);
  useEffect(() => {
    if (!map || !bounds) return;
    try {
      const sw = bounds.getSouthWest();
      const ne = bounds.getNorthEast();
      const key = `${sw.lat},${sw.lng},${ne.lat},${ne.lng}`;
      if (fittedKeyRef.current === key) return;
      map.fitBounds(bounds, { padding: [20, 20], maxZoom: 20 });
      fittedKeyRef.current = key;
    } catch (_) {
      // ignore fit errors
    }
  }, [map, bounds]);
  return null;
};

const TrafficMap = () => {
  const [mapData, setMapData] = useState({
    intersections: [],
    vehicles: [],
    emergencyVehicles: [],
    trafficFlow: [],
    lanes: [],
    geoBounds: null,
    tls: [],
  });
  const [loading, setLoading] = useState(true);
  const [mapView, setMapView] = useState("traffic"); // traffic, emergency, maintenance
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [refreshInterval, setRefreshInterval] = useState(5000); // 5 seconds
  const socketRef = useRef(null);
  const { user } = useAuth();

  // SUMO Net (client-side .net.xml) view state
  const [sumoNetMode, setSumoNetMode] = useState(true);
  const [sumoNetData, setSumoNetData] = useState({ lanes: [], bounds: null, tls: [], junctions: [], junctionPoints: [] });
  const [simNetLanes, setSimNetLanes] = useState([]); // lanes from running simulation (XY -> CRS.Simple)
  const sumoMapRef = useRef(null);

  // Derive leaflet bounds from file bounds or from lane points if absent
  const sumoBounds = useMemo(() => {
    if (sumoNetData?.bounds) {
      const b = sumoNetData.bounds;
      return L.latLngBounds([b.minY, b.minX], [b.maxY, b.maxX]);
    }
    const lanes = sumoNetData?.lanes || [];
    if (!lanes.length) return null;
    let minLat = Infinity,
      minLng = Infinity,
      maxLat = -Infinity,
      maxLng = -Infinity;
    for (const lane of lanes) {
      for (const [lat, lng] of lane.points) {
        if (lat < minLat) minLat = lat;
        if (lng < minLng) minLng = lng;
        if (lat > maxLat) maxLat = lat;
        if (lng > maxLng) maxLng = lng;
      }
    }
    if (!isFinite(minLat) || !isFinite(minLng) || !isFinite(maxLat) || !isFinite(maxLng)) return null;
    return L.latLngBounds([minLat, minLng], [maxLat, maxLng]);
  }, [sumoNetData]);

  // Build edge geometries from backend-provided lon/lat lanes for tile rendering
  const edgeGeoms = useMemo(() => {
    const sourceLanes = Array.isArray(simNetLanes) && simNetLanes.length
      ? simNetLanes
      : (Array.isArray(sumoNetData.lanes) ? sumoNetData.lanes : []);
    const byEdge = new Map();
    for (const l of sourceLanes) {
      const key = l.edgeId || (typeof l.id === 'string' ? String(l.id).split('_').slice(0, -1).join('_') : l.id);
      if (!key) continue;
      const rec = byEdge.get(key) || { id: key, rep: null, speed: 0 };
      if (!rec.rep || (l.points?.length || 0) > (rec.rep.points?.length || 0)) rec.rep = l;
      if (typeof l.speed === 'number' && l.speed > rec.speed) rec.speed = l.speed;
      byEdge.set(key, rec);
    }
    return Array.from(byEdge.values())
      .filter((e) => e.rep && Array.isArray(e.rep.points) && e.rep.points.length >= 2)
      .map((e) => ({ id: e.id, points: e.rep.points, speedLimit: e.speed || 13.89 }));
  }, [simNetLanes, sumoNetData.lanes]);

  // Compute batches for rendering performance
  const edgeBatches = useMemo(() => {
    const all = edgeGeoms.map((e) => e.points);
    const batchSize = 2000; // number of edges per Polyline
    const batches = [];
    for (let i = 0; i < all.length; i += batchSize) batches.push(all.slice(i, i + batchSize));
    return batches;
  }, [edgeGeoms]);

  // Internal connector lanes to fill junctions
  const internalBatches = useMemo(() => {
    const lanes = Array.isArray(sumoNetData.lanes) ? sumoNetData.lanes : [];
    const internals = lanes.filter((l) => l.isInternal).map((l) => l.points);
    const batchSize = 2000;
    const batches = [];
    for (let i = 0; i < internals.length; i += batchSize) batches.push(internals.slice(i, i + batchSize));
    return batches;
  }, [sumoNetData.lanes]);

  // Live congestion map per edge from vehicles (avg speed vs limit)
  const [edgeCongestion, setEdgeCongestion] = useState({});

  // Batch congestion overlay into 3 MultiPolylines (green/orange/red) to avoid thousands of components
  const congestedClasses = useMemo(() => {
    const classes = { green: [], orange: [], red: [] };
    for (const e of edgeGeoms) {
      const avgSpeed = edgeCongestion[e.id];
      if (typeof avgSpeed !== 'number') continue;
      const limit = e.speedLimit || 13.89;
      const ratio = Math.max(0, Math.min(1, avgSpeed / Math.max(limit, 0.1)));
      if (ratio >= 0.7) classes.green.push(e.points);
      else if (ratio >= 0.4) classes.orange.push(e.points);
      else classes.red.push(e.points);
    }
    return classes;
  }, [edgeGeoms, edgeCongestion]);

  // Mock data for demonstration (fallback)
  const mockData = {
    intersections: [
      {
        id: "A1",
        name: "Main St & 1st Ave",
        lat: 9.0054,
        lng: 38.7636,
        status: "normal",
        queueLength: 12,
        signalState: "green",
        congestion: "low",
        lastUpdate: new Date(),
      },
      {
        id: "A2",
        name: "Main St & 2nd Ave",
        lat: 9.0064,
        lng: 38.7646,
        status: "congested",
        queueLength: 45,
        signalState: "red",
        congestion: "high",
        lastUpdate: new Date(),
      },
      {
        id: "A3",
        name: "Main St & 3rd Ave",
        lat: 9.0074,
        lng: 38.7656,
        status: "emergency",
        queueLength: 8,
        signalState: "green",
        congestion: "low",
        lastUpdate: new Date(),
      },
      {
        id: "B1",
        name: "Oak St & 1st Ave",
        lat: 9.0044,
        lng: 38.7626,
        status: "normal",
        queueLength: 23,
        signalState: "yellow",
        congestion: "medium",
        lastUpdate: new Date(),
      },
    ],
    vehicles: [
      {
        id: "V001",
        lat: 9.0052,
        lng: 38.7634,
        status: "normal",
        speed: 35,
        direction: "north",
        lastUpdate: new Date(),
      },
      {
        id: "V002",
        lat: 9.0062,
        lng: 38.7644,
        status: "congested",
        speed: 15,
        direction: "south",
        lastUpdate: new Date(),
      },
    ],
    emergencyVehicles: [
      {
        id: "E001",
        lat: 9.0072,
        lng: 38.7654,
        type: "ambulance",
        priority: "high",
        destination: "A3",
        eta: "2 min",
        lastUpdate: new Date(),
      },
      {
        id: "E002",
        lat: 9.0042,
        lng: 38.7624,
        type: "fire_truck",
        priority: "critical",
        destination: "B1",
        eta: "5 min",
        lastUpdate: new Date(),
      },
    ],
    trafficFlow: [
      {
        id: "F001",
        path: [
          [9.0054, 38.7636],
          [9.0064, 38.7646],
          [9.0074, 38.7656],
        ],
        intensity: "high",
        color: "#FF5722",
      },
    ],
  };

  // Define fetchMapData before any effects use it
  const fetchMapData = React.useCallback(async () => {
    try {
      setLoading(true);
      // Keep existing live data if any; only use mock as fallback when nothing has arrived yet
      setMapData((prev) => ({
        ...mockData,
        lanes: prev.lanes?.length ? prev.lanes : [],
        geoBounds: prev.geoBounds || null,
        vehicles: prev.vehicles?.length ? prev.vehicles : mockData.vehicles,
        tls: Array.isArray(prev.tls) ? prev.tls : [],
      }));
    } catch (error) {
      console.error("Error fetching map data:", error);
      window.dispatchEvent(
        new CustomEvent("notify", {
          detail: { type: "error", message: "Failed to refresh map" },
        })
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // initial fetch
    fetchMapData();

    // socket connection
    socketRef.current = io("http://localhost:5001");
    socketRef.current.emit("getStatus");

    // Network geometry (lanes) arrives first with type 'net'
    socketRef.current.on("viz", (payload) => {
      setMapData((prev) => {
        // payload from backend includes both 'net' (lanes) and 'viz' (vehicles)
        const next = { ...prev };
        if (payload.type === "net") {
          const lanes = Array.isArray(payload.lanes) ? payload.lanes : [];
          next.lanes = lanes
            .filter((l) => Array.isArray(l.lonlat) && l.lonlat.length >= 2)
            .map((l) => ({
              id: l.id,
              points: l.lonlat.map((p) => [p.lat, p.lon]),
              speed: l.speed,
              length: l.length,
            }));
          // Also derive CRS.Simple lanes from sim (use XY points)
          const xyLanes = lanes
            .filter((l) => Array.isArray(l.points) && l.points.length >= 2)
            .map((l) => {
              const deriveEdgeId = (laneId) => {
                if (typeof laneId !== 'string') return null;
                const parts = laneId.split('_');
                if (parts.length <= 1) return laneId;
                return parts.slice(0, -1).join('_');
              };
              const edgeId = deriveEdgeId(l.id);
              const pts = l.points.map((pt) => [pt.y, pt.x]); // CRS.Simple: [lat=y, lng=x]
              return { id: l.id, edgeId, points: pts, speed: l.speed };
            });
          setSimNetLanes(xyLanes);
          if (payload.geoBounds) next.geoBounds = payload.geoBounds;
        } else if (payload.type === "viz") {
          if (payload.vehicles) {
            // Vehicles include lat/lon when available; convert to Leaflet lat,lng
            const vehicles = payload.vehicles
              .filter((v) =>
                (typeof v.lat === "number" && typeof v.lon === "number") ||
                (typeof v.x === "number" && typeof v.y === "number")
              )
              .map((v) => ({
                id: v.id,
                // WGS84 for tile-based maps (not used in CRS.Simple)
                lat: typeof v.lat === "number" ? v.lat : undefined,
                lng: typeof v.lon === "number" ? v.lon : undefined,
                // Net coordinates for CRS.Simple (lat=y, lng=x)
                netLat: typeof v.y === "number" ? v.y : undefined,
                netLng: typeof v.x === "number" ? v.x : undefined,
                speed: v.speed,
                angle: v.angle,
                type: v.type,
                edgeId: v.edgeId,
                laneId: v.laneId,
              }));
            next.vehicles = vehicles;

            // Update congestion map by averaging speeds per edgeId
            const byEdge = new Map();
            for (const v of vehicles) {
              const eid = v.edgeId;
              if (!eid || typeof v.speed !== "number") continue;
              const rec = byEdge.get(eid) || { sum: 0, count: 0 };
              rec.sum += Math.max(v.speed, 0);
              rec.count += 1;
              byEdge.set(eid, rec);
            }
            const agg = {};
            for (const [eid, { sum, count }] of byEdge.entries()) {
              agg[eid] = sum / Math.max(count, 1);
            }
            setEdgeCongestion(agg);
          }
          if (payload.tls) {
            // Keep TLS state by ID regardless of coordinates; we will place them using net.xml geometry
            next.tls = payload.tls
              .filter((t) => t && typeof t.id === 'string')
              .map((t) => ({ id: t.id, state: t.state }));
          }
          // Optional future: tls/intersections mapping
        }
        return next;
      });
    });

    return () => {
      if (socketRef.current) socketRef.current.disconnect();
    };
  }, [fetchMapData]);

  useEffect(() => {
    if (autoRefresh) {
      const interval = setInterval(fetchMapData, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [autoRefresh, refreshInterval, fetchMapData]);


  // Load SUMO .net.xml from public folder and render with CRS.Simple (Netedit-like)
  const loadSumoNetLocal = async (path = "/Sumoconfigs/AddisAbaba.net.xml") => {
    try {
      setLoading(true);
      const data = await parseSumoNetXml(path);
      setSumoNetData(data);
      setSumoNetMode(true);
      window.dispatchEvent(
        new CustomEvent("notify", {
          detail: { type: "success", message: "Loaded SUMO network" },
        })
      );
    } catch (e) {
      console.error("Failed to load SUMO net:", e);
      window.dispatchEvent(
        new CustomEvent("notify", {
          detail: { type: "error", message: e.message || "Failed to load .net.xml" },
        })
      );
    } finally {
      setLoading(false);
    }
  };

  // Auto-load SUMO net on mount so Netedit-style map shows by default if file is present
  const loadSumoNetLocalCb = React.useCallback(loadSumoNetLocal, []);
  useEffect(() => {
    loadSumoNetLocalCb();
  }, [loadSumoNetLocalCb]);

  // Parse TLS state string into counts and percentages
  const summarizeTlsState = (stateStr) => {
    const s = String(stateStr || '').toLowerCase();
    let red = 0, yellow = 0, green = 0;
    for (const ch of s) {
      if (ch === 'r') red += 1;
      else if (ch === 'y') yellow += 1;
      else if (ch === 'g') green += 1;
      else if (ch === 'o') red += 1; // treat off as stop
    }
    const total = Math.max(1, red + yellow + green);
    return { red, yellow, green, total, redPct: red/total, yellowPct: yellow/total, greenPct: green/total };
  };

  // Dynamic TLS icon showing current phase distribution and state text
  const createTlsIconDynamic = (stateStr) => {
    const { redPct, yellowPct, greenPct } = summarizeTlsState(stateStr);
    const bar = (color, pct) => `<div style="height:4px;background:${color};width:${Math.max(8, Math.round(pct*16))}px;border-radius:2px"></div>`;
    const html = `
      <div style="display:flex;flex-direction:column;align-items:center;gap:2px;padding:2px 3px;background:rgba(0,0,0,0.55);border-radius:4px;color:#fff">
        <div style="display:flex;gap:2px;align-items:center;justify-content:center">
          ${bar('#D7263D', redPct)}
          ${bar('#FFC107', yellowPct)}
          ${bar('#25A244', greenPct)}
        </div>
        <div style="font:700 9px/10px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;letter-spacing:0.5px;opacity:0.95;white-space:nowrap;max-width:120px;overflow:hidden;text-overflow:ellipsis">
          ${String(stateStr || '').toUpperCase()}
        </div>
      </div>`;
    return L.divIcon({ className: 'tls-dynamic-icon', html, iconSize: [24, 20], iconAnchor: [12, 10] });
  };

  // Fallback emoji icon
  const tlsEmojiIcon = () => L.divIcon({ className: 'custom-traffic-icon', html: '<div style="font-size:18px; line-height:18px">🚦</div>', iconSize: [18, 18], iconAnchor: [9, 9] });





  return (
    <PageLayout
      title="Traffic Map"
      subtitle="Real-time traffic visualization and monitoring"
    >
      {/* Top Controls (moved outside container) */}
      <div className="map-controls">
          <div className="control-group">
            <label>View Mode:</label>
            <select
              value={mapView}
              onChange={(e) => setMapView(e.target.value)}
              className="control-select"
            >
              <option value="traffic">All Traffic</option>
              <option value="emergency">Emergency Only</option>
              <option value="maintenance">Maintenance</option>
            </select>
          </div>

          {/* Network Source removed: default to SUMO Net view */}

          {/* Simulation Controls moved from sidebar */}

          {(!sumoNetMode) && (
            <>
              <div className="control-group">
                <label>
                  <input
                    type="checkbox"
                    checked={autoRefresh}
                    onChange={(e) => setAutoRefresh(e.target.checked)}
                  />
                  Auto Refresh
                </label>
              </div>

              <div className="control-group">
                <label>Refresh Rate:</label>
                <select
                  value={refreshInterval}
                  onChange={(e) => setRefreshInterval(Number(e.target.value))}
                  className="control-select"
                  disabled={!autoRefresh}
                >
                  <option value={2000}>2 seconds</option>
                  <option value={5000}>5 seconds</option>
                  <option value={10000}>10 seconds</option>
                  <option value={30000}>30 seconds</option>
                </select>
              </div>

              <button
                onClick={fetchMapData}
                className="refresh-btn"
                disabled={loading}
              >
                {loading ? "🔄" : "🔄"} Refresh
              </button>
            </>
          )}
        </div>

      {/* Quick Top Stats */}
      <div className="top-stats">
        <div className="kpi">
          <span className="kpi-label">Total Intersections</span>
          <span className="kpi-value">{mapData.intersections.length}</span>
        </div>
        <div className="kpi">
          <span className="kpi-label">Congested</span>
          <span className="kpi-value">
            {mapData.intersections.filter((i) => i.status === "congested").length}
          </span>
        </div>
      </div>

      <div className="traffic-map-container">

        {/* Map Container */}
        <div className="map-wrapper" style={{ width: "100%" }}>
          <MapContainer
            key="sumo-net"
            crs={L.CRS.Simple}
            whenCreated={(m) => (sumoMapRef.current = m)}
            style={{ height: "100%", width: "100%" }}
            scrollWheelZoom={true}
            doubleClickZoom={true}
            zoomControl={true}
            zoomSnap={0.25}
            zoomDelta={0.5}
            minZoom={-5}
            maxZoom={24}
            preferCanvas={true}
          >
            {/* Fit to network bounds on mount/update */}
            {sumoBounds && <FitBoundsController bounds={sumoBounds} />}

            {/* Junction fill polygons (to cover intersection centers) */}
            {Array.isArray(sumoNetData.junctions) &&
              sumoNetData.junctions.map((j) => (
                <Polygon
                  key={`jpoly_${j.id}`}
                  positions={j.polygon}
                  pathOptions={{ color: "#9ea3a8", weight: 0, fillColor: "#9ea3a8", fillOpacity: 0.95 }}
                />
              ))}
            {/* Fallback: junction center disks to fill any remaining holes */}
            {Array.isArray(sumoNetData.junctionPoints) &&
              sumoNetData.junctionPoints.map((p) => (
                <CircleMarker
                  key={`jpt_${p.id}`}
                  center={[p.lat, p.lng]}
                  radius={6}
                  pathOptions={{ color: "#9ea3a8", weight: 0, fillColor: "#9ea3a8", fillOpacity: 0.95 }}
                />
              ))}

            {/* Internal connectors first to close junction gaps */}
            {internalBatches.map((batch, idx) => (
              <Polyline
                key={`internal_batch_${idx}`}
                positions={batch}
                color="#9ea3a8"
                weight={6}
                opacity={0.9}
                lineCap="round"
                lineJoin="round"
              />
            ))}

            {/* Base merged edges as thicker lines */}
            {edgeBatches.map((batch, idx) => (
              <Polyline
                key={`edge_batch_${idx}`}
                positions={batch}
                color="#9ea3a8"
                weight={6}
                opacity={0.85}
                lineCap="round"
                lineJoin="round"
              />
            ))}

            {/* Optional: overlay dynamic congestion color atop base edges (batched) */}
            {congestedClasses.green.length > 0 && (
              <Polyline positions={congestedClasses.green} color="#25A244" weight={6} opacity={0.9} lineCap="round" lineJoin="round" />
            )}
            {congestedClasses.orange.length > 0 && (
              <Polyline positions={congestedClasses.orange} color="#FB8C00" weight={6} opacity={0.9} lineCap="round" lineJoin="round" />
            )}
            {congestedClasses.red.length > 0 && (
              <Polyline positions={congestedClasses.red} color="#D7263D" weight={6} opacity={0.9} lineCap="round" lineJoin="round" />
            )}

            {/* TLS from .net.xml positions with live phase state from simulation */}
            {mapView === "traffic" && Array.isArray(sumoNetData.tls) && (() => {
              const liveMap = new Map((Array.isArray(mapData.tls) ? mapData.tls : []).map((t) => [t.id, t.state]));
              return sumoNetData.tls.map((t) => {
                const st = liveMap.get(t.id);
                const icon = st ? createTlsIconDynamic(st) : tlsEmojiIcon();
                return (
                  <Marker key={t.id} position={[t.lat, t.lng]} icon={icon}>
                    <Popup>
                      <div>
                        <strong>TLS {t.id}</strong>
                        {st ? <div>State: {st}</div> : null}
                      </div>
                    </Popup>
                  </Marker>
                );
              });
            })()}

            {/* Live vehicles from SUMO on CRS.Simple (use net coords y,x) */}
            {Array.isArray(mapData.vehicles) &&
              mapData.vehicles
                .filter((v) => typeof v.netLat === "number" && typeof v.netLng === "number")
                .map((v) => (
                  <Marker key={v.id} position={[v.netLat, v.netLng]} icon={createVehicleIcon(v)}>
                    <Popup>
                      <div>
                        <div><strong>Vehicle {v.id}</strong></div>
                        {typeof v.speed === "number" && <div>Speed: {v.speed.toFixed(1)} m/s</div>}
                        {typeof v.type === "string" && <div>Type: {v.type}</div>}
                      </div>
                    </Popup>
                  </Marker>
                ))}
          </MapContainer>
        </div>
      </div>

      {/* Bottom Info (Traffic Summary + Legend) */}
      <div style={{ width: "100%", marginTop: 12 }}>
        <div className="card shadow-card" style={{ padding: 12 }}>
          <div className="summary-stats">
              <div className="stat-item">
                <span className="stat-label">Total Intersections:</span>
                <span className="stat-value">
                  {mapData.intersections.length}
                </span>
              </div>
              <div className="stat-item">
                <span className="stat-label">Congested:</span>
                <span className="stat-value" style={{ color: "#F44336" }}>
                  {
                    mapData.intersections.filter((i) => i.status === "congested").length
                  }
                </span>
              </div>
              <div className="stat-item">
                <span className="stat-label">Emergency:</span>
                <span className="stat-value" style={{ color: "#9C27B0" }}>
                  {mapData.emergencyVehicles.length}
                </span>
              </div>
            </div>
            <div className="legend" style={{ marginTop: 12 }}>
              <div className="legend-item">
                <div className="legend-color" style={{ background: "#4CAF50" }}></div>
                <span>Normal Traffic</span>
              </div>
              <div className="legend-item">
                <div className="legend-color" style={{ background: "#FF9800" }}></div>
                <span>Congested</span>
              </div>
              <div className="legend-item">
                <div className="legend-color" style={{ background: "#F44336" }}></div>
                <span>Critical</span>
              </div>
              <div className="legend-item">
                <div className="legend-color" style={{ background: "#9C27B0" }}></div>
                <span>Emergency</span>
              </div>
            </div>
          </div>
        </div>
    </PageLayout>
  );
};

export default TrafficMap;
