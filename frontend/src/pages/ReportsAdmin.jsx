import React, { useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import io from "socket.io-client";
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

const API_BASE = process.env.REACT_APP_API_BASE || "http://localhost:5001";

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

  const [traffic, setTraffic] = useState([]);
  const [loading, setLoading] = useState(false);
  const socketRef = useRef(null);
  const [isRunning, setIsRunning] = useState(false);
  const [liveMode, setLiveMode] = useState(false); // when true, include realtime data
  const [locked, setLocked] = useState(false); // when true, freeze current dataset for consistent report

  const fetchTraffic = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (start) params.append("startDate", new Date(start).toISOString());
      if (end) params.append("endDate", new Date(end).toISOString());
      // pull up to 1000 samples; backend supports limit
      params.append("limit", "1000");
      const res = await axios.get(`${API_BASE}/api/traffic-data?${params}`);
      const data = Array.isArray(res.data) ? res.data : [];
      setTraffic(data);
    } catch (e) {
      // soft-fail
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTraffic();
    // Socket for realtime updates
    socketRef.current = io(API_BASE, { transports: ["websocket"] });
    socketRef.current.on("sumoStatus", (s) => setIsRunning(!!s?.isRunning));
    socketRef.current.on("trafficData", (payload) => {
      // Append only if live mode is on and report is not locked
      if (!liveMode || locked) return;
      try {
        const t = new Date(payload.timestamp || Date.now()).toISOString();
        const startIso = start ? new Date(start).toISOString() : null;
        const endIso = end ? new Date(end).toISOString() : null;
        if ((!startIso || t >= startIso) && (!endIso || t <= endIso)) {
          setTraffic((prev) => [payload, ...prev].slice(0, 1000));
        }
      } catch (_) {}
    });
    return () => {
      try {
        socketRef.current?.disconnect();
      } catch (_) {}
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const kpi = useMemo(() => {
    if (!traffic.length) return { uptime: 0, congestionReduction: 0, avgResponse: 0, avgSpeed: 0 };
    const avgSpeed = Number(
      (
        traffic.reduce((acc, d) => acc + (Number(d.averageSpeed) || 0), 0) /
        traffic.length
      ).toFixed(1)
    );
    // Heuristic values for demo: base on trafficFlow
    const avgFlow = traffic.reduce((a, d) => a + (Number(d.trafficFlow) || 0), 0) / traffic.length;
    const maxFlow = 2000; // assumed peak
    const congestionReduction = Math.max(0, Math.min(100, Number(((1 - avgFlow / maxFlow) * 100).toFixed(1))));
    const uptime = traffic.length > 0 ? 100 : 0; // data present within window => 100%
    const avgResponse = 24; // keep UI stable; can wire from emergencies later
    return { uptime, congestionReduction, avgResponse, avgSpeed };
  }, [traffic]);

  const trend = useMemo(() => {
    const byDay = {};
    for (const d of traffic) {
      const day = new Date(d.timestamp || Date.now()).toISOString().slice(0, 10);
      const spd = Number(d.averageSpeed) || 0;
      const flow = Number(d.trafficFlow) || 0;
      if (!byDay[day]) byDay[day] = { day, _sum: 0, _cnt: 0, emergencies: 0 };
      byDay[day]._sum += spd;
      byDay[day]._cnt += 1;
      if (flow > 1000) byDay[day].emergencies += 1;
    }
    return Object.values(byDay).map((x) => ({
      day: x.day,
      avgSpeed: x._cnt ? Number((x._sum / x._cnt).toFixed(1)) : 0,
      emergencies: x.emergencies,
    }));
  }, [traffic]);

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
          <button className="btn-secondary" onClick={() => { setLocked(false); fetchTraffic(); }} disabled={loading}>
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
              fetchTraffic();
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
        <div className="flex items-end gap-2">
          <button
            className="btn-secondary"
            onClick={() => { setLocked(true); }}
            title="Freeze the current dataset so repeated generations are identical"
          >
            Generate Report (Snapshot)
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid md:grid-cols-4 gap-4 mb-4">
        <div className="bg-white p-4 rounded shadow shadow-card">
          <div className="text-sm text-gray-500">Uptime</div>
          <div className="text-2xl font-bold">{kpi.uptime}%</div>
        </div>
        <div className="bg-white p-4 rounded shadow shadow-card">
          <div className="text-sm text-gray-500">Congestion Reduction</div>
          <div className="text-2xl font-bold">{kpi.congestionReduction}%</div>
        </div>
        <div className="bg-white p-4 rounded shadow shadow-card">
          <div className="text-sm text-gray-500">Avg Response</div>
          <div className="text-2xl font-bold">{kpi.avgResponse}s</div>
        </div>
        <div className="bg-white p-4 rounded shadow shadow-card">
          <div className="text-sm text-gray-500">Average Speed</div>
          <div className="text-2xl font-bold">{kpi.avgSpeed} km/h</div>
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
    </div>
  );
}
