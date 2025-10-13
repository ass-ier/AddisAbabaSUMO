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
import TrafficLightModal from "./TrafficLightModal";
import { TrafficLightPhasePreview } from "./TrafficLightPhaseViz";
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

// Create emergency vehicle icon with distinctive styling and emergency flashers
const createEmergencyVehicleIcon = (vehicle) => {
  const { type = "ambulance", angle = 0 } = vehicle || {};
  const rotation = typeof angle === "number" ? angle : 0;

  const getEmergencyConfig = () => {
    switch (type) {
      case "ambulance":
        return {
          color: "#FFFFFF",
          accent: "#E53935",
          symbol: "🚑",
          label: "AMB",
        };
      case "fire_truck":
        return {
          color: "#B71C1C",
          accent: "#FFEB3B",
          symbol: "🚒",
          label: "FIRE",
        };
      case "police":
        return {
          color: "#1565C0",
          accent: "#FFFFFF",
          symbol: "🚓",
          label: "POL",
        };
      default:
        return {
          color: "#E53935",
          accent: "#FFFFFF",
          symbol: "🚨",
          label: "EMR",
        };
    }
  };

  const config = getEmergencyConfig();

  const svg = `
    <svg width="48" height="48" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg" class="emergency-vehicle-icon">
      <defs>
        <filter id="glow">
          <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
          <feMerge> 
            <feMergeNode in="coloredBlur"/>
            <feMergeNode in="SourceGraphic"/> 
          </feMerge>
        </filter>
        <style>
          .flasher { 
            animation: emergency-flash 1s infinite alternate;
          }
          @keyframes emergency-flash {
            0% { opacity: 0.3; }
            100% { opacity: 1; }
          }
        </style>
      </defs>
      
      <g transform="translate(24,24) rotate(${rotation}) translate(-24,-24)">
        <!-- Vehicle shadow -->
        <ellipse cx="24" cy="26" rx="18" ry="8" fill="rgba(0,0,0,0.2)" />
        
        <!-- Main vehicle body -->
        <rect x="14" y="8" width="20" height="32" rx="4" ry="4" 
              fill="${config.color}" stroke="#333" stroke-width="2" filter="url(#glow)"/>
        
        <!-- Emergency light bars (flashing) -->
        <rect x="12" y="6" width="24" height="4" rx="2" ry="2" 
              fill="${config.accent}" class="flasher" opacity="0.8"/>
        <rect x="12" y="38" width="24" height="4" rx="2" ry="2" 
              fill="${config.accent}" class="flasher" opacity="0.8"/>
        
        <!-- Side emergency lights -->
        <circle cx="12" cy="18" r="3" fill="${config.accent}" class="flasher" opacity="0.9"/>
        <circle cx="36" cy="18" r="3" fill="${config.accent}" class="flasher" opacity="0.9"/>
        <circle cx="12" cy="30" r="3" fill="${config.accent}" class="flasher" opacity="0.9"/>
        <circle cx="36" cy="30" r="3" fill="${config.accent}" class="flasher" opacity="0.9"/>
        
        <!-- Vehicle details -->
        <rect x="16" y="12" width="16" height="8" rx="2" fill="rgba(255,255,255,0.8)" />
        <text x="24" y="18" text-anchor="middle" font-family="Arial, sans-serif" 
              font-size="8" font-weight="bold" fill="#333">${config.label}</text>
        
        <!-- Direction indicator -->
        <polygon points="24,4 20,10 28,10" fill="#333" opacity="0.7"/>
        
        <!-- Priority symbol -->
        <circle cx="39" cy="9" r="6" fill="#E53935" stroke="#FFF" stroke-width="1"/>
        <text x="39" y="13" text-anchor="middle" font-family="Arial, sans-serif" 
              font-size="8" font-weight="bold" fill="#FFF">!</text>
      </g>
    </svg>
  `;

  return L.divIcon({
    className: "emergency-vehicle-icon",
    html: svg,
    iconSize: [48, 48],
    iconAnchor: [24, 24],
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
  // Initialize mapData with safe defaults to prevent undefined errors
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
  const canOverride = !!(
    user &&
    (user.role === "super_admin" || user.role === "operator")
  );

  // Traffic light modal state
  const [selectedTlsId, setSelectedTlsId] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // SUMO Net (client-side .net.xml) view state
  const [sumoNetMode, setSumoNetMode] = useState(true);
  const [sumoNetData, setSumoNetData] = useState({
    lanes: [],
    bounds: null,
    tls: [],
    junctions: [],
    junctionPoints: [],
  });
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
    if (
      !isFinite(minLat) ||
      !isFinite(minLng) ||
      !isFinite(maxLat) ||
      !isFinite(maxLng)
    )
      return null;
    return L.latLngBounds([minLat, minLng], [maxLat, maxLng]);
  }, [sumoNetData]);

  // Build edge geometries from backend-provided lon/lat lanes for tile rendering
  const edgeGeoms = useMemo(() => {
    const sourceLanes =
      Array.isArray(simNetLanes) && simNetLanes.length
        ? simNetLanes
        : Array.isArray(sumoNetData.lanes)
          ? sumoNetData.lanes
          : [];
    const byEdge = new Map();
    for (const l of sourceLanes) {
      const key =
        l.edgeId ||
        (typeof l.id === "string"
          ? String(l.id).split("_").slice(0, -1).join("_")
          : l.id);
      if (!key) continue;
      const rec = byEdge.get(key) || { id: key, rep: null, speed: 0 };
      if (!rec.rep || (l.points?.length || 0) > (rec.rep.points?.length || 0))
        rec.rep = l;
      if (typeof l.speed === "number" && l.speed > rec.speed)
        rec.speed = l.speed;
      byEdge.set(key, rec);
    }
    return Array.from(byEdge.values())
      .filter(
        (e) => e.rep && Array.isArray(e.rep.points) && e.rep.points.length >= 2
      )
      .map((e) => ({
        id: e.id,
        points: e.rep.points,
        speedLimit: e.speed || 13.89,
      }));
  }, [simNetLanes, sumoNetData.lanes]);

  // Compute batches for rendering performance (optimized)
  const edgeBatches = useMemo(() => {
    if (edgeGeoms.length === 0) return [];

    const all = edgeGeoms.map((e) => e.points);
    const batchSize = 500; // Reduced batch size for better performance
    const batches = [];
    for (let i = 0; i < all.length; i += batchSize) {
      batches.push(all.slice(i, i + batchSize));
    }
    return batches;
  }, [edgeGeoms]);

  // Fast lookup of lane geometries by lane id (from .net.xml parsed data)
  const laneGeomsById = useMemo(() => {
    const m = new Map();
    const lanes = Array.isArray(sumoNetData.lanes) ? sumoNetData.lanes : [];
    for (const l of lanes) {
      if (l && typeof l.id === "string" && Array.isArray(l.points))
        m.set(l.id, l.points);
    }
    return m;
  }, [sumoNetData.lanes]);

  // Internal connector lanes to fill junctions (optimized)
  const internalBatches = useMemo(() => {
    const lanes = Array.isArray(sumoNetData.lanes) ? sumoNetData.lanes : [];
    if (lanes.length === 0) return [];

    const internals = lanes.filter((l) => l.isInternal).map((l) => l.points);
    const batchSize = 300; // Smaller batches for better performance
    const batches = [];
    for (let i = 0; i < internals.length; i += batchSize) {
      batches.push(internals.slice(i, i + batchSize));
    }
    return batches;
  }, [sumoNetData.lanes]);

  // Live congestion map per edge from vehicle count (with throttling)
  const [edgeCongestion, setEdgeCongestion] = useState(new Map()); // Use Map for better performance
  const lastUpdateRef = useRef(0);
  const UPDATE_THROTTLE = 500; // Update every 500ms max

  // Enhanced congestion overlay - classify roads by vehicle count (green = light traffic, yellow = moderate, red = heavy)
  const congestedClasses = useMemo(() => {
    const classes = { green: [], yellow: [], red: [], default: [] };

    for (const e of edgeGeoms) {
      const vehicleCount =
        edgeCongestion.get?.(e.id) ||
        (typeof edgeCongestion === "object" ? edgeCongestion[e.id] : 0);

      // If no vehicles on this edge yet, show as default green (open road)
      if (typeof vehicleCount !== "number" || vehicleCount === 0) {
        classes.default.push(e.points);
        continue;
      }

      // Vehicle count thresholds for congestion levels (adjusted for responsiveness):
      // Green: 1-2 vehicles (light traffic)
      // Yellow: 3-5 vehicles (moderate traffic)
      // Red: 6+ vehicles (heavy traffic/congestion)
      if (vehicleCount >= 6) {
        classes.red.push(e.points);
      } else if (vehicleCount >= 3) {
        classes.yellow.push(e.points);
      } else {
        classes.green.push(e.points);
      }
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
      setMapData((prev) => {
        // Ensure prev is never undefined
        const prevData = prev || {
          intersections: [],
          vehicles: [],
          emergencyVehicles: [],
          trafficFlow: [],
          lanes: [],
          geoBounds: null,
          tls: [],
        };

        return {
          ...mockData,
          lanes: prevData.lanes?.length ? prevData.lanes : [],
          geoBounds: prevData.geoBounds || null,
          vehicles: prevData.vehicles?.length
            ? prevData.vehicles
            : mockData.vehicles,
          tls: Array.isArray(prevData.tls) ? prevData.tls : [],
        };
      });
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
        // Ensure prev is never undefined
        const prevData = prev || {
          intersections: [],
          vehicles: [],
          emergencyVehicles: [],
          trafficFlow: [],
          lanes: [],
          geoBounds: null,
          tls: [],
        };

        // payload from backend includes both 'net' (lanes) and 'viz' (vehicles)
        const next = { ...prevData };
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
                if (typeof laneId !== "string") return null;
                const parts = laneId.split("_");
                if (parts.length <= 1) return laneId;
                return parts.slice(0, -1).join("_");
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
              .filter(
                (v) =>
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

            // Update congestion map by counting vehicles per edgeId (optimized with throttling)
            const now = Date.now();
            if (now - lastUpdateRef.current < UPDATE_THROTTLE) {
              return; // Skip update if too frequent
            }
            lastUpdateRef.current = now;

            const vehicleCount = new Map();

            for (const v of vehicles) {
              // Try multiple possible edge ID fields
              const eid = v.edgeId || v.laneId;
              if (!eid) continue;

              // Extract edge ID from lane ID if needed (format: edgeId_laneNumber)
              const actualEdgeId =
                typeof eid === "string" && eid.includes("_")
                  ? eid.substring(0, eid.lastIndexOf("_"))
                  : eid;

              vehicleCount.set(
                actualEdgeId,
                (vehicleCount.get(actualEdgeId) || 0) + 1
              );
            }

            // Use Map directly for better performance
            setEdgeCongestion(vehicleCount);
          }
          if (payload.tls) {
            // Keep TLS state by ID regardless of coordinates; include per-side summary and timing/program if provided
            next.tls = payload.tls
              .filter((t) => t && typeof t.id === "string")
              .map((t) => ({
                id: t.id,
                state: t.state,
                sides: t.sides,
                turns: t.turns,
                lat: typeof t.lat === "number" ? t.lat : undefined,
                lon: typeof t.lon === "number" ? t.lon : undefined,
                timing: t.timing,
                program: t.program,
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
  }, [fetchMapData]);

  useEffect(() => {
    if (autoRefresh) {
      const interval = setInterval(fetchMapData, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [autoRefresh, refreshInterval, fetchMapData]);

  // Network data caching utilities
  const CACHE_KEY = "sumo_network_cache";
  const CACHE_VERSION = "1.0";
  const CACHE_EXPIRY = 24 * 60 * 60 * 1000; // 24 hours

  const getCachedNetworkData = () => {
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      if (!cached) return null;

      const { data, timestamp, version } = JSON.parse(cached);

      // Check if cache is expired or version mismatch
      if (Date.now() - timestamp > CACHE_EXPIRY || version !== CACHE_VERSION) {
        localStorage.removeItem(CACHE_KEY);
        return null;
      }

      return data;
    } catch (e) {
      localStorage.removeItem(CACHE_KEY);
      return null;
    }
  };

  const setCachedNetworkData = (data) => {
    try {
      const cacheData = {
        data,
        timestamp: Date.now(),
        version: CACHE_VERSION,
      };
      localStorage.setItem(CACHE_KEY, JSON.stringify(cacheData));
    } catch (e) {
      console.warn("Failed to cache network data:", e);
    }
  };

  // Load SUMO .net.xml from public folder with caching
  const loadSumoNetLocal = async (path = "/Sumoconfigs/AddisAbaba.net.xml") => {
    try {
      setLoading(true);

      // Try to load from cache first
      const cachedData = getCachedNetworkData();
      if (cachedData) {
        setSumoNetData(cachedData);
        setSumoNetMode(true);
        window.dispatchEvent(
          new CustomEvent("notify", {
            detail: {
              type: "success",
              message: "Loaded SUMO network from cache",
            },
          })
        );
        return;
      }

      // If no cache, parse from file
      const data = await parseSumoNetXml(path);

      // Cache the parsed data
      setCachedNetworkData(data);

      setSumoNetData(data);
      setSumoNetMode(true);
      window.dispatchEvent(
        new CustomEvent("notify", {
          detail: {
            type: "success",
            message: "Loaded and cached SUMO network",
          },
        })
      );
    } catch (e) {
      console.error("Failed to load SUMO net:", e);
      window.dispatchEvent(
        new CustomEvent("notify", {
          detail: {
            type: "error",
            message: e.message || "Failed to load .net.xml",
          },
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
    const s = String(stateStr || "").toLowerCase();
    let red = 0,
      yellow = 0,
      green = 0;
    for (const ch of s) {
      if (ch === "r") red += 1;
      else if (ch === "y") yellow += 1;
      else if (ch === "g") green += 1;
      else if (ch === "o") red += 1; // treat off as stop
    }
    const total = Math.max(1, red + yellow + green);
    return {
      red,
      yellow,
      green,
      total,
      redPct: red / total,
      yellowPct: yellow / total,
      greenPct: green / total,
    };
  };

  // Small phase preview bar (r/y/g composition)
  const PhasePreview = ({ state }) => {
    const { redPct, yellowPct, greenPct } = summarizeTlsState(state);
    const seg = (w, c) => (
      <div
        style={{
          width: `${Math.max(8, Math.round(w * 36))}px`,
          height: 6,
          background: c,
          borderRadius: 3,
        }}
      />
    );
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
        {seg(redPct, "#D7263D")}
        {seg(yellowPct, "#FFC107")}
        {seg(greenPct, "#25A244")}
      </div>
    );
  };

  // Dynamic TLS icon showing current phase distribution and state text
  const createTlsIconDynamic = (stateStr) => {
    const { redPct, yellowPct, greenPct } = summarizeTlsState(stateStr);
    const bar = (color, pct) =>
      `<div style="height:4px;background:${color};width:${Math.max(8, Math.round(pct * 16))}px;border-radius:2px"></div>`;
    const html = `
      <div style="display:flex;flex-direction:column;align-items:center;gap:2px;padding:2px 3px;background:rgba(0,0,0,0.55);border-radius:4px;color:#fff">
        <div style="display:flex;gap:2px;align-items:center;justify-content:center">
          ${bar("#D7263D", redPct)}
          ${bar("#FFC107", yellowPct)}
          ${bar("#25A244", greenPct)}
        </div>
        <div style="font:700 9px/10px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;letter-spacing:0.5px;opacity:0.95;white-space:nowrap;max-width:120px;overflow:hidden;text-overflow:ellipsis">
          ${String(stateStr || "").toUpperCase()}
        </div>
      </div>`;
    return L.divIcon({
      className: "tls-dynamic-icon",
      html,
      iconSize: [24, 20],
      iconAnchor: [12, 10],
    });
  };

  // Panel icon: square in the middle with colored sides for N,E,S,W
  const createTlsPanelIcon = (sides) => {
    const color = (c) =>
      c === "g" ? "#25A244" : c === "y" ? "#FFC107" : "#D7263D";
    const N = color(sides?.N || "r");
    const E = color(sides?.E || "r");
    const S = color(sides?.S || "r");
    const W = color(sides?.W || "r");
    const html = `
      <div style="width:22px;height:22px;position:relative;background:rgba(0,0,0,0.35);border-radius:4px;box-shadow:0 0 2px rgba(0,0,0,0.35)">
        <div style="position:absolute;top:0;left:3px;right:3px;height:4px;background:${N};border-radius:2px"></div>
        <div style="position:absolute;bottom:0;left:3px;right:3px;height:4px;background:${S};border-radius:2px"></div>
        <div style="position:absolute;top:3px;bottom:3px;right:0;width:4px;background:${E};border-radius:2px"></div>
        <div style="position:absolute;top:3px;bottom:3px;left:0;width:4px;background:${W};border-radius:2px"></div>
      </div>`;
    return L.divIcon({
      className: "tls-panel-icon",
      html,
      iconSize: [22, 22],
      iconAnchor: [11, 11],
    });
  };

  // Enhanced traffic light icon with current state visualization
  const createEnhancedTlsIcon = (tlsData) => {
    const state = tlsData?.state || "";
    const size = 32;

    // Create a more sophisticated traffic light icon
    const html = `
      <div style="
        width: ${size}px;
        height: ${size}px;
        background: linear-gradient(145deg, #2c3e50, #34495e);
        border-radius: 6px;
        border: 2px solid #fff;
        box-shadow: 0 3px 10px rgba(0,0,0,0.3);
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        position: relative;
        transition: all 0.2s ease;
      ">
        <!-- Top light indicator -->
        <div style="
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: ${state.toLowerCase().includes("g") ? "#25A244" : "#666"};
          margin: 1px 0;
          box-shadow: 0 0 3px rgba(0,0,0,0.5);
        "></div>
        <!-- Middle light indicator -->
        <div style="
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: ${state.toLowerCase().includes("y") ? "#FFC107" : "#666"};
          margin: 1px 0;
          box-shadow: 0 0 3px rgba(0,0,0,0.5);
        "></div>
        <!-- Bottom light indicator -->
        <div style="
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: ${state.toLowerCase().includes("r") ? "#D7263D" : "#666"};
          margin: 1px 0;
          box-shadow: 0 0 3px rgba(0,0,0,0.5);
        "></div>
        <!-- Clickable indicator -->
        <div style="
          position: absolute;
          top: -2px;
          right: -2px;
          width: 8px;
          height: 8px;
          background: #1976D2;
          border: 1px solid #fff;
          border-radius: 50%;
          font-size: 6px;
          color: white;
          display: flex;
          align-items: center;
          justify-content: center;
        ">i</div>
      </div>
    `;

    return L.divIcon({
      className: "enhanced-tls-icon",
      html,
      iconSize: [size, size],
      iconAnchor: [size / 2, size / 2],
    });
  };

  // Fallback emoji icon
  const tlsEmojiIcon = () =>
    L.divIcon({
      className: "custom-traffic-icon",
      html: '<div style="font-size:18px; line-height:18px">🚦</div>',
      iconSize: [18, 18],
      iconAnchor: [9, 9],
    });

  // Handle traffic light click
  const handleTlsClick = (tlsId, tlsData) => {
    setSelectedTlsId(tlsId);
    setIsModalOpen(true);
  };

  // Close modal handler
  const handleModalClose = () => {
    setIsModalOpen(false);
    setSelectedTlsId(null);
  };

  // Get selected TLS data for modal
  const getSelectedTlsData = () => {
    if (!selectedTlsId || !Array.isArray(mapData?.tls)) return null;
    return mapData.tls.find((t) => t.id === selectedTlsId);
  };

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

        {!sumoNetMode && (
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
          <span className="kpi-label">Active Vehicles</span>
          <span className="kpi-value">
            {Array.isArray(mapData?.vehicles) ? mapData.vehicles.length : 0}
          </span>
        </div>
        <div className="kpi">
          <span className="kpi-label">Emergency Units</span>
          <span className="kpi-value" style={{ color: "#E53935" }}>
            {Array.isArray(mapData?.vehicles)
              ? mapData.vehicles.filter(
                  (v) =>
                    v.type === "ambulance" ||
                    v.type === "fire_truck" ||
                    v.type === "police"
                ).length
              : 0}
          </span>
        </div>
        <div className="kpi">
          <span className="kpi-label">Traffic Status</span>
          <span
            className="kpi-value"
            style={{
              color:
                (edgeCongestion?.size || 0) > 0
                  ? congestedClasses.red.length > 0
                    ? "#F44336"
                    : congestedClasses.yellow.length > 0
                      ? "#FFC107"
                      : "#4CAF50"
                  : "#4CAF50",
            }}
          >
            {(edgeCongestion?.size || 0) === 0
              ? "All Clear"
              : congestedClasses.red.length > 0
                ? "Congested"
                : congestedClasses.yellow.length > 0
                  ? "Moderate"
                  : "Free Flow"}
          </span>
        </div>
      </div>

      <div className="traffic-map-container">
        {/* Map Container */}
        <div
          className="map-wrapper"
          style={{ width: "100%", position: "relative" }}
        >
          {/* Loading overlay */}
          {loading && (
            <div
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background: "rgba(255, 255, 255, 0.9)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                zIndex: 1000,
                flexDirection: "column",
                gap: "16px",
              }}
            >
              <div
                style={{
                  width: "48px",
                  height: "48px",
                  border: "4px solid #e3f2fd",
                  borderTop: "4px solid #1976d2",
                  borderRadius: "50%",
                  animation: "spin 1s linear infinite",
                }}
              />
              <div
                style={{
                  fontSize: "16px",
                  fontWeight: "500",
                  color: "#1976d2",
                }}
              >
                Loading Traffic Map...
              </div>
            </div>
          )}

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
                  pathOptions={{
                    color: "#9ea3a8",
                    weight: 0,
                    fillColor: "#9ea3a8",
                    fillOpacity: 0.95,
                  }}
                />
              ))}
            {/* Fallback: junction center disks to fill any remaining holes */}
            {Array.isArray(sumoNetData.junctionPoints) &&
              sumoNetData.junctionPoints.map((p) => (
                <CircleMarker
                  key={`jpt_${p.id}`}
                  center={[p.lat, p.lng]}
                  radius={6}
                  pathOptions={{
                    color: "#9ea3a8",
                    weight: 0,
                    fillColor: "#9ea3a8",
                    fillOpacity: 0.95,
                  }}
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

            {/* Traffic density overlay - color roads based on vehicle count */}
            {/* Default: No vehicles yet - show as light green (open roads) */}
            {congestedClasses.default.length > 0 && (
              <Polyline
                positions={congestedClasses.default}
                color="#4CAF50"
                weight={6}
                opacity={0.7}
                lineCap="round"
                lineJoin="round"
              />
            )}
            {/* Green: Light traffic (1-2 vehicles per road segment) */}
            {congestedClasses.green.length > 0 && (
              <Polyline
                positions={congestedClasses.green}
                color="#4CAF50"
                weight={6}
                opacity={0.9}
                lineCap="round"
                lineJoin="round"
              />
            )}
            {/* Yellow: Moderate traffic (3-5 vehicles per road segment) */}
            {congestedClasses.yellow.length > 0 && (
              <Polyline
                positions={congestedClasses.yellow}
                color="#FFC107"
                weight={6}
                opacity={0.9}
                lineCap="round"
                lineJoin="round"
              />
            )}
            {/* Red: Heavy traffic (6+ vehicles per road segment) */}
            {congestedClasses.red.length > 0 && (
              <Polyline
                positions={congestedClasses.red}
                color="#F44336"
                weight={6}
                opacity={0.9}
                lineCap="round"
                lineJoin="round"
              />
            )}

            {/* TLS from .net.xml positions with live phase state from simulation */}
            {mapView === "traffic" &&
              Array.isArray(sumoNetData.tls) &&
              (() => {
                const liveMap = new Map(
                  (Array.isArray(mapData?.tls) ? mapData.tls : []).map((t) => [
                    t.id,
                    t,
                  ])
                );
                return sumoNetData.tls.map((t) => {
                  const live = liveMap.get(t.id) || {};
                  const st = live.state;
                  const timing = live.timing || {};
                  const prog = live.program || {};

                  // Use enhanced icon with current state visualization
                  const icon = createEnhancedTlsIcon(live);

                  const fmt = (s) => {
                    const v = Math.max(0, Math.round(Number(s || 0)));
                    const m = Math.floor(v / 60);
                    const ss = v % 60;
                    return `${m}:${String(ss).padStart(2, "0")}`;
                  };

                  return (
                    <Marker
                      key={t.id}
                      position={[t.lat, t.lng]}
                      icon={icon}
                      eventHandlers={{
                        click: () => handleTlsClick(t.id, live),
                      }}
                    >
                      <Popup>
                        <div>
                          <div style={{ fontWeight: 700, marginBottom: 8 }}>
                            TLS {t.id}
                          </div>

                          {/* Current State Summary */}
                          <div style={{ marginBottom: 12 }}>
                            {st && (
                              <div style={{ marginBottom: 8 }}>
                                <div
                                  style={{
                                    fontSize: 12,
                                    color: "#666",
                                    marginBottom: 4,
                                  }}
                                >
                                  Current Phase State:
                                </div>
                                <TrafficLightPhasePreview
                                  phaseState={st}
                                  width={120}
                                  height={16}
                                />
                              </div>
                            )}

                            {typeof timing.currentIndex === "number" && (
                              <div style={{ fontSize: 12, color: "#374151" }}>
                                Phase {timing.currentIndex + 1}
                                {typeof timing.remaining === "number" && (
                                  <span
                                    style={{
                                      marginLeft: 8,
                                      fontWeight: 600,
                                      color: "#1976D2",
                                    }}
                                  >
                                    ({fmt(timing.remaining)} remaining)
                                  </span>
                                )}
                              </div>
                            )}
                          </div>

                          {/* Quick action for authorized users */}
                          {canOverride && (
                            <div style={{ textAlign: "center", marginTop: 12 }}>
                              <button
                                className="action-btn primary"
                                onClick={() => handleTlsClick(t.id, live)}
                                style={{
                                  padding: "8px 16px",
                                  fontSize: "12px",
                                  background: "#1976D2",
                                  color: "white",
                                  border: "none",
                                  borderRadius: "4px",
                                  cursor: "pointer",
                                }}
                              >
                                🚦 Control Traffic Light
                              </button>
                            </div>
                          )}

                          {!canOverride && (
                            <div style={{ textAlign: "center", marginTop: 12 }}>
                              <button
                                className="action-btn secondary"
                                onClick={() => handleTlsClick(t.id, live)}
                                style={{
                                  padding: "8px 16px",
                                  fontSize: "12px",
                                  background: "#f5f5f5",
                                  color: "#333",
                                  border: "1px solid #ddd",
                                  borderRadius: "4px",
                                  cursor: "pointer",
                                }}
                              >
                                👁 View Status
                              </button>
                            </div>
                          )}
                        </div>
                      </Popup>
                    </Marker>
                  );
                });
              })()}

            {/* Emergency vehicles only - show only if they actually exist in the simulation data */}
            {Array.isArray(mapData?.vehicles) &&
              mapData.vehicles
                .filter((v) => {
                  const isEmergency =
                    v.type === "ambulance" ||
                    v.type === "fire_truck" ||
                    v.type === "police";
                  const hasValidCoords =
                    typeof v.netLat === "number" &&
                    typeof v.netLng === "number";
                  return isEmergency && hasValidCoords;
                })
                .map((v) => (
                  <Marker
                    key={v.id}
                    position={[v.netLat, v.netLng]}
                    icon={createEmergencyVehicleIcon(v)}
                  >
                    <Popup>
                      <div>
                        <div>
                          <strong>🚨 Emergency Vehicle {v.id}</strong>
                        </div>
                        <div>
                          Type: {v.type.replace("_", " ").toUpperCase()}
                        </div>
                        {typeof v.speed === "number" && (
                          <div>Speed: {v.speed.toFixed(1)} m/s</div>
                        )}
                        <div>Edge: {v.edgeId || v.laneId || "Unknown"}</div>
                        <div>
                          Coordinates: [{v.netLat?.toFixed(2)},{" "}
                          {v.netLng?.toFixed(2)}]
                        </div>
                        <div
                          style={{
                            color: "#E53935",
                            fontWeight: "bold",
                            marginTop: "8px",
                          }}
                        >
                          PRIORITY VEHICLE
                        </div>
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
              <span className="stat-label">Road Segments:</span>
              <span className="stat-value">{edgeGeoms.length}</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">With Traffic Data:</span>
              <span className="stat-value" style={{ color: "#1976D2" }}>
                {edgeCongestion?.size || 0}
              </span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Free Flowing:</span>
              <span className="stat-value" style={{ color: "#4CAF50" }}>
                {congestedClasses.green.length +
                  congestedClasses.default.length}
              </span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Congested:</span>
              <span className="stat-value" style={{ color: "#F44336" }}>
                {congestedClasses.red.length}
              </span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Traffic Lights:</span>
              <span className="stat-value" style={{ color: "#9C27B0" }}>
                {Array.isArray(mapData?.tls) ? mapData.tls.length : 0}
              </span>
            </div>
          </div>
          <div className="legend" style={{ marginTop: 12 }}>
            <div
              className="legend-title"
              style={{ fontWeight: "bold", marginBottom: 8 }}
            >
              Traffic Density Legend
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "16px" }}>
              <div className="legend-item">
                <div
                  className="legend-color"
                  style={{
                    background: "#4CAF50",
                    width: "20px",
                    height: "4px",
                    borderRadius: "2px",
                    opacity: "0.7",
                  }}
                ></div>
                <span>Open Roads (No vehicles)</span>
              </div>
              <div className="legend-item">
                <div
                  className="legend-color"
                  style={{
                    background: "#4CAF50",
                    width: "20px",
                    height: "4px",
                    borderRadius: "2px",
                  }}
                ></div>
                <span>Light Traffic (1-2 vehicles)</span>
              </div>
              <div className="legend-item">
                <div
                  className="legend-color"
                  style={{
                    background: "#FFC107",
                    width: "20px",
                    height: "4px",
                    borderRadius: "2px",
                  }}
                ></div>
                <span>Moderate Traffic (3-5 vehicles)</span>
              </div>
              <div className="legend-item">
                <div
                  className="legend-color"
                  style={{
                    background: "#F44336",
                    width: "20px",
                    height: "4px",
                    borderRadius: "2px",
                  }}
                ></div>
                <span>Heavy Traffic (6+ vehicles)</span>
              </div>
            </div>
            <div
              className="legend-note"
              style={{
                fontSize: "12px",
                marginTop: "8px",
                fontStyle: "italic",
              }}
            >
              * Colors change based on real-time vehicle count per road segment
            </div>
            <div
              className="legend-title"
              style={{
                fontWeight: "bold",
                marginTop: 16,
                marginBottom: 8,
              }}
            >
              Emergency Vehicles
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "16px" }}>
              <div className="legend-item" style={{ alignItems: "center" }}>
                <div
                  style={{
                    width: "24px",
                    height: "24px",
                    background: "#FFFFFF",
                    border: "2px solid #E53935",
                    borderRadius: "4px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "12px",
                    fontWeight: "bold",
                  }}
                >
                  AMB
                </div>
                <span>Ambulance</span>
              </div>
              <div className="legend-item" style={{ alignItems: "center" }}>
                <div
                  style={{
                    width: "24px",
                    height: "24px",
                    background: "#B71C1C",
                    border: "2px solid #FFEB3B",
                    borderRadius: "4px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "10px",
                    fontWeight: "bold",
                    color: "white",
                  }}
                >
                  FIRE
                </div>
                <span>Fire Truck</span>
              </div>
              <div className="legend-item" style={{ alignItems: "center" }}>
                <div
                  style={{
                    width: "24px",
                    height: "24px",
                    background: "#1565C0",
                    border: "2px solid #FFFFFF",
                    borderRadius: "4px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "12px",
                    fontWeight: "bold",
                    color: "white",
                  }}
                >
                  POL
                </div>
                <span>Police</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Traffic Light Control Modal */}
      {selectedTlsId && (
        <TrafficLightModal
          tlsId={selectedTlsId}
          isOpen={isModalOpen}
          onClose={handleModalClose}
          timing={getSelectedTlsData()?.timing}
          program={getSelectedTlsData()?.program}
        />
      )}
    </PageLayout>
  );
};

// Render a cropped intersection schematic using actual lane geometry
// Movement-aware arrow schematic (per-side L/S/R)
const TlsTurnArrowsLayout = ({ turns = {} }) => {
  const W = 260,
    H = 260;
  const cx = W / 2,
    cy = H / 2;
  const color = (s) =>
    s === "g" ? "#25A244" : s === "y" ? "#FFC107" : "#D7263D";
  const drawArrow = (ctx) => {
    const { x, y, dir, col } = ctx;
    const len = 52,
      bar = 8,
      tri = 14;
    if (dir === "down") {
      return (
        <g>
          <rect
            x={x - bar / 2}
            y={y}
            width={bar}
            height={len - tri}
            fill={col}
            rx={3}
          />
          <polygon
            points={`${x},${y + len} ${x - 10},${y + len - tri} ${x + 10},${y + len - tri}`}
            fill={col}
          />
        </g>
      );
    }
    if (dir === "up") {
      return (
        <g>
          <rect
            x={x - bar / 2}
            y={y - (len - tri)}
            width={bar}
            height={len - tri}
            fill={col}
            rx={3}
          />
          <polygon
            points={`${x},${y - len} ${x - 10},${y - len + tri} ${x + 10},${y - len + tri}`}
            fill={col}
          />
        </g>
      );
    }
    if (dir === "left") {
      return (
        <g>
          <rect
            x={x - (len - tri)}
            y={y - bar / 2}
            width={len - tri}
            height={bar}
            fill={col}
            rx={3}
          />
          <polygon
            points={`${x - len},${y} ${x - len + tri},${y - 10} ${x - len + tri},${y + 10}`}
            fill={col}
          />
        </g>
      );
    }
    // right
    return (
      <g>
        <rect
          x={x}
          y={y - bar / 2}
          width={len - tri}
          height={bar}
          fill={col}
          rx={3}
        />
        <polygon
          points={`${x + len},${y} ${x + len - tri},${y - 10} ${x + len - tri},${y + 10}`}
          fill={col}
        />
      </g>
    );
  };
  // positions
  const gap = 24;
  const data = [];
  // North side (arrows go down). Place left/straight/right offset in X
  if (turns?.N) {
    if (turns.N.L)
      data.push({
        x: cx - gap,
        y: cy - 70,
        dir: "down",
        col: color(turns.N.L),
      });
    if (turns.N.S)
      data.push({ x: cx, y: cy - 70, dir: "down", col: color(turns.N.S) });
    if (turns.N.R)
      data.push({
        x: cx + gap,
        y: cy - 70,
        dir: "down",
        col: color(turns.N.R),
      });
  }
  // South side (arrows go up)
  if (turns?.S) {
    if (turns.S.L)
      data.push({ x: cx + gap, y: cy + 70, dir: "up", col: color(turns.S.L) });
    if (turns.S.S)
      data.push({ x: cx, y: cy + 70, dir: "up", col: color(turns.S.S) });
    if (turns.S.R)
      data.push({ x: cx - gap, y: cy + 70, dir: "up", col: color(turns.S.R) });
  }
  // East side (arrows go left). Offset in Y (top=left-turn when facing west)
  if (turns?.E) {
    if (turns.E.L)
      data.push({
        x: cx + 70,
        y: cy - gap,
        dir: "left",
        col: color(turns.E.L),
      });
    if (turns.E.S)
      data.push({ x: cx + 70, y: cy, dir: "left", col: color(turns.E.S) });
    if (turns.E.R)
      data.push({
        x: cx + 70,
        y: cy + gap,
        dir: "left",
        col: color(turns.E.R),
      });
  }
  // West side (arrows go right). Offset in Y
  if (turns?.W) {
    if (turns.W.L)
      data.push({
        x: cx - 70,
        y: cy + gap,
        dir: "right",
        col: color(turns.W.L),
      });
    if (turns.W.S)
      data.push({ x: cx - 70, y: cy, dir: "right", col: color(turns.W.S) });
    if (turns.W.R)
      data.push({
        x: cx - 70,
        y: cy - gap,
        dir: "right",
        col: color(turns.W.R),
      });
  }
  return (
    <svg
      width={W}
      height={H}
      viewBox={`0 0 ${W} ${H}`}
      style={{ display: "block", marginTop: 6 }}
    >
      <rect x={0} y={0} width={W} height={H} fill="white" stroke="#e0e0e0" />
      {data.map((ctx, i) => (
        <g key={i}>{drawArrow(ctx)}</g>
      ))}
      {/* center box */}
      <rect
        x={cx - 12}
        y={cy - 12}
        width={24}
        height={24}
        fill="#f5f5f5"
        stroke="#bdbdbd"
        rx={3}
      />
    </svg>
  );
};

// Fallback: Arrow-based schematic per side only
const TlsArrowsLayout = ({ sides = {} }) => {
  const W = 220,
    H = 220;
  const cx = W / 2,
    cy = H / 2;
  const color = (s) =>
    s === "g" ? "#25A244" : s === "y" ? "#FFC107" : "#D7263D";
  const N = color(sides?.N || "r");
  const E = color(sides?.E || "r");
  const S = color(sides?.S || "r");
  const Wc = color(sides?.W || "r");
  const Arrow = ({ dir }) => {
    // Define basic arrow dimensions
    const len = 60,
      bar = 8,
      tri = 14;
    if (dir === "N") {
      return (
        <g>
          <rect
            x={cx - bar / 2}
            y={cy - len}
            width={bar}
            height={len - tri}
            fill={N}
            rx={3}
          />
          <polygon
            points={`${cx},${cy - len} ${cx - 10},${cy - len + tri} ${cx + 10},${cy - len + tri}`}
            fill={N}
          />
        </g>
      );
    }
    if (dir === "S") {
      return (
        <g>
          <rect
            x={cx - bar / 2}
            y={cy + tri}
            width={bar}
            height={len - tri}
            fill={S}
            rx={3}
          />
          <polygon
            points={`${cx},${cy + len} ${cx - 10},${cy + len - tri} ${cx + 10},${cy + len - tri}`}
            fill={S}
          />
        </g>
      );
    }
    if (dir === "E") {
      return (
        <g>
          <rect
            x={cx + tri}
            y={cy - bar / 2}
            width={len - tri}
            height={bar}
            fill={E}
            rx={3}
          />
          <polygon
            points={`${cx + len},${cy} ${cx + len - tri},${cy - 10} ${cx + len - tri},${cy + 10}`}
            fill={E}
          />
        </g>
      );
    }
    // W
    return (
      <g>
        <rect
          x={cx - len}
          y={cy - bar / 2}
          width={len - tri}
          height={bar}
          fill={Wc}
          rx={3}
        />
        <polygon
          points={`${cx - len},${cy} ${cx - len + tri},${cy - 10} ${cx - len + tri},${cy + 10}`}
          fill={Wc}
        />
      </g>
    );
  };
  return (
    <svg
      width={220}
      height={220}
      viewBox={`0 0 ${220} ${220}`}
      style={{ display: "block", marginTop: 6 }}
    >
      <rect
        x={0}
        y={0}
        width={220}
        height={220}
        fill="white"
        stroke="#e0e0e0"
      />
      {/* Draw arrows toward center */}
      <Arrow dir="N" />
      <Arrow dir="S" />
      <Arrow dir="E" />
      <Arrow dir="W" />
      {/* center box */}
      <rect
        x={cx - 10}
        y={cy - 10}
        width={20}
        height={20}
        fill="#f5f5f5"
        stroke="#bdbdbd"
        rx={3}
      />
    </svg>
  );
};

export default TrafficMap;
