import React, { useEffect, useRef, useState } from "react";
import PageLayout from "../components/PageLayout";
import EmergencyOps from "../modules/emergency/EmergencyOps";
import { FEATURES } from "../config/features";
import { api } from "../utils/api";
import io from "socket.io-client";

export default function EmergencyPanel() {
  // Feature-flag: render new Emergency Operations module or fallback to legacy panel
  if (FEATURES.emergencyOps) {
    return (
      <PageLayout title="Emergency Operations" subtitle="Live emergency vehicles, routes, and stats (beta)">
        <div style={{ height: "calc(100vh - 180px)", minHeight: 480 }}>
          <EmergencyOps />
        </div>
      </PageLayout>
    );
  }

  // Legacy panel fallback
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isRunning, setIsRunning] = useState(false);

  // Manual override logs (from audit), grouped by simulationId -> items
  const [logsBySim, setLogsBySim] = useState({});
  const [expanded, setExpanded] = useState({}); // dropdown expansion per simulation
  const [logLoading, setLogLoading] = useState(false);
  const [socketConnected, setSocketConnected] = useState(false);
  const socketRef = useRef(null);

  const loadEmergencies = async () => {
    try {
      setLoading(true);
      const res = await api.listEmergencies();
      setItems(res.items || []);
    } catch (_) {
    } finally {
      setLoading(false);
    }
  };

  const loadStatus = async () => {
    try {
      const s = await fetch((process.env.REACT_APP_API_BASE || "http://localhost:5001") + "/api/sumo/status", {
        credentials: "include",
      });
      const data = await s.json();
      setIsRunning(!!data?.isRunning);
    } catch (_) {
      setIsRunning(false);
    }
  };

  const loadOverrideLogs = async () => {
    try {
      setLogLoading(true);
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      // Fetch last 24h audit logs
      const res = await api.listAuditLogs({ startDate: since, limit: 500 });
      const items = Array.isArray(res.items) ? res.items : res.items?.items || []; // tolerate different shapes

      // Filter for manual override-related actions
      const relevant = (items || []).filter(
        (a) => a.action === "tls_state_control" || a.action === "tls_phase_control" || a.action === "intersection_override"
      );

      // Group by simulationId in meta (fallback to "Unknown")
      const grouped = {};
      for (const a of relevant) {
        const simId = a.meta?.simulationId || "Unknown";
        if (!grouped[simId]) grouped[simId] = [];
        grouped[simId].push(a);
      }

      // Sort each group's logs desc by time
      Object.keys(grouped).forEach((sid) => {
        grouped[sid].sort((x, y) => new Date(y.time || y.timestamp || 0) - new Date(x.time || x.timestamp || 0));
      });

      // Sort simulations by most recent log time
      const ordered = Object.fromEntries(
        Object.entries(grouped).sort(([, a], [, b]) => {
          const ta = new Date(a[0]?.time || a[0]?.timestamp || 0).getTime();
          const tb = new Date(b[0]?.time || b[0]?.timestamp || 0).getTime();
          return tb - ta;
        })
      );

      setLogsBySim(ordered);
    } catch (e) {
      // soft fail
    } finally {
      setLogLoading(false);
    }
  };

  useEffect(() => {
    loadEmergencies();
    loadStatus();
    loadOverrideLogs();

    // Poll emergencies and status periodically
    const eInt = setInterval(loadEmergencies, 10000);
    const sInt = setInterval(loadStatus, 15000);
    const lInt = setInterval(loadOverrideLogs, 10000);

    // Also listen to socket for immediate updates
    socketRef.current = io(process.env.REACT_APP_API_BASE || "http://localhost:5001", {
      transports: ["websocket"],
    });
    socketRef.current.on("connect", () => setSocketConnected(true));
    socketRef.current.on("disconnect", () => setSocketConnected(false));
    socketRef.current.on("simulationStatus", (s) => setIsRunning(!!s?.isRunning));
    socketRef.current.on("simulationLog", () => loadOverrideLogs());

    return () => {
      clearInterval(eInt);
      clearInterval(sInt);
      clearInterval(lInt);
      try { socketRef.current?.disconnect(); } catch (_) {}
    };
  }, []);

  const toggleSim = (sid) => setExpanded((prev) => ({ ...prev, [sid]: !prev[sid] }));

  const activeCount = items.length;

  return (
    <PageLayout title="Emergency Operations" subtitle={isRunning ? "Simulation running" : "Simulation stopped"}>
      <div className="space-y-6">
        {/* Stats Overview (only Active Emergencies) */}
        <div className="grid gap-4 md:grid-cols-3">
          <div className="card shadow-card p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Active Emergencies</p>
                <p className="text-2xl font-bold text-red-600 dark:text-red-400">{activeCount}</p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={loadEmergencies}
                  className="px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
                  disabled={loading}
                >
                  {loading ? "Refreshing..." : "Refresh"}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Manual Overrides Log (last 24h), grouped by simulationId */}
        <div className="card shadow-card p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Logs</h2>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1 text-xs">
                <span
                  className={`inline-block w-2 h-2 rounded-full ${isRunning ? "bg-green-500" : "bg-red-500"}`}
                ></span>
                <span className="text-muted-foreground">
                  {isRunning ? "Live" : "Offline"}
                </span>
              </div>
              <button
                onClick={loadOverrideLogs}
                className="px-3 py-1 text-sm bg-gray-200 dark:bg-gray-700 rounded hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                disabled={logLoading}
              >
                {logLoading ? "Refreshing..." : "Refresh"}
              </button>
            </div>
          </div>

          {Object.keys(logsBySim).length === 0 ? (
            <div className="text-sm text-muted-foreground">No manual overrides recorded in the last 24 hours.</div>
          ) : (
            <div className="space-y-3">
              {Object.entries(logsBySim).map(([simId, entries]) => (
                <div key={simId} className="border rounded-md">
                  <button
                    className="w-full text-left p-3 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center justify-between"
                    onClick={() => toggleSim(simId)}
                  >
                    <span className="font-medium">
                      Simulation: {simId === "Unknown" ? "Unknown" : simId} ({entries.length} events)
                    </span>
                    <span>{expanded[simId] ? "▲" : "▼"}</span>
                  </button>
                  {expanded[simId] && (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-gray-200 dark:border-gray-700">
                            <th className="text-left p-2">Event ID</th>
                            <th className="text-left p-2">Timestamp</th>
                            <th className="text-left p-2">User</th>
                            <th className="text-left p-2">Vehicle Type</th>
                            <th className="text-left p-2">Intersection</th>
                            <th className="text-left p-2">Action</th>
                            <th className="text-left p-2">Outcome</th>
                          </tr>
                        </thead>
                        <tbody>
                          {entries.map((e) => (
                            <tr key={e._id || e.id} className="border-b border-gray-100 dark:border-gray-800">
                              <td className="p-2 font-mono text-xs">{e._id || e.id}</td>
                              <td className="p-2">{new Date(e.time || e.timestamp || Date.now()).toLocaleString()}</td>
                              <td className="p-2">{e.user || e.username || "—"}</td>
                              <td className="p-2">{e.meta?.vehicleType || "—"}</td>
                              <td className="p-2">{e.meta?.actualTlsId || e.target || "—"}</td>
                              <td className="p-2">{e.action}</td>
                              <td className="p-2">{e.meta?.outcome || "success"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </PageLayout>
  );
}
