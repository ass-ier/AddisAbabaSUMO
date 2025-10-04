import React, { useState, useEffect, useRef } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Polyline,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import PageLayout from "./PageLayout";
import "./TrafficMap.css";
import io from "socket.io-client";
import { useAuth } from "../contexts/AuthContext";
import { api } from "../utils/api";
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
    socketRef.current = io("http://localhost:5000");
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
            next.vehicles = payload.vehicles
              .filter(
                (v) => typeof v.lat === "number" && typeof v.lon === "number"
              )
              .map((v) => ({
                id: v.id,
                lat: v.lat,
                lng: v.lon,
                speed: v.speed,
                angle: v.angle,
                type: v.type,
              }));
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

  const tlsIcon = (state) => {
    const s = (state || "").toLowerCase();
    const isRed = s.includes("r");
    const isYellow = s.includes("y");
    const isGreen = s.includes("g");
    const svg = `
      <svg width="28" height="48" viewBox="0 0 28 48" xmlns="http://www.w3.org/2000/svg" class="traffic-signal">
        <rect x="4" y="2" width="20" height="44" rx="6" fill="#263238" stroke="#000" stroke-width="1" />
        <g class="light-group">
          <circle cx="14" cy="12" r="6" fill="#F44336" opacity="${
            isRed ? 1 : 0.25
          }" class="${isRed ? "light-active light-red" : ""}" />
          <circle cx="14" cy="24" r="6" fill="#FFEB3B" opacity="${
            isYellow ? 1 : 0.25
          }" class="${isYellow ? "light-active light-yellow" : ""}" />
          <circle cx="14" cy="36" r="6" fill="#4CAF50" opacity="${
            isGreen ? 1 : 0.25
          }" class="${isGreen ? "light-active light-green" : ""}" />
        </g>
      </svg>
    `;
    return L.divIcon({
      className: "custom-traffic-icon",
      html: svg,
      iconSize: [28, 48],
      iconAnchor: [14, 24],
    });
  };

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
      <div className="traffic-map-container">
        {/* Map Controls */}
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
        </div>

        {/* Map Container */}
        <div className="map-wrapper">
          <MapContainer
            center={addisCenter}
            zoom={addisZoom}
            style={{ height: "100%", width: "100%" }}
          >
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            />

            <MapController
              intersections={mapData.intersections}
              lanes={mapData.lanes}
              geoBounds={mapData.geoBounds}
            />

            {/* SUMO Lanes */}
            {mapData.lanes.map((lane) => (
              <Polyline
                key={lane.id}
                positions={lane.points}
                color="#2196F3"
                weight={2}
                opacity={0.6}
              />
            ))}

            {/* Traffic Lights from SUMO */}
            {Array.isArray(mapData.tls) &&
              mapData.tls.map((t) => (
                <Marker
                  key={t.id}
                  position={[t.lat, t.lng]}
                  icon={tlsIcon(t.state)}
                >
                  <Popup>
                    <div>
                      <strong>TLS {t.id}</strong>
                      <div>State: {t.state}</div>
                    </div>
                  </Popup>
                </Marker>
              ))}

            {/* Traffic Flow Lines (demo overlay) */}
            {mapData.trafficFlow.map((flow) => (
              <Polyline
                key={flow.id}
                positions={flow.path}
                color={getTrafficFlowColor(flow.intensity)}
                weight={4}
                opacity={0.7}
              />
            ))}

            {/* Intersections */}
            {filteredIntersections.map((intersection) => (
              <Marker
                key={intersection.id}
                position={[intersection.lat, intersection.lng]}
                icon={createIntersectionIcon(intersection.status)}
                eventHandlers={{
                  click: () => handleIntersectionClick(intersection),
                }}
              >
                <Popup>
                  <div className="intersection-popup">
                    <h3>{intersection.name}</h3>
                    <p>
                      <strong>Status:</strong> {intersection.status}
                    </p>
                    <p>
                      <strong>Queue Length:</strong> {intersection.queueLength}{" "}
                      vehicles
                    </p>
                    <p>
                      <strong>Signal:</strong> {intersection.signalState}
                    </p>
                    <p>
                      <strong>Congestion:</strong>
                      <span
                        style={{
                          color: getCongestionColor(intersection.congestion),
                        }}
                      >
                        {intersection.congestion}
                      </span>
                    </p>
                    {canManualOverride && (
                      <button
                        className="popup-btn"
                        onClick={() => manualOverride(intersection)}
                      >
                        Manual Override
                      </button>
                    )}
                  </div>
                </Popup>
              </Marker>
            ))}

            {/* Emergency Vehicles */}
            {mapData.emergencyVehicles.map((vehicle) => (
              <Marker
                key={vehicle.id}
                position={[vehicle.lat, vehicle.lng]}
                icon={createVehicleIcon({
                  ...vehicle,
                  angle: vehicle.angle || 0,
                })}
              >
                <Popup>
                  <div className="emergency-popup">
                    <h3>🚨 {vehicle.type.replace("_", " ").toUpperCase()}</h3>
                    <p>
                      <strong>Priority:</strong> {vehicle.priority}
                    </p>
                    <p>
                      <strong>Destination:</strong> {vehicle.destination}
                    </p>
                    <p>
                      <strong>ETA:</strong> {vehicle.eta}
                    </p>
                  </div>
                </Popup>
              </Marker>
            ))}

            {/* Vehicles from SUMO */}
            {mapView === "traffic" &&
              clusterVehicles(mapData.vehicles).map((vehicle) => (
                <Marker
                  key={vehicle.id}
                  position={[vehicle.lat, vehicle.lng]}
                  icon={
                    vehicle.type === "cluster"
                      ? L.divIcon({
                          className: "custom-traffic-icon",
                          html: `<div style="background:${clusterColor(
                            vehicle.count
                          )};color:#fff;border-radius:14px;padding:4px 6px;font-size:12px;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,0.3)">${
                            vehicle.count
                          }</div>`,
                          iconSize: [28, 28],
                          iconAnchor: [14, 14],
                        })
                      : createVehicleIcon(vehicle)
                  }
                >
                  {vehicle.type !== "cluster" && (
                    <Popup>
                      <div>
                        <strong>{vehicle.id}</strong>
                        <div>
                          Speed: {vehicle.speed?.toFixed?.(1) ?? vehicle.speed}{" "}
                          m/s
                        </div>
                        <div>Type: {vehicle.type}</div>
                      </div>
                    </Popup>
                  )}
                </Marker>
              ))}
          </MapContainer>
          {/* Compact on-map legend */}
          <div className="map-legend-overlay">
            <div className="legend-row">
              <span className="legend-swatch legend-car" /> Sedan/Car
            </div>
            <div className="legend-row">
              <span className="legend-swatch legend-bus" /> Bus
            </div>
            <div className="legend-row">
              <span className="legend-swatch legend-truck" /> Truck
            </div>
            <div className="legend-row">
              <span className="legend-swatch legend-taxi" /> Taxi
            </div>
            <div className="legend-row">
              <span className="legend-signal" /> Traffic Signal
            </div>
          </div>
          {/* On-map KPIs */}
          <div className="map-kpis-overlay">
            <div className="kpi">
              <span className="kpi-label">Vehicles</span>
              <span className="kpi-value">{totals.vehicles}</span>
            </div>
            <div className="kpi">
              <span className="kpi-label">TLS</span>
              <span className="kpi-value">{totals.tls}</span>
            </div>
            <div className="kpi">
              <span className="kpi-dot dot-red" />
              {tlsCounts.red}
            </div>
            <div className="kpi">
              <span className="kpi-dot dot-yellow" />
              {tlsCounts.yellow}
            </div>
            <div className="kpi">
              <span className="kpi-dot dot-green" />
              {tlsCounts.green}
            </div>
            <button
              className="kpi-toggle"
              onClick={() => setShowDensity(!showDensity)}
            >
              {showDensity ? "Hide" : "Show"} Density
            </button>
          </div>
        </div>

        {/* Side Panel */}
        <div className="map-sidebar">
          <div className="sidebar-section">
            <h3>Simulation</h3>
            <div className="action-buttons">
              <button
                className="action-btn primary"
                onClick={() =>
                  api.sumoControl("start_simulation").catch(() => {})
                }
              >
                ▶️ Start
              </button>
              <button
                className="action-btn"
                onClick={() =>
                  api.sumoControl("pause_simulation").catch(() => {})
                }
              >
                ⏸️ Pause
              </button>
              <button
                className="action-btn"
                onClick={() =>
                  api.sumoControl("resume_simulation").catch(() => {})
                }
              >
                ▶️ Resume
              </button>
              <button
                className="action-btn danger"
                onClick={() =>
                  api.sumoControl("stop_simulation").catch(() => {})
                }
              >
                ⏹️ Stop
              </button>
            </div>
          </div>
          <div className="sidebar-section">
            <h3>Data Source</h3>
            <div className="action-buttons">
              <button
                className={`action-btn ${
                  dataMode === "simulation" ? "primary" : "secondary"
                }`}
                onClick={() => {
                  setDataMode("simulation");
                  api.updateMapSettings({ mode: "simulation" }).catch(() => {});
                }}
              >
                Simulation Mode
              </button>
              <button
                className={`action-btn ${
                  dataMode === "real" ? "primary" : "secondary"
                }`}
                onClick={() => {
                  setDataMode("real");
                  api.updateMapSettings({ mode: "real" }).catch(() => {});
                }}
              >
                Real Data Mode
              </button>
            </div>
          </div>
          <div className="sidebar-section">
            <h3>Area Filter</h3>
            <div className="detail-grid">
              <div className="detail-item">
                <span>Min Lat</span>
                <span>{areaBbox.minLat.toFixed(4)}</span>
              </div>
              <div className="detail-item">
                <span>Min Lon</span>
                <span>{areaBbox.minLon.toFixed(4)}</span>
              </div>
              <div className="detail-item">
                <span>Max Lat</span>
                <span>{areaBbox.maxLat.toFixed(4)}</span>
              </div>
              <div className="detail-item">
                <span>Max Lon</span>
                <span>{areaBbox.maxLon.toFixed(4)}</span>
              </div>
            </div>
            <div className="action-buttons">
              <button
                className="action-btn secondary"
                onClick={() =>
                  api
                    .updateMapSettings({ bbox: areaBbox })
                    .then(() =>
                      window.dispatchEvent(
                        new CustomEvent("notify", {
                          detail: {
                            type: "success",
                            message: "Applied area filter",
                          },
                        })
                      )
                    )
                    .catch(() =>
                      window.dispatchEvent(
                        new CustomEvent("notify", {
                          detail: {
                            type: "error",
                            message: "Failed to apply area filter",
                          },
                        })
                      )
                    )
                }
              >
                Apply Filter
              </button>
              <button
                className="action-btn secondary"
                onClick={() => {
                  const addis = {
                    minLat: 8.85,
                    minLon: 38.6,
                    maxLat: 9.15,
                    maxLon: 38.9,
                  };
                  setAreaBbox(addis);
                  api.updateMapSettings({ bbox: addis }).catch(() => {});
                }}
              >
                Reset Addis
              </button>
              <button
                className="action-btn primary"
                onClick={() => {
                  // Ayat (~9.043, 38.866) to Megenagna (~9.019, 38.810) corridor
                  const ayatMegenagna = {
                    minLat: 9.0,
                    minLon: 38.8,
                    maxLat: 9.08,
                    maxLon: 38.885,
                  };
                  setAreaBbox(ayatMegenagna);
                  api
                    .updateMapSettings({ bbox: ayatMegenagna })
                    .catch(() => {});
                }}
              >
                Ayat – Megenagna
              </button>
            </div>
          </div>
          <div className="sidebar-section">
            <h3>Traffic Summary</h3>
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
                    mapData.intersections.filter(
                      (i) => i.status === "congested"
                    ).length
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
          </div>

          {selectedIntersection && (
            <div className="sidebar-section">
              <h3>Selected Intersection</h3>
              <div className="intersection-details">
                <h4>{selectedIntersection.name}</h4>
                <div className="detail-grid">
                  <div className="detail-item">
                    <span>Status:</span>
                    <span className={`status-${selectedIntersection.status}`}>
                      {selectedIntersection.status}
                    </span>
                  </div>
                  <div className="detail-item">
                    <span>Queue Length:</span>
                    <span>{selectedIntersection.queueLength} vehicles</span>
                  </div>
                  <div className="detail-item">
                    <span>Signal State:</span>
                    <span
                      className={`signal-${selectedIntersection.signalState}`}
                    >
                      {selectedIntersection.signalState}
                    </span>
                  </div>
                  <div className="detail-item">
                    <span>Congestion:</span>
                    <span
                      style={{
                        color: getCongestionColor(
                          selectedIntersection.congestion
                        ),
                      }}
                    >
                      {selectedIntersection.congestion}
                    </span>
                  </div>
                </div>
                {canManualOverride && (
                  <div className="action-buttons">
                    <button
                      className="action-btn primary"
                      onClick={() => manualOverride(selectedIntersection)}
                    >
                      Manual Override
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="sidebar-section">
            <h3>Legend</h3>
            <div className="legend">
              <div className="legend-item">
                <div
                  className="legend-color"
                  style={{ background: "#4CAF50" }}
                ></div>
                <span>Normal Traffic</span>
              </div>
              <div className="legend-item">
                <div
                  className="legend-color"
                  style={{ background: "#FF9800" }}
                ></div>
                <span>Congested</span>
              </div>
              <div className="legend-item">
                <div
                  className="legend-color"
                  style={{ background: "#F44336" }}
                ></div>
                <span>Critical</span>
              </div>
              <div className="legend-item">
                <div
                  className="legend-color"
                  style={{ background: "#9C27B0" }}
                ></div>
                <span>Emergency</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </PageLayout>
  );
};

export default TrafficMap;
