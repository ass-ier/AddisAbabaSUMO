import React, { useEffect, useState } from "react";
import { api } from "../utils/api";
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
  const [kpi, setKpi] = useState(null);
  const [trend, setTrend] = useState([]);

  useEffect(() => {
    (async () => {
      setKpi(await api.getKpis());
      const t = await api.getTrends();
      setTrend(t.daily || []);
    })();
  }, []);

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Reports Dashboard</h1>
        <p className="text-gray-600">Admin metrics overview</p>
      </div>
      {kpi && (
        <div className="grid md:grid-cols-3 gap-4">
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
        </div>
      )}

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
