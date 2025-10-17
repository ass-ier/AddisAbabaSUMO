import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import { MapContainer, Marker, Polyline, Popup, useMap } from "react-leaflet";
import { parseSumoNetXml } from "../../utils/sumoNetParser";
import { EmergencyFeedClient, emergencyFeed } from "../../services/emergencyFeed";
import "leaflet/dist/leaflet.css";
import "./EmergencyOps.css";

const COLORS = {
  type: {
    ambulance: "#00897B", // teal
    fire: "#D32F2F", // red
    "fire_truck": "#D32F2F",
    police: "#1976D2", // blue
    other: "#757575", // grey
  },
  stateGlow: {
    dispatched: "#FF9800",
    "en-route": "#FFC107",
    onscene: "#FF5252",
    "on-scene": "#FF5252",
    cleared: "#9E9E9E",
  },
};

function useThrottle(value, intervalMs) {
  const [v, setV] = useState(value);
  const last = useRef(0);
  useEffect(() => {
    const now = Date.now();
    const dt = now - last.current;
    if (dt >= intervalMs) {
      last.current = now;
      setV(value);
      return;
    }
    const id = setTimeout(() => {
      last.current = Date.now();
      setV(value);
    }, intervalMs - dt);
    return () => clearTimeout(id);
  }, [value, intervalMs]);
  return v;
}

function VehicleIcon({ vehicle }) {
  const color = COLORS.type[vehicle.vehicleType] || COLORS.type.other;
  const rotation = vehicle.heading || vehicle.angle || 0;
  const accent = COLORS.stateGlow[vehicle.emergencyState] || "#FFFFFF";
  const label = String(vehicle.vehicleId || vehicle.id || "").slice(-4);
  const svg = `
    <svg width="36" height="36" viewBox="0 0 36 36" xmlns="http://www.w3.org/2000/svg" style="filter: drop-shadow(0 0 2px rgba(0,0,0,0.6))">
      <defs>
        <filter id="glow"><feGaussianBlur stdDeviation="2"/><feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge></filter>
        <style>
          .pulse { animation: pulse 1.2s ease-in-out infinite; }
          @keyframes pulse { 0% { opacity: 0.5 } 100% { opacity: 1 } }
        </style>
      </defs>
      <g transform="translate(18,18) rotate(${rotation}) translate(-18,-18)">
        <rect x="10" y="6" width="16" height="24" rx="4" fill="${color}" stroke="#222" stroke-width="1.5"/>
        <polygon points="18,2 14,10 22,10" fill="#222" opacity="0.8"/>
        <circle cx="18" cy="28" r="6" fill="${accent}" opacity="0.85" class="pulse" filter="url(#glow)"/>
        <text x="18" y="30" text-anchor="middle" font-family="ui-monospace, monospace" font-size="8" fill="#000">${label}</text>
      </g>
    </svg>
  `;
  return L.divIcon({ html: svg, iconSize: [36, 36], iconAnchor: [18, 18], className: "emg-icon" });
}

function FitToBounds({ bounds }) {
  const map = useMap();
  const once = useRef(false);
  useEffect(() => {
    if (!map || once.current || !bounds) return;
    try { map.fitBounds(bounds, { padding: [12, 12], maxZoom: 20 }); once.current = true; } catch (_) {}
  }, [map, bounds]);
  return null;
}

