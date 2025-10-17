import React, { useEffect, useRef, useState } from "react";
import io from "socket.io-client";
import { api, BASE_API as API_BASE } from "../utils/api";
import {
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
} from "recharts";

export default function ReportsAdmin() {
  // Date range (default last 24 hours)
  const [start, setStart] = useState(() => {
    const d = new Date(Date.now() - 24 * 60 * 60 * 1000);
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 16);
  });
  const [end, setEnd] = useState(() => {
    const d = new Date();
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 16);
  });

  const [kpis, setKpis] = useState({ uptime: 0, congestionReduction: 0, avgResponse: 0, avgSpeed: 0 });
  const [trend, setTrend] = useState([]);
  const [loading, setLoading] = useState(false);
  const socketRef = useRef(null);
  const [isRunning, setIsRunning] = useState(false);
  const [liveMode, setLiveMode] = useState(false); // when true, periodically refresh from APIs
  const [locked, setLocked] = useState(false); // when true, freeze current dataset for consistent report

  const fetchReportsData = async () => {
    try {
      setLoading(true);
      const startIso = start ? new Date(start).toISOString() : undefined;
      const endIso = end ? new Date(end).toISOString() : undefined;
      const [k, t] = await Promise.all([
        api.getKpis({ startDate: startIso, endDate: endIso }),
        api.getTrends({ startDate: startIso, endDate: endIso }),
      ]);
      setKpis(k || { uptime: 0, congestionReduction: 0, avgResponse: 0, avgSpeed: 0 });
      setTrend(Array.isArray(t?.daily) ? t.daily : []);
    } catch (_) {
      // soft-fail
    } finally {
      setLoading(false);
    }
  };

  // Snapshot/export helpers
  const buildSnapshot = () => ({
    generatedAt: new Date().toISOString(),
    range: {
      start: start ? new Date(start).toISOString() : null,
      end: end ? new Date(end).toISOString() : null,
    },
    locked,
    isRunning,
    kpis,
    trend,
  });

  const download = (blob, filename) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportJson = () => {
    const data = buildSnapshot();
    download(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }),
      `report_${Date.now()}.json`);
  };

  const exportCsv = () => {
    const headers = ["day", "avgSpeed", "emergencies"];
    const lines = [headers.join(",")];
    (trend || []).forEach((r) => {
      const row = [r.day ?? "", r.avgSpeed ?? "", r.emergencies ?? ""];
      lines.push(row.join(","));
    });
    const csv = lines.join("\n");
    download(new Blob([csv], { type: "text/csv" }), `trend_${Date.now()}.csv`);
  };

  useEffect(() => {
    // initial fetch
    fetchReportsData();
    // Socket for realtime SUMO status (optional)
    socketRef.current = io(API_BASE, { transports: ["websocket"] });
    socketRef.current.on("sumoStatus", (s) => setIsRunning(!!s?.isRunning));
    return () => {
      try {
        socketRef.current?.disconnect();
      } catch (_) {}
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Live mode polling
  useEffect(() => {
    if (!liveMode || locked) return;
    const id = setInterval(() => {
      fetchReportsData();
    }, 10000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveMode, locked, start, end]);

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Reports Dashboard</h1>
        <p className="text-gray-600">Dynamic metrics overview {isRunning ? "(Live)" : "(Offline)"}</p>
      </div>

      {/* Date range filters */}
      <div className="bg-white p-4 rounded shadow shadow-card grid md:grid-cols-6 gap-3 mb-4">
        <div>
          <label className="block text-xs text-gray-500 mb-1">Start</label>
          <input
            className="border p-2 w-full"
            type="datetime-local"
            value={start}
            onChange={(e) => setStart(e.target.value)}
          />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">End</label>
          <input
            className="border p-2 w-full"
            type="datetime-local"
            value={end}
            onChange={(e) => setEnd(e.target.value)}
          />
        </div>
        <div className="flex items-end gap-2">
          <button className="btn-secondary" onClick={() => { setLocked(false); fetchReportsData(); }} disabled={loading}>
            {loading ? "Loading..." : "Apply"}
          </button>
          <button
            className="btn-secondary"
            onClick={() => {
              const s = new Date(Date.now() - 24 * 60 * 60 * 1000);
              const e = new Date();
              setStart(new Date(s.getTime() - s.getTimezoneOffset() * 60000).toISOString().slice(0, 16));
              setEnd(new Date(e.getTime() - e.getTimezoneOffset() * 60000).toISOString().slice(0, 16));
              setLocked(false);
              fetchReportsData();
            }}
          >
            Last 24h
          </button>
        </div>
        <div className="flex items-end gap-2">
          <label className="inline-flex items-center gap-2 text-xs text-gray-600">
            <input
              type="checkbox"
              checked={liveMode}
              onChange={(e) => setLiveMode(e.target.checked)}
            />
            Live updates (include realtime data)
          </label>
        </div>
        <div className="flex items-end gap-2 flex-wrap">
          <button
            className="btn-secondary"
            onClick={() => { setLocked(true); }}
            title="Freeze the current dataset so repeated generations are identical"
          >
            Generate Report (Snapshot)
          </button>
          <button className="btn-secondary" onClick={exportJson} title="Download current dataset as JSON">
            Export JSON
          </button>
          <button className="btn-secondary" onClick={exportCsv} title="Download trend series as CSV">
            Export CSV
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid md:grid-cols-4 gap-4 mb-4">
        <div className="bg-white p-4 rounded shadow shadow-card">
          <div className="text-sm text-gray-500">Uptime</div>
          <div className="text-2xl font-bold">{kpis.uptime}%</div>
        </div>
        <div className="bg-white p-4 rounded shadow shadow-card">
          <div className="text-sm text-gray-500">Congestion Reduction</div>
          <div className="text-2xl font-bold">{kpis.congestionReduction}%</div>
        </div>
        <div className="bg-white p-4 rounded shadow shadow-card">
          <div className="text-sm text-gray-500">Avg Response</div>
          <div className="text-2xl font-bold">{kpis.avgResponse}s</div>
        </div>
        <div className="bg-white p-4 rounded shadow shadow-card">
          <div className="text-sm text-gray-500">Average Speed</div>
          <div className="text-2xl font-bold">{kpis.avgSpeed} km/h</div>
        </div>
      </div>

      {/* Trend charts */}
      <div className="bg-white p-4 rounded shadow shadow-card">
        <h2 className="font-medium mb-3">Traffic Trend (Daily)</h2>
        <div style={{ width: "100%", height: 300 }}>
          <ResponsiveContainer>
            <LineChart data={trend}>
              <CartesianGrid stroke="#eee" strokeDasharray="5 5" />
              <XAxis dataKey="day" />
              <YAxis />
              <Tooltip />
              <Line type="monotone" dataKey="avgSpeed" stroke="#4a6cf7" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-white p-4 rounded shadow shadow-card">
        <h2 className="font-medium mb-3">Emergency Responses</h2>
        <div style={{ width: "100%", height: 300 }}>
          <ResponsiveContainer>
            <BarChart data={trend}>
              <CartesianGrid stroke="#eee" strokeDasharray="5 5" />
              <XAxis dataKey="day" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="emergencies" fill="#22c55e" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Raw series table */}
      <div className="bg-white p-4 rounded shadow shadow-card">
        <h2 className="font-medium mb-3">Series</h2>
        <div className="overflow-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left border-b">
                <th className="py-2 pr-4">Day</th>
                <th className="py-2 pr-4">Avg Speed</th>
                <th className="py-2 pr-4">Emergencies</th>
              </tr>
            </thead>
            <tbody>
              {(trend || []).map((r, i) => (
                <tr key={i} className="border-b last:border-none">
                  <td className="py-2 pr-4">{r.day ?? ""}</td>
                  <td className="py-2 pr-4">{r.avgSpeed ?? ""}</td>
                  <td className="py-2 pr-4">{r.emergencies ?? ""}</td>
                </tr>
              ))}
              {(!trend || trend.length === 0) && (
                <tr>
                  <td className="py-2 pr-4" colSpan={3}>No data</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
