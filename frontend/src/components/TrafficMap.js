import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  MapContainer,
  TileLayer,
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

// Intersection status icon (kept small, but modern look)
const createIntersectionIcon = (status) => {
  const colors = {
    normal: "#4CAF50",
    congested: "#FF9800",
    critical: "#F44336",
    emergency: "#9C27B0",
    maintenance: "#607D8B",
  };
  return L.divIcon({
    className: "custom-traffic-icon",
    html: `<div class="intersection-dot" style="background:${
      colors[status] || colors.normal
    }"></div>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  });
};

// Component to update map view based on data
const MapController = ({ intersections, lanes, geoBounds }) => {
  const map = useMap();

  useEffect(() => {
    // Prefer SUMO geo bounds when available
    if (
      geoBounds &&
      typeof geoBounds.minLat === "number" &&
      typeof geoBounds.minLon === "number" &&
      typeof geoBounds.maxLat === "number" &&
      typeof geoBounds.maxLon === "number"
    ) {
      const bounds = L.latLngBounds(
        [geoBounds.minLat, geoBounds.minLon],
        [geoBounds.maxLat, geoBounds.maxLon]
      );
      map.fitBounds(bounds, { padding: [20, 20] });
      return;
    }

    // Fallback: fit to lanes
    if (lanes && lanes.length > 0) {
      const allPoints = lanes.flatMap((l) => l.points);
      const bounds = L.latLngBounds(allPoints);
      map.fitBounds(bounds, { padding: [20, 20] });
      return;
    }

    // Fallback: fit to intersections demo data
    if (intersections.length > 0) {
      const bounds = L.latLngBounds(
        intersections.map((intersection) => [
          intersection.lat,
          intersection.lng,
        ])
      );
      map.fitBounds(bounds, { padding: [20, 20] });
    }
  }, [intersections, lanes, geoBounds, map]);

  return null;
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
  const [selectedIntersection, setSelectedIntersection] = useState(null);
  const [mapView, setMapView] = useState("traffic"); // traffic, emergency, maintenance
  const [dataMode, setDataMode] = useState("simulation"); // simulation | real
  const [areaBbox, setAreaBbox] = useState({
    minLat: 8.85,
    minLon: 38.6,
    maxLat: 9.15,
    maxLon: 38.9,
  });
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [refreshInterval, setRefreshInterval] = useState(5000); // 5 seconds
  const socketRef = useRef(null);
  const { user } = useAuth();
  const [showDensity, setShowDensity] = useState(true);

  // SUMO Net (client-side .net.xml) view state
  const [sumoNetMode, setSumoNetMode] = useState(true);
  const [sumoNetData, setSumoNetData] = useState({ lanes: [], bounds: null, tls: [], junctions: [], junctionPoints: [] });
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

  // Build merged "edge" geometries from lanes to emulate thicker Google-like roads
  const edgeGeoms = useMemo(() => {
    const lanes = Array.isArray(sumoNetData.lanes) ? sumoNetData.lanes : [];
    const byEdge = new Map();
    for (const l of lanes) {
      const key = l.edgeId || (typeof l.id === 'string' ? String(l.id).split('_')[0] : l.id);
      if (!key) continue;
      const rec = byEdge.get(key) || { id: key, rep: null, speed: 0 };
      // choose representative with most points
      if (!rec.rep || (l.points?.length || 0) > (rec.rep.points?.length || 0)) rec.rep = l;
      if (typeof l.speed === 'number' && l.speed > rec.speed) rec.speed = l.speed; // speed limit approx
      byEdge.set(key, rec);
    }
    const edges = Array.from(byEdge.values())
      .filter((e) => e.rep && Array.isArray(e.rep.points) && e.rep.points.length >= 2)
      .map((e) => ({ id: e.id, points: e.rep.points, speedLimit: e.speed || 13.89 }));
    return edges;
  }, [sumoNetData.lanes]);

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

  useEffect(() => {
    // initial fetch
    fetchMapData();
    // load map settings
    api
      .getMapSettings()
      .then((s) => {
        if (s?.mode) setDataMode(s.mode);
        if (
          s?.bbox &&
          typeof s.bbox.minLat === "number" &&
          typeof s.bbox.minLon === "number" &&
          typeof s.bbox.maxLat === "number" &&
          typeof s.bbox.maxLon === "number"
        ) {
          setAreaBbox(s.bbox);
        }
      })
      .catch(() => {});

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
            next.tls = payload.tls
              .filter(
                (t) => typeof t.lat === "number" && typeof t.lon === "number"
              )
              .map((t) => ({
                id: t.id,
                lat: t.lat,
                lng: t.lon,
                state: t.state,
              }));
          }
          // Optional future: tls/intersections mapping
        }
        return next;
      });
    });

    return () => {
      if (socketRef.current) socketRef.current.disconnect();
    };
  }, []);

  useEffect(() => {
    if (autoRefresh) {
      const interval = setInterval(fetchMapData, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [autoRefresh, refreshInterval]);

  const fetchMapData = async () => {
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
  };

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
  useEffect(() => {
    loadSumoNetLocal();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleIntersectionClick = (intersection) => {
    setSelectedIntersection(intersection);
  };

  const getCongestionColor = (level) => {
    switch (level) {
      case "high":
        return "#F44336";
      case "medium":
        return "#FF9800";
      case "low":
        return "#4CAF50";
      default:
        return "#9E9E9E";
    }
  };

  const getTrafficFlowColor = (intensity) => {
    switch (intensity) {
      case "high":
        return "#F44336";
      case "medium":
        return "#FF9800";
      case "low":
        return "#4CAF50";
      default:
        return "#9E9E9E";
    }
  };

  // Simple emoji-based traffic light icon
  const tlsEmojiIcon = () =>
    L.divIcon({
      className: "custom-traffic-icon",
      html: '<div style="font-size:18px; line-height:18px">🚦</div>',
      iconSize: [18, 18],
      iconAnchor: [9, 9],
    });

  // Lightweight clustering by rounding coordinates into grid cells
  const clusterVehicles = (vehicles, gridSizeDeg = 0.0015) => {
    if (!Array.isArray(vehicles) || vehicles.length < 200) return vehicles;
    const cellKey = (lat, lon) =>
      `${Math.round(lat / gridSizeDeg)}:${Math.round(lon / gridSizeDeg)}`;
    const cells = new Map();
    for (const v of vehicles) {
      const key = cellKey(v.lat, v.lng);
      const cell = cells.get(key) || { lat: 0, lng: 0, count: 0 };
      cell.lat += v.lat;
      cell.lng += v.lng;
      cell.count += 1;
      cells.set(key, cell);
    }
    return Array.from(cells.entries()).map(([key, c], idx) => ({
      id: `cluster_${idx}`,
      lat: c.lat / c.count,
      lng: c.lng / c.count,
      type: "cluster",
      count: c.count,
    }));
  };

  const totals = {
    vehicles: mapData.vehicles.length,
    tls: Array.isArray(mapData.tls) ? mapData.tls.length : 0,
  };
  const tlsCounts = Array.isArray(mapData.tls)
    ? mapData.tls.reduce(
        (acc, t) => {
          const s = String(t.state || "").toLowerCase();
          if (s.includes("r")) acc.red += 1;
          if (s.includes("y")) acc.yellow += 1;
          if (s.includes("g")) acc.green += 1;
          return acc;
        },
        { red: 0, yellow: 0, green: 0 }
      )
    : { red: 0, yellow: 0, green: 0 };

  const clusterColor = (count) => {
    if (count >= 200) return "#b71c1c"; // very high
    if (count >= 100) return "#e53935";
    if (count >= 50) return "#fb8c00";
    if (count >= 20) return "#fdd835";
    return "#43a047";
  };

  const canManualOverride =
    user?.role === "admin" || user?.role === "super_admin";
  const manualOverride = async (intersection) => {
    if (!canManualOverride) return;
    if (!window.confirm(`Force green at ${intersection.name}?`)) return;
    try {
      await api.overrideIntersection(intersection.id, {
        desiredState: "green",
        durationSec: 15,
      });
      window.dispatchEvent(
        new CustomEvent("notify", {
          detail: {
            type: "success",
            message: `Override sent for ${intersection.name}`,
          },
        })
      );
    } catch (e) {
      window.dispatchEvent(
        new CustomEvent("notify", {
          detail: {
            type: "error",
            message: `Failed to override ${intersection.name}`,
          },
        })
      );
    }
  };

  const filteredIntersections = mapData.intersections.filter((intersection) => {
    if (mapView === "emergency") return intersection.status === "emergency";
    if (mapView === "maintenance") return intersection.status === "maintenance";
    return true;
  });

  const addisCenter = [9.03, 38.74];
  const addisZoom = 12;

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

            {/* Traffic Lights from .net.xml (junctions) */}
            {mapView === "traffic" && Array.isArray(sumoNetData.tls) &&
              sumoNetData.tls.map((t) => (
                <Marker key={t.id} position={[t.lat, t.lng]} icon={tlsEmojiIcon()}>
                  <Popup>
                    <div>
                      <strong>TLS {t.id}</strong>
                    </div>
                  </Popup>
                </Marker>
              ))}

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