export default function EmergencyOps() {
  const [net, setNet] = useState({ lanes: [], bounds: null });
  const [enabled, setEnabled] = useState(true);
  const [filters, setFilters] = useState({ ambulance: true, fire: true, police: true, other: true });
  const [debug, setDebug] = useState(false);
  const [autoFollow, setAutoFollow] = useState(false);
  const [opacity, setOpacity] = useState(0.5);

  const [vehicles, setVehicles] = useState(new Map()); // vehicleId -> rec
  const [routes, setRoutes] = useState(new Map()); // routeId -> rec
  const [selectedId, setSelectedId] = useState(null);

  // Load SUMO geometry for context (CRS.Simple)
  useEffect(() => {
    let ok = true;
    parseSumoNetXml("/Sumoconfigs/AddisAbaba.net.xml").then((d) => {
      if (!ok) return;
      setNet(d || { lanes: [], bounds: null });
    }).catch(() => {});
    return () => { ok = false; };
  }, []);

  // Connect emergency feed (register handlers immediately so debug injection works without a socket)
  useEffect(() => {
    let mounted = true;

    // vehicle frames
    const offV = emergencyFeed.on("vehicleFrame", (frame) => {
      if (!mounted || !frame) return;
      const ts = frame.timestamp || Date.now();
      const list = Array.isArray(frame.vehicles) ? frame.vehicles : (Array.isArray(frame) ? frame : []);
      setVehicles((prev) => {
        const m = new Map(prev);
        for (const v of list) {
          if (!v || !v.vehicleId) continue;
          m.set(v.vehicleId, {
            vehicleId: v.vehicleId,
            x: v.x, y: v.y,
            netLat: v.y, netLng: v.x, // CRS.Simple: lat=y, lng=x
            speed: v.speed, heading: v.heading || v.angle || 0,
            vehicleType: v.vehicleType || v.type || "other",
            emergencyState: v.emergencyState || v.state || "dispatched",
            routeId: v.routeId || null,
            lastTs: ts,
          });
        }
        return m;
      });
    });

    // route frames
    const offR = emergencyFeed.on("routeFrame", (frame) => {
      if (!mounted || !frame) return;
      const ts = frame.timestamp || Date.now();
      const list = Array.isArray(frame.routes) ? frame.routes : [frame];
      setRoutes((prev) => {
        const m = new Map(prev);
        for (const r of list) {
          if (!r || !r.routeId || !Array.isArray(r.coords)) continue;
          m.set(r.routeId, {
            routeId: r.routeId,
            coords: r.coords.map((p) => [p[1] ?? p.y, p[0] ?? p.x]), // [[y,x]] -> [lat, lng]
            origin: r.origin, destination: r.destination,
            eta: r.eta, assignedVehicleId: r.assignedVehicleId,
            color: colorForId(r.routeId), lastTs: ts,
          });
        }
        return m;
      });
    });

    // attempt connection (non-blocking for debug injection)
    emergencyFeed.connect().catch(() => {});

    // initial snapshot (optional; call only if explicitly enabled to avoid 404 noise)
    if (String(process.env.REACT_APP_ENABLE_EMERGENCY_SNAPSHOT || "false").toLowerCase() === "true") {
      emergencyFeed.fetchSnapshot().then((snap) => {
        if (!mounted || !snap) return;
        if (Array.isArray(snap.vehicles)) {
          const m = new Map();
          for (const v of snap.vehicles) {
            if (!v.vehicleId) continue;
            m.set(v.vehicleId, {
              vehicleId: v.vehicleId,
              x: v.x, y: v.y, netLat: v.y, netLng: v.x,
              speed: v.speed, heading: v.heading || 0,
              vehicleType: v.vehicleType || "other",
              emergencyState: v.emergencyState || "dispatched",
              routeId: v.routeId || null,
              lastTs: v.timestamp || Date.now(),
            });
          }
          setVehicles(m);
        }
        if (Array.isArray(snap.routes)) {
          const m = new Map();
          for (const r of snap.routes) {
            if (!r.routeId || !Array.isArray(r.coords)) continue;
            m.set(r.routeId, {
              routeId: r.routeId,
              coords: r.coords.map((p) => [p[1] ?? p.y, p[0] ?? p.x]),
              origin: r.origin, destination: r.destination,
              eta: r.eta, assignedVehicleId: r.assignedVehicleId,
              color: colorForId(r.routeId), lastTs: r.timestamp || Date.now(),
            });
          }
          setRoutes(m);
        }
      });
    }

    return () => { mounted = false; offV?.(); offR?.(); emergencyFeed.disconnect(); };
  }, []);

  // Derived lists and counts
  const vehicleList = useMemo(() => Array.from(vehicles.values()), [vehicles]);
  const activeCount = vehicleList.filter((v) => ["dispatched","en-route","on-scene","onscene"].includes(String(v.emergencyState||"").toLowerCase())).length;

  const selected = selectedId ? vehicles.get(selectedId) : null;
  const selectedRoute = useMemo(() => {
    const rid = selected?.routeId;
    if (!rid) return null;
    return routes.get(rid) || null;
  }, [selectedId, selected, routes]);

  const visibleVehicles = useMemo(() => {
    return vehicleList.filter((v) => {
      const t = normalizeType(v.vehicleType);
      return enabled && filters[t] && Number.isFinite(v.netLat) && Number.isFinite(v.netLng);
    });
  }, [vehicleList, enabled, filters]);

  const throttledVehicles = useThrottle(visibleVehicles, 50);

  // auto-follow
  const mapRef = useRef(null);
  useEffect(() => {
    if (!autoFollow || !selected || !mapRef.current) return;
    try { mapRef.current.setView([selected.netLat, selected.netLng], Math.max(14, mapRef.current.getZoom())); } catch (_) {}
  }, [autoFollow, selected]);

  return (
    <div className="emg-ops-root">
      {/* Top summary bar */}
      <div className="emg-topbar">
        <div className="emg-summary">
          <strong>Total active emergencies:</strong> <span>{activeCount}</span>
        </div>
        <div className="emg-controls">
          <label><input type="checkbox" checked={enabled} onChange={(e)=>setEnabled(e.target.checked)} /> Enable overlay</label>
          <label><input type="checkbox" checked={filters.ambulance} onChange={(e)=>setFilters(f=>({...f, ambulance:e.target.checked}))}/> Ambulance</label>
          <label><input type="checkbox" checked={filters.fire} onChange={(e)=>setFilters(f=>({...f, fire:e.target.checked}))}/> Fire</label>
          <label><input type="checkbox" checked={filters.police} onChange={(e)=>setFilters(f=>({...f, police:e.target.checked}))}/> Police</label>
          <label><input type="checkbox" checked={filters.other} onChange={(e)=>setFilters(f=>({...f, other:e.target.checked}))}/> Other</label>
          <label><input type="checkbox" checked={autoFollow} onChange={(e)=>setAutoFollow(e.target.checked)} /> Auto-follow</label>
          <label><input type="checkbox" checked={debug} onChange={(e)=>setDebug(e.target.checked)} /> Debug</label>
          <div className="emg-slider">
            <span>Overlay opacity</span>
            <input type="range" min={0.1} max={1} step={0.05} value={opacity} onChange={(e)=>setOpacity(Number(e.target.value))} />
          </div>
        </div>
      </div>

      <div className="emg-content">
        {/* Vehicle list */}
        <div className="emg-list">
          <input className="emg-search" placeholder="Search vehicle ID..." onChange={(e)=>filterList(e.target.value)} />
          <div className="emg-list-scroll">
            {vehicleList.map((v)=> (
              <button key={v.vehicleId} className={`emg-list-item ${selectedId===v.vehicleId?"selected":""}`} onClick={()=>handleSelect(v.vehicleId)}>
                <span className={`type-dot ${normalizeType(v.vehicleType)}`}></span>
                <span className="veh-id">{v.vehicleId}</span>
                <span className="veh-state">{String(v.emergencyState).replace("_"," ")}</span>
                <span className="veh-age">{timeAgo(v.lastTs)}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Map and details */}
        <div className="emg-map-panel">
          <MapContainer crs={L.CRS.Simple} whenCreated={(m)=> (mapRef.current=m)} style={{ width:"100%", height:"100%" }} zoomControl={true} minZoom={-5} maxZoom={24} preferCanvas>
            {net.bounds && (
              <FitToBounds bounds={L.latLngBounds([net.bounds.minY, net.bounds.minX],[net.bounds.maxY, net.bounds.maxX])} />
            )}
            {/* Base roads */}
            {net.lanes?.length>0 && (
              <Polyline positions={net.lanes.map(l=>l.points)} pathOptions={{ color:"#9ea3a8", weight:6, opacity:0.85 }} />
            )}
            {/* Routes */}
            {enabled && Array.from(routes.values()).map((r)=> (
              <Polyline key={r.routeId} positions={r.coords} pathOptions={{ color: r.color, weight: selected?.routeId===r.routeId?6:3, opacity: selected?.routeId===r.routeId?Math.min(1, opacity+0.2):opacity }} />
            ))}
            {/* Vehicles */}
            {enabled && throttledVehicles.map((v)=> (
              <Marker key={v.vehicleId} position={[v.netLat, v.netLng]} icon={VehicleIcon({ vehicle: v })} eventHandlers={{ click: () => handleSelect(v.vehicleId) }}>
                <Popup>
                  <div>
                    <div><strong>{v.vehicleId}</strong></div>
                    <div>Type: {normalizeType(v.vehicleType)}</div>
                    <div>State: {String(v.emergencyState)}</div>
                    {Number.isFinite(v.speed) && <div>Speed: {v.speed.toFixed(1)} m/s</div>}
                    {v.routeId && <div>Route: {v.routeId}</div>}
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>

          {/* Details panel */}
          <div className="emg-details">
            {selected ? (
              <div>
                <div className="emg-details-title">
                  <span className={`type-dot ${normalizeType(selected.vehicleType)}`}></span>
                  <strong>{selected.vehicleId}</strong>
                </div>
                <div className="emg-kv"><span>Status</span><span>{String(selected.emergencyState).replace("_"," ")}</span></div>
                {Number.isFinite(selected.speed) && (
                  <div className="emg-kv"><span>Speed</span><span>{selected.speed.toFixed(1)} m/s</span></div>
                )}
                <div className="emg-kv"><span>Last update</span><span>{timeAgo(selected.lastTs)}</span></div>
                <div className="emg-actions">
                  <button onClick={()=>setAutoFollow((v)=>!v)}>{autoFollow?"Stop follow":"Auto-follow"}</button>
                  <button onClick={()=>zoomToSelected(mapRef.current, selected)}>Zoom to vehicle</button>
                  {selected.routeId && <button onClick={()=>requestRouteFor(selected, routes, emergencyFeed)}>Fetch route</button>}
                </div>
                {selectedRoute && (
                  <div className="emg-route-box">
                    <div className="emg-kv"><span>Route</span><span>{selectedRoute.routeId}</span></div>
                    {selectedRoute.eta && <div className="emg-kv"><span>ETA</span><span>{selectedRoute.eta}</span></div>}
                    <div className="emg-kv"><span>Coords</span><span>{selectedRoute.coords.length}</span></div>
                  </div>
                )}
              </div>
            ) : (
              <div className="emg-empty">Select a vehicle from the list</div>
            )}
          </div>
        </div>
      </div>

      {debug && (
        <div style={{ position:"fixed", right: 12, bottom: 12, display:"flex", gap:8, zIndex: 10000 }}>
          <button onClick={injectSmoke3} style={{ padding:"6px 10px", border:"1px solid #ddd", borderRadius:4, background:"#fff"}}>
            Inject 3 vehicles
          </button>
          <button onClick={injectRouteForSelected} disabled={!selectedId} style={{ padding:"6px 10px", border:"1px solid #ddd", borderRadius:4, background:"#fff"}}>
            Inject route (selected)
          </button>
          <button onClick={startDemo} style={{ padding:"6px 10px", border:"1px solid #ddd", borderRadius:4, background:"#fff"}}>
            Start demo motion
          </button>
          <button onClick={stopDemo} style={{ padding:"6px 10px", border:"1px solid #ddd", borderRadius:4, background:"#fff"}}>
            Stop
          </button>
        </div>
      )}
    </div>
  );

  function handleSelect(id) {
    setSelectedId(id);
  }
  function filterList(q) {
    const s = String(q || "").trim().toLowerCase();
    if (!s) return;
    const first = vehicleList.find((v)=> String(v.vehicleId).toLowerCase().includes(s));
    if (first) setSelectedId(first.vehicleId);
  }

  function injectSmoke3() {
    const ts = Date.now();
    const base = [
      { vehicleId: "AMB-101", x: (net.bounds?.minX||0)+200, y: (net.bounds?.minY||0)+200, speed: 11.2, heading: 45, vehicleType: "ambulance", emergencyState: "en-route" },
      { vehicleId: "FIRE-7", x: (net.bounds?.minX||0)+260, y: (net.bounds?.minY||0)+240, speed: 9.4, heading: 180, vehicleType: "fire", emergencyState: "dispatched" },
      { vehicleId: "POL-42", x: (net.bounds?.minX||0)+300, y: (net.bounds?.minY||0)+220, speed: 13.0, heading: 320, vehicleType: "police", emergencyState: "on-scene" },
    ];
    emergencyFeed.devEmitVehicles({ timestamp: ts, vehicles: base });
    // auto select first and follow for convenience
    setSelectedId("AMB-101");
    setAutoFollow(true);
    try { if (mapRef.current) mapRef.current.setView([base[0].y, base[0].x], Math.max(16, mapRef.current.getZoom()||16)); } catch (_) {}
  }

  function injectRouteForSelected() {
    const v = selectedId ? vehicles.get(selectedId) : null;
    if (!v) return;
    const rid = v.routeId || `R-${v.vehicleId}`;
    const coords = [];
    for (let i=0;i<20;i++){ coords.push([ (v.x||v.netLng)+i*5, (v.y||v.netLat)+Math.sin(i/2)*8 ]); }
    const toLatLng = coords.map(([x,y])=> [x, y]);
    emergencyFeed.devEmitRoutes({ timestamp: Date.now(), routes: [{ routeId: rid, coords: toLatLng, assignedVehicleId: v.vehicleId, eta: "3m" }]});
  }

  // Demo motion: periodically emit slight position updates for injected vehicles
  const demoTimerRef = useRef(null);
  const demoVelRef = useRef(new Map());
  function startDemo() {
    if (demoTimerRef.current) return;
    // seed velocities per vehicle
    const vels = new Map();
    for (const v of vehicles.values()) {
      const seed = (str) => Array.from(String(str)).reduce((a,c)=>a+c.charCodeAt(0),0);
      const s = seed(v.vehicleId);
      const dx = ((s % 5) + 3) * 0.8; // 2.4..6.4
      const dy = (((s>>3) % 5) - 2) * 0.6; // -1.2..1.8
      vels.set(v.vehicleId, { dx, dy });
    }
    demoVelRef.current = vels;
    demoTimerRef.current = setInterval(() => {
      const ts = Date.now();
      const next = [];
      for (const v of vehicles.values()) {
        const vel = demoVelRef.current.get(v.vehicleId) || { dx: 3, dy: 0 };
        const x = (v.x ?? v.netLng ?? 0) + vel.dx;
        const y = (v.y ?? v.netLat ?? 0) + vel.dy;
        next.push({ vehicleId: v.vehicleId, x, y, speed: v.speed ?? 10, heading: v.heading ?? 0, vehicleType: v.vehicleType, emergencyState: v.emergencyState, routeId: v.routeId });
      }
      if (next.length) emergencyFeed.devEmitVehicles({ timestamp: ts, vehicles: next });
      // auto-follow keep center
      const sel = selectedId ? vehicles.get(selectedId) : null;
      if (sel && mapRef.current) {
        const lat = (sel.netLat ?? sel.y);
        const lng = (sel.netLng ?? sel.x);
        if (Number.isFinite(lat) && Number.isFinite(lng) && autoFollow) {
          try { mapRef.current.setView([lat, lng]); } catch(_) {}
        }
      }
    }, 800);
  }
  function stopDemo() { if (demoTimerRef.current) { clearInterval(demoTimerRef.current); demoTimerRef.current = null; } }
}

function zoomToSelected(map, v) {
  if (!map || !v) return;
  const lat = Number.isFinite(v.netLat) ? v.netLat : v.y;
  const lng = Number.isFinite(v.netLng) ? v.netLng : v.x;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
  try { map.setView([lat, lng], Math.max(16, map.getZoom()||16)); } catch (_) {}
}

function requestRouteFor(v, routes, feed) {
  if (!v) return;
  const rid = v.routeId;
  if (rid && routes.has(rid)) return; // cached
  feed.requestRoute({ vehicleId: v.vehicleId, routeId: rid });
}

function normalizeType(t) {
  const s = String(t||"other").toLowerCase();
  if (s.includes("ambulance")) return "ambulance";
  if (s.includes("fire")) return "fire";
  if (s.includes("police")) return "police";
  return "other";
}

function colorForId(id) {
  const str = String(id || "");
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
  const hue = h % 360;
  return `hsl(${hue}, 70%, 50%)`;
}

function timeAgo(ts) {
  if (!ts) return "–";
  const d = Date.now() - Number(ts);
  if (d < 2000) return "just now";
  const s = Math.floor(d / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  return `${h}h ago`;
}