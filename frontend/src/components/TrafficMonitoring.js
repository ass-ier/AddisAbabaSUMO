import React, { useState, useEffect, useCallback, useRef } from "react";
import io from "socket.io-client";
import "./TrafficMonitoring.css";
import PageLayout from "./PageLayout";
import { api, BASE_API } from "../utils/api";
import LiveIntersectionMap from "./LiveIntersectionMap";
import TrafficLightModal from "./TrafficLightModal";
import { parseSumoNetXml } from "../utils/sumoNetParser";

const TrafficMonitoring = () => {
  const [trafficData, setTrafficData] = useState([]); // raw or aggregated depending on mode
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState(() => {
    // Default to last 7 days to show seeded data
    const end = new Date();
    const start = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const toLocal = (d) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    return {
      intersectionId: "",
      startDate: toLocal(start),
      endDate: toLocal(end),
    };
  });
  const [intervalMinutes] = useState(30);
  const [liveRequested, setLiveRequested] = useState(false);
  const [simRunning, setSimRunning] = useState(false);
  const [statusMsg, setStatusMsg] = useState("");
  const [liveStats, setLiveStats] = useState({ visibleVehicles: 0, avgSpeedMs: 0 });
  const [tlsModal, setTlsModal] = useState({ open: false, id: null, timing: {}, program: {}, currentPhase: null });
  const handleStats = useCallback((s) => setLiveStats(s), []);
  const [clusterIds, setClusterIds] = useState([]);
  const [tlsByJunction, setTlsByJunction] = useState({}); // junctionId -> clusterId
  const socketRef = useRef(null);
  const statusPollRef = useRef(null);
  const liveBucketsRef = useRef(new Map());

  const bucketStart = (ts) => {
    const d = typeof ts === "number" ? new Date(ts) : new Date(ts);
    const msec = d.getTime();
    const size = intervalMinutes * 60 * 1000;
    const start = Math.floor(msec / size) * size;
    return new Date(start);
  };

  // Render long cluster IDs on two lines to reduce horizontal scroll
  const renderTwoLineId = (val) => {
    const s = String(val || "");
    if (!s) return "";
    const mid = Math.floor(s.length / 2);
    // Try to break near an underscore close to the middle
    let br = s.lastIndexOf("_", mid);
    if (br < Math.floor(s.length * 0.3)) br = s.indexOf("_", mid);
    if (br === -1) br = mid;
    return (
      <>
        {s.slice(0, br)}
        <br />
        {s.slice(br)}
      </>
    );
  };

  const normalizeFlows = (flows = {}, direction, count = 0) => {
    const keys = ["n","s","e","w","north","south","east","west","N","S","E","W"];
    const out = { N: 0, S: 0, E: 0, W: 0 };
    // If flows object present, map to N/S/E/W
    if (flows && typeof flows === "object") {
      keys.forEach((k) => {
        if (flows[k] != null) {
          const val = Number(flows[k]) || 0;
          const kk = k[0].toUpperCase();
          if (out[kk] != null) out[kk] += val;
        }
      });
    }
    // If single direction/count provided
    if (direction) {
      const kk = (direction[0] || "").toUpperCase();
      if (out[kk] != null) out[kk] += Number(count) || 0;
    }
    return out;
  };

  const aggregateByInterval = (records = []) => {
    const groups = new Map();
    records.forEach((r) => {
      const ts = r.timestamp || r.time || Date.now();
      const b = bucketStart(ts);
      const key = `${r.intersectionId || r.tls_id || r.id || "unknown"}|${b.toISOString()}`;
      if (!groups.has(key)) {
        groups.set(key, {
          bucketStart: b.toISOString(),
          bucketEnd: new Date(b.getTime() + intervalMinutes * 60 * 1000).toISOString(),
          intersectionId: r.intersectionId || r.tls_id || r.id || "unknown",
          vehicleCount: 0,
          waitingTimeTotal: 0,
          waitingTimeSamples: 0,
          throughput: 0,
          flows: { N: 0, S: 0, E: 0, W: 0 },
        });
      }
      const g = groups.get(key);
      const vc = Number(r.vehicleCount ?? r.count ?? 0) || 0;
      g.vehicleCount += vc;
      g.throughput += vc; // vehicles per bucket; can compute per-hour if needed in UI
      if (r.waitingTime != null) {
        g.waitingTimeTotal += Number(r.waitingTime) || 0;
        g.waitingTimeSamples += 1;
      } else if (r.avgWaitingTime != null) {
        // Support pre-aggregated rows seeded in DB
        g.waitingTimeTotal += Number(r.avgWaitingTime) || 0;
        g.waitingTimeSamples += 1;
      }
      // Merge flows
      const merged = normalizeFlows(r.flows, r.direction, vc);
      g.flows.N += merged.N;
      g.flows.S += merged.S;
      g.flows.E += merged.E;
      g.flows.W += merged.W;
    });
    // finalize
    return Array.from(groups.values()).map((g) => ({
      ...g,
      avgWaitingTime: g.waitingTimeSamples ? g.waitingTimeTotal / g.waitingTimeSamples : 0,
    })).sort((a, b) => new Date(b.bucketStart) - new Date(a.bucketStart));
  };

  const fetchTrafficData = useCallback(async () => {
    try {
      setLoading(true);
      const params = {
        // Backend expects intersectionId; we store clusterId in that field
        intersectionId: filters.intersectionId || undefined,
        startDate: filters.startDate || undefined,
        endDate: filters.endDate || undefined,
        intervalMinutes,
      };
      // Fetch raw records; aggregate client-side for 30-minute buckets
      const data = await api.getTrafficData(params);
      const processed = Array.isArray(data) ? data : data?.items || [];
      const finalData = aggregateByInterval(processed).map((d) => {
        const cid = d.clusterId || d.tls_id || tlsByJunction[d.intersectionId] || d.intersectionId;
        return { ...d, clusterId: cid };
      });
      // If a specific cluster filter is set, enforce it client-side as well
      const filtered = filters.intersectionId
        ? finalData.filter((d) => (d.clusterId || d.intersectionId) === filters.intersectionId)
        : finalData;
      setTrafficData(filtered);
      setStatusMsg("");
    } catch (error) {
      console.error("Error fetching traffic data:", error);
    } finally {
      setLoading(false);
    }
  }, [filters, intervalMinutes]);

  useEffect(() => {
    if (!liveRequested) {
      fetchTrafficData();
    }
  }, [filters, fetchTrafficData, liveRequested]);

  // Load TLS cluster IDs from SUMO net to power the Cluster ID selector
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const net = await parseSumoNetXml("/Sumoconfigs/AddisAbaba.net.xml");
        const tls = Array.isArray(net?.tls) ? net.tls : [];
        const ids = Array.from(new Set(tls.map(t => t.clusterId || t.id))).sort();
        const map = {};
        tls.forEach(t => { if (t?.id) map[t.id] = t.clusterId || t.id; });
        if (!cancelled) { setClusterIds(ids); setTlsByJunction(map); }
      } catch (_) {
        // ignore
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Monitor SUMO status only when live is requested
  useEffect(() => {
    const checkStatus = async () => {
      try {
        const res = await api.getSumoStatus();
        const running = !!res?.isRunning;
        setSimRunning(running);
        if (!running && liveRequested) {
          setStatusMsg("No simulation running currently");
          // Also ensure some data is shown: load latest stored aggregates if filters set
          if (filters.startDate || filters.endDate || filters.intersectionId) {
            fetchTrafficData();
          }
        } else {
          setStatusMsg("");
        }
      } catch (e) {
        setSimRunning(false);
        if (liveRequested) {
          setStatusMsg("No simulation running currently");
        }
      }
    };

    if (liveRequested) {
      checkStatus();
      statusPollRef.current = setInterval(checkStatus, 15000);
      return () => {
        if (statusPollRef.current) {
          clearInterval(statusPollRef.current);
          statusPollRef.current = null;
        }
      };
    }
    // if not live, ensure status cleared and any socket disconnected happens in other effect
    setStatusMsg("");
    return undefined;
  }, [liveRequested, fetchTrafficData, filters]);

  useEffect(() => {
    if (!liveRequested || !simRunning) {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      // reset live buckets when leaving live mode
      liveBucketsRef.current = new Map();
      return;
    }
    // Connect to simulation stream
    socketRef.current = io(BASE_API, { transports: ["websocket"] });
    socketRef.current.on("trafficData", (data) => {
      // Optional filter by intersection
      if (filters.intersectionId) {
        const did = data.intersectionId || data.tls_id || data.clusterId || data.id;
        if (did && did !== filters.intersectionId) return;
      }
      // Bucketize
      const ts = data.timestamp || Date.now();
      const b = bucketStart(ts);
      const cid = data.clusterId || data.tls_id || tlsByJunction[data.intersectionId] || data.intersectionId || "unknown";
      const key = `${cid}|${b.toISOString()}`;
      const existing = liveBucketsRef.current.get(key) || {
        bucketStart: b.toISOString(),
        bucketEnd: new Date(b.getTime() + intervalMinutes * 60 * 1000).toISOString(),
        intersectionId: cid,
        clusterId: cid,
        vehicleCount: 0,
        throughput: 0,
        waitingTimeTotal: 0,
        waitingTimeSamples: 0,
        flows: { N: 0, S: 0, E: 0, W: 0 },
      };
      const vc = Number(data.vehicleCount ?? data.count ?? 0) || 0;
      const merged = normalizeFlows(data.flows, data.direction, vc);
      const next = {
        ...existing,
        clusterId: cid,
        vehicleCount: existing.vehicleCount + vc,
        throughput: existing.throughput + vc,
        waitingTimeTotal: existing.waitingTimeTotal + (Number(data.waitingTime) || 0),
        waitingTimeSamples: existing.waitingTimeSamples + (data.waitingTime != null ? 1 : 0),
        flows: {
          N: existing.flows.N + merged.N,
          S: existing.flows.S + merged.S,
          E: existing.flows.E + merged.E,
          W: existing.flows.W + merged.W,
        },
      };
      liveBucketsRef.current.set(key, next);
      // Project to array for display
      const arr = Array.from(liveBucketsRef.current.values()).map((g) => ({
        ...g,
        avgWaitingTime: g.waitingTimeSamples ? g.waitingTimeTotal / g.waitingTimeSamples : 0,
      })).sort((a, b) => new Date(b.bucketStart) - new Date(a.bucketStart));
      setTrafficData(arr);
    });
    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, [liveRequested, simRunning, intervalMinutes, filters.intersectionId]);

  const handleFilterChange = (e) => {
    setFilters({
      ...filters,
      [e.target.name]: e.target.value,
    });
  };

  const handleFilterSubmit = (e) => {
    e.preventDefault();
    if (!liveRequested) fetchTrafficData();
  };

  const clearFilters = () => {
    setFilters({
      intersectionId: "",
      startDate: "",
      endDate: "",
    });
    fetchTrafficData();
  };

  const exportCsv = () => {
    if (!trafficData?.length) return;
    const headers = [
      "bucketStart",
      "bucketEnd",
      "clusterId",
      "vehicles",
      "throughput",
      "avgWaitingTime",
      "flowsN",
      "flowsS",
      "flowsE",
      "flowsW",
    ];
    const rows = trafficData.map((d) => [
      d.bucketStart,
      d.bucketEnd,
      d.clusterId ?? d.tls_id ?? d.intersectionId ?? "",
      d.vehicles ?? d.vehicleCount ?? 0,
      d.throughput ?? d.vehicleCount ?? 0,
      Math.round((d.avgWaitingTime ?? 0) * 10) / 10,
      d.flows?.N ?? 0,
      d.flows?.S ?? 0,
      d.flows?.E ?? 0,
      d.flows?.W ?? 0,
    ]);
    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "traffic-data.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(trafficData, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "traffic-data.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  // Deprecated color helper retained if future status badges needed
  const getSignalStatusColor = (status) => {
    switch ((status || "").toLowerCase()) {
      case "green":
        return "#4CAF50";
      case "yellow":
        return "#FF9800";
      case "red":
        return "#F44336";
      default:
        return "#9E9E9E";
    }
  };

  return (
    <PageLayout
      title="Traffic Monitoring"
      subtitle="Monitor real-time traffic data and intersection status"
    >
      <div className="monitoring-controls">
        <form onSubmit={handleFilterSubmit} className="filter-form">
          <div className="filter-group">
            <label htmlFor="intersectionId">Cluster ID:</label>
            <input
              type="text"
              id="intersectionId"
              name="intersectionId"
              value={filters.intersectionId}
              onChange={handleFilterChange}
              placeholder="Enter cluster ID (TLS)"
              list="clusterIdOptions"
            />
            <datalist id="clusterIdOptions">
              {clusterIds.map((id) => (
                <option key={id} value={id} />
              ))}
            </datalist>
          </div>

          <div className="filter-group">
            <label htmlFor="startDate">Start Date:</label>
            <input
              type="datetime-local"
              id="startDate"
              name="startDate"
              value={filters.startDate}
              onChange={handleFilterChange}
            />
          </div>

          <div className="filter-group">
            <label htmlFor="endDate">End Date:</label>
            <input
              type="datetime-local"
              id="endDate"
              name="endDate"
              value={filters.endDate}
              onChange={handleFilterChange}
            />
          </div>

          <div className="filter-actions">
            <button type="submit" className="btn-primary">
              Apply Filters
            </button>
            <button
              type="button"
              onClick={clearFilters}
              className="btn-secondary"
            >
              Clear
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => {
                const end = new Date();
                const start = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
                const toLocal = (d) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
                setFilters((f) => ({ ...f, startDate: toLocal(start), endDate: toLocal(end) }));
              }}
              title="Set range to last 7 days"
            >
              Last 7 days
            </button>
            <label className="live-toggle">
              <input
                type="checkbox"
                checked={liveRequested}
                onChange={(e) => setLiveRequested(e.target.checked)}
              />
              Live
            </label>
          </div>
        </form>
      </div>

      {liveRequested && (
        <div className="traffic-data-section" style={{ marginTop: 16 }}>
          <div className="section-header">
            <h2>Live Intersection View</h2>
          </div>
          {simRunning ? (
            filters.intersectionId ? (
              <LiveIntersectionMap
                intersectionId={filters.intersectionId}
                paddingMeters={150}
                onStats={handleStats}
                onTlsClick={(id, live) => setTlsModal({ open: true, id, timing: live?.timing || {}, program: live?.program || {}, currentPhase: { currentIndex: live?.timing?.currentIndex } })}
              />
            ) : (
              <div className="no-data">
                <p>Enter an Intersection ID to focus the live map.</p>
              </div>
            )
          ) : (
            statusMsg && <div className="no-data"><p>{statusMsg}</p></div>
          )}
        </div>
      )}

      <div className="traffic-data-section">
        <div className="section-header">
          <h2>Traffic Data (30-minute intervals)</h2>
          <div className="section-actions">
            <button onClick={fetchTrafficData} className="btn-secondary" disabled={liveRequested}>
              Refresh Data
            </button>
            <button onClick={exportCsv} className="btn-secondary">
              Export CSV
            </button>
            <button onClick={exportJson} className="btn-secondary">
              Export JSON
            </button>
          </div>
        </div>

        {liveRequested && !simRunning && statusMsg && (
          <div className="no-data"><p>{statusMsg}</p></div>
        )}

        {loading ? (
          <div className="loading">Loading traffic data...</div>
        ) : (
          <div className="traffic-data-table">
            {trafficData.length > 0 ? (
              <table>
                <thead>
                  <tr>
                    <th>Time Window</th>
                    <th>Cluster ID</th>
                    <th>Flows (N/E/S/W)</th>
                    <th>Vehicles</th>
                    <th>Throughput</th>
                    <th>Avg Waiting (s)</th>
                  </tr>
                </thead>
                <tbody>
                  {trafficData.map((data, index) => (
                    <tr key={index}>
                      <td>
                        {data.bucketStart && data.bucketEnd
                          ? `${new Date(data.bucketStart).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})} - ${new Date(data.bucketEnd).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})}`
                          : ""}
                      </td>
                      <td><span className="cluster-id">{renderTwoLineId(data.clusterId || data.tls_id || data.intersectionId)}</span></td>
                      <td>{`${data.flows?.N ?? 0}/${data.flows?.E ?? 0}/${data.flows?.S ?? 0}/${data.flows?.W ?? 0}`}</td>
                      <td>{data.vehicleCount || 0}</td>
                      <td>{data.throughput ?? data.vehicleCount ?? 0}</td>
                      <td>{Math.round((data.avgWaitingTime || 0) * 10) / 10}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="no-data">
                <p>No traffic data found for the selected inputs.</p>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="traffic-summary">
        <h2>Traffic Summary</h2>
        <div className="summary-cards">
          {liveRequested ? (
            <>
              <div className="summary-card">
                <h3>Visible Vehicles</h3>
                <p>{liveStats.visibleVehicles || 0}</p>
              </div>
              <div className="summary-card">
                <h3>Avg Speed (km/h)</h3>
                <p>{Math.round(((liveStats.avgSpeedMs || 0) * 3.6) * 10) / 10}</p>
              </div>
              <div className="summary-card">
                <h3>Total Buckets (30m)</h3>
                <p>{trafficData.length}</p>
              </div>
              <div className="summary-card">
                <h3>Avg Waiting (s)</h3>
                <p>
                  {trafficData.length > 0
                    ? Math.round(
                        (trafficData.reduce(
                          (sum, d) => sum + (d.avgWaitingTime || 0),
                          0
                        ) / trafficData.length) * 10
                      ) / 10
                    : 0}
                </p>
              </div>
            </>
          ) : (
            <>
              <div className="summary-card">
                <h3>Total Buckets</h3>
                <p>{trafficData.length}</p>
              </div>
              <div className="summary-card">
                <h3>Avg Vehicles / 30m</h3>
                <p>
                  {trafficData.length > 0
                    ? Math.round(
                        trafficData.reduce(
                          (sum, d) => sum + (d.vehicleCount || 0),
                          0
                        ) / trafficData.length
                      )
                    : 0}
                </p>
              </div>
              <div className="summary-card">
                <h3>Avg Waiting (s)</h3>
                <p>
                  {trafficData.length > 0
                    ? Math.round(
                        (trafficData.reduce(
                          (sum, d) => sum + (d.avgWaitingTime || 0),
                          0
                        ) / trafficData.length) * 10
                      ) / 10
                    : 0}
                </p>
              </div>
              <div className="summary-card">
                <h3>Unique Intersections</h3>
                <p>
                  {new Set(trafficData.map((d) => d.intersectionId)).size}
                </p>
              </div>
            </>
          )}
        </div>
      </div>

      {tlsModal.open && (
        <TrafficLightModal
          tlsId={tlsModal.id}
          isOpen={tlsModal.open}
          onClose={() => setTlsModal({ open: false, id: null, timing: {}, program: {}, currentPhase: null })}
          currentPhase={tlsModal.currentPhase}
          timing={tlsModal.timing}
          program={tlsModal.program}
        />
      )}
    </PageLayout>
  );
};

export default TrafficMonitoring;
