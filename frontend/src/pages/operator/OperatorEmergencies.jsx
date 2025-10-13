import React, { useEffect, useRef, useState } from "react";
import PageLayout from "../../components/PageLayout";
import { api } from "../../utils/api";
import io from "socket.io-client";
import "../../components/Dashboard.css";

export default function OperatorEmergencies() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    try {
      setLoading(true);
      const res = await api.listEmergencies();
      setItems(res.items || []);
    } catch (err) {
      console.error("Failed to load emergencies:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // Refresh every 10 seconds for real-time updates
    const interval = setInterval(load, 10000);
    return () => clearInterval(interval);
  }, []);

  const acknowledgeEmergency = (id) => {
    // Operator acknowledges they've seen the emergency
    window.dispatchEvent(
      new CustomEvent("notify", {
        detail: { type: "success", message: "Emergency acknowledged" },
      })
    );
    // In a real system, this would update the backend
    console.log("Acknowledged emergency:", id);
  };

  const getStatusBadge = (priority) => {
    const colors = {
      high: "bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400",
      medium:
        "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400",
      low: "bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400",
    };
    return colors[priority] || colors.medium;
  };

  // Logs state and loaders (last 24h, refresh every 10s)
  const [logs, setLogs] = useState([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [socketConnected, setSocketConnected] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const socketRef = useRef(null);

  const loadLogs = async () => {
    try {
      setLogsLoading(true);
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const res = await api.listAuditLogs({ startDate: since, limit: 300 });
      const all = Array.isArray(res.items) ? res.items : res.items?.items || [];
      const relevant = (all || []).filter(
        (a) => a.action === "tls_state_control" || a.action === "tls_phase_control" || a.action === "intersection_override"
      );
      // newest first
      relevant.sort((a, b) => new Date(b.time || b.timestamp || 0) - new Date(a.time || a.timestamp || 0));
      setLogs(relevant);
    } catch (e) {
      // ignore
    } finally {
      setLogsLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();
    const i = setInterval(loadLogs, 10000);

    // Track simulation status to drive Live/Offline indicator
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
    loadStatus();
    const statusInt = setInterval(loadStatus, 15000);

    // WebSocket for immediate log refresh (indicator driven by simulation status)
    socketRef.current = io(process.env.REACT_APP_API_BASE || "http://localhost:5001", {
      transports: ["websocket"],
    });
    socketRef.current.on("connect", () => setSocketConnected(true));
    socketRef.current.on("disconnect", () => setSocketConnected(false));
    socketRef.current.on("simulationStatus", (s) => setIsRunning(!!s?.isRunning));
    socketRef.current.on("simulationLog", () => {
      // refresh logs immediately when a new simulation log arrives
      loadLogs();
    });

    return () => {
      clearInterval(i);
      clearInterval(statusInt);
      try {
        socketRef.current?.disconnect();
      } catch (_) {}
    };
  }, []);

  return (
    <PageLayout
      title="Emergency Operations"
      subtitle="Monitor and respond to active emergencies"
    >
      <div className="space-y-6">
        {/* Stats Overview */}
        <div className="grid gap-4 md:grid-cols-3">
          <div className="card shadow-card p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">
                  Active Emergencies
                </p>
                <p className="text-2xl font-bold text-red-600 dark:text-red-400">
                  {items.length}
                </p>
              </div>
              <span className="text-3xl">🚨</span>
            </div>
          </div>
        </div>

        {/* Logs Section */}
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
                onClick={loadLogs}
                className="px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
                disabled={logsLoading}
              >
                {logsLoading ? "Refreshing..." : "Refresh"}
              </button>
            </div>
          </div>

          {logsLoading ? (
            <div className="text-center py-8 text-muted-foreground">
              Loading logs...
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-8">
              <span className="text-4xl mb-2 block">📭</span>
              <p className="text-muted-foreground">No logs found in the last 24 hours.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700">
                    <th className="text-left p-3 font-semibold">Event ID</th>
                    <th className="text-left p-3 font-semibold">Timestamp</th>
                    <th className="text-left p-3 font-semibold">User</th>
                    <th className="text-left p-3 font-semibold">Vehicle Type</th>
                    <th className="text-left p-3 font-semibold">Intersection</th>
                    <th className="text-left p-3 font-semibold">Outcome</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((e) => (
                    <tr key={e._id || e.id} className="border-b border-gray-100 dark:border-gray-800">
                      <td className="p-3 font-mono text-xs">{e._id || e.id}</td>
                      <td className="p-3">{new Date(e.time || e.timestamp || Date.now()).toLocaleString()}</td>
                      <td className="p-3">{e.user || e.username || "—"}</td>
                      <td className="p-3">{e.meta?.vehicleType || "—"}</td>
                      <td className="p-3">{e.meta?.actualTlsId || e.target || "—"}</td>
                      <td className="p-3">{e.meta?.outcome || "success"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>
    </PageLayout>
  );
}
