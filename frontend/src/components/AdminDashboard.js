import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import PageLayout from "./PageLayout";
import "./Dashboard.css";
import { api } from "../utils/api";

const AdminDashboard = () => {
  const [simulationStatus, setSimulationStatus] = useState("stopped");
  const [simulationMode, setSimulationMode] = useState("fixed");
  const [busy, setBusy] = useState(false);
  const [liveStats, setLiveStats] = useState({
    activeVehicles: 0,
    avgSpeed: 0,
    queueLength: 0,
    emergencyOverrides: 0,
  });

  useEffect(() => {
    (async () => {
      try {
        const status = await api.getSumoStatus();
        setSimulationStatus(status?.isRunning ? "running" : "stopped");
      } catch (_) {}
      try {
        const res = await fetch("/api/stats/admin", { credentials: "include" });
        const data = await res.json();
        setLiveStats(data);
      } catch (_) {}
    })();
  }, []);

  const trafficStats = [
    {
      title: "Active Vehicles",
      value: String(liveStats.activeVehicles || 0),
      change: "",
      icon: "🚗",
      status: "online",
    },
    {
      title: "Average Speed",
      value: `${liveStats.avgSpeed || 0} km/h`,
      change: "",
      icon: "⚡",
      status: "success",
    },
    {
      title: "Queue Length",
      value: String(liveStats.queueLength || 0),
      change: "",
      icon: "🚦",
      status: "success",
    },
    {
      title: "Emergency Overrides",
      value: String(liveStats.emergencyOverrides || 0),
      change: "Active now",
      icon: "🚨",
      status: "warning",
    },
  ];

  const intersections = [
    {
      id: "A1",
      name: "Main St & 1st Ave",
      status: "normal",
      queueLength: 12,
      signalState: "green",
      congestion: "low",
    },
    {
      id: "A2",
      name: "Main St & 2nd Ave",
      status: "congested",
      queueLength: 45,
      signalState: "red",
      congestion: "high",
    },
    {
      id: "A3",
      name: "Main St & 3rd Ave",
      status: "emergency",
      queueLength: 8,
      signalState: "green",
      congestion: "low",
    },
  ];

  const emergencyVehicles = [
    {
      id: "E001",
      type: "Ambulance",
      location: "Main St & 3rd Ave",
      priority: "high",
      eta: "2 min",
    },
    {
      id: "E002",
      type: "Fire Truck",
      location: "2nd Ave & Oak St",
      priority: "critical",
      eta: "5 min",
    },
  ];

  const getCongestionColor = (level) => {
    switch (level) {
      case "high":
        return "bg-red-100 text-red-800";
      case "medium":
        return "bg-yellow-100 text-yellow-800";
      case "low":
        return "bg-green-100 text-green-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const handleSimulationControl = async (action) => {
    try {
      setBusy(true);
      if (action === "running") {
        await api.sumoControl("start_simulation");
      } else if (action === "paused") {
        await api.sumoControl("pause_simulation");
      } else if (action === "stopped") {
        await api.sumoControl("stop_simulation");
      }
      const status = await api.getSumoStatus();
      setSimulationStatus(status?.isRunning ? "running" : "stopped");
    } catch (_) {
    } finally {
      setBusy(false);
    }
  };

  const handleModeToggle = async () => {
    const next = simulationMode === "fixed" ? "adaptive" : "fixed";
    const confirmed = window.confirm(
      `Switch mode to ${next === "adaptive" ? "Adaptive" : "Fixed Timing"}?`
    );
    if (!confirmed) return;
    setSimulationMode(next);
    try {
      const s = await api.getSettings();
      await api.saveSettings({
        ...s,
        adaptive: { ...s.adaptive, enabled: next === "adaptive" },
      });
    } catch (_) {}
  };

  const openSumoGui = async () => {
    try {
      await api.openSumoGui(true);
      window.dispatchEvent(
        new CustomEvent("notify", {
          detail: { type: "success", message: "Opened SUMO GUI" },
        })
      );
    } catch (e) {
      window.dispatchEvent(
        new CustomEvent("notify", {
          detail: {
            type: "error",
            message: e.message || "Failed to open SUMO GUI",
          },
        })
      );
    }
  };

  return (
    <PageLayout
      title="Traffic Operations Dashboard"
      subtitle="Monitor and control traffic simulation systems"
    >
      <div className="space-y-6">
        {/* Simulation Control Panel */}
        <div className="card shadow-card">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <span className="text-2xl">🎮</span>
              <h3 className="text-lg font-semibold">Simulation Control</h3>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Mode:</span>
              <button
                onClick={handleModeToggle}
                className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                  simulationMode === "adaptive"
                    ? "bg-blue-100 text-blue-800"
                    : "bg-gray-100 text-gray-800"
                }`}
                disabled={busy}
              >
                {simulationMode === "adaptive" ? "Adaptive" : "Fixed Timing"}
              </button>
            </div>
          </div>

          <div className="flex gap-3 mb-4">
            <button
              onClick={() => handleSimulationControl("running")}
              className={`btn-primary ${
                simulationStatus === "running" || busy
                  ? "opacity-50 cursor-not-allowed"
                  : ""
              }`}
              disabled={simulationStatus === "running" || busy}
            >
              ▶️ Start
            </button>
            <button
              onClick={() => handleSimulationControl("paused")}
              className={`btn-secondary ${busy ? "opacity-50" : ""}`}
              disabled={busy}
            >
              ⏸️ Pause
            </button>
            <button
              onClick={() => handleSimulationControl("stopped")}
              className={`btn-secondary ${busy ? "opacity-50" : ""}`}
              disabled={busy}
            >
              ⏹️ Stop
            </button>
            <button
              onClick={() => handleSimulationControl("stopped")}
              className={`btn-secondary ${busy ? "opacity-50" : ""}`}
              disabled={busy}
            >
              🔄 Reset
            </button>
            <button
              onClick={openSumoGui}
              className={`btn-secondary ${busy ? "opacity-50" : ""}`}
              disabled={busy}
              title="Open SUMO GUI"
            >
              🖥️ Open SUMO
            </button>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Status:</span>
            <span
              className={`badge badge-${
                simulationStatus === "running"
                  ? "default"
                  : simulationStatus === "paused"
                  ? "secondary"
                  : "destructive"
              }`}
            >
              {simulationStatus === "running"
                ? "Running"
                : simulationStatus === "paused"
                ? "Paused"
                : "Stopped"}
            </span>
          </div>
        </div>

        {/* Traffic Statistics */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {trafficStats.map((stat) => (
            <div key={stat.title} className="card shadow-card">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    {stat.title}
                  </p>
                  <p className="text-2xl font-bold">{stat.value}</p>
                  <p className="text-xs text-muted-foreground">{stat.change}</p>
                </div>
                <div className="text-3xl">{stat.icon}</div>
              </div>
            </div>
          ))}
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Intersection Monitoring */}
          <div className="card shadow-card">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-2xl">🚦</span>
              <h3 className="text-lg font-semibold">Intersection Status</h3>
            </div>
            <div className="space-y-3">
              {intersections.map((intersection) => (
                <div
                  key={intersection.id}
                  className="p-3 border rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <h4 className="font-medium">{intersection.name}</h4>
                      <p className="text-sm text-muted-foreground">
                        ID: {intersection.id}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-medium ${getCongestionColor(
                          intersection.congestion
                        )}`}
                      >
                        {intersection.congestion}
                      </span>
                      <span className="text-2xl">
                        {intersection.signalState === "green"
                          ? "🟢"
                          : intersection.signalState === "yellow"
                          ? "🟡"
                          : "🔴"}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span>Queue: {intersection.queueLength} vehicles</span>
                    <button className="text-blue-600 hover:text-blue-800 text-xs">
                      Manual Override
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Emergency Vehicles */}
          <div className="card shadow-card">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-2xl">🚨</span>
              <h3 className="text-lg font-semibold">Emergency Vehicles</h3>
            </div>
            <div className="space-y-3">
              {emergencyVehicles.map((vehicle) => (
                <div
                  key={vehicle.id}
                  className="p-3 border rounded-lg bg-red-50 border-red-200"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <h4 className="font-medium text-red-800">
                        {vehicle.type} {vehicle.id}
                      </h4>
                      <p className="text-sm text-red-600">{vehicle.location}</p>
                    </div>
                    <span
                      className={`badge ${
                        vehicle.priority === "critical"
                          ? "badge-destructive"
                          : "badge-secondary"
                      }`}
                    >
                      {vehicle.priority}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-red-600">ETA: {vehicle.eta}</span>
                    <button className="text-red-600 hover:text-red-800 text-xs font-medium">
                      Force Clear Route
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="card shadow-card">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-2xl">⚡</span>
            <h3 className="text-lg font-semibold">Quick Actions</h3>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            <Link
              to="/traffic-map"
              className="p-4 text-left border rounded-lg hover:bg-gray-50 transition-colors block"
            >
              <div className="flex items-center gap-3">
                <span className="text-2xl">🗺️</span>
                <div>
                  <h4 className="font-medium">Traffic Map</h4>
                  <p className="text-sm text-muted-foreground">
                    View real-time traffic
                  </p>
                </div>
              </div>
            </Link>
            <button className="p-4 text-left border rounded-lg hover:bg-gray-50 transition-colors">
              <div className="flex items-center gap-3">
                <span className="text-2xl">📊</span>
                <div>
                  <h4 className="font-medium">Analytics</h4>
                  <p className="text-sm text-muted-foreground">
                    View traffic reports
                  </p>
                </div>
              </div>
            </button>
            <button className="p-4 text-left border rounded-lg hover:bg-gray-50 transition-colors">
              <div className="flex items-center gap-3">
                <span className="text-2xl">⚙️</span>
                <div>
                  <h4 className="font-medium">Settings</h4>
                  <p className="text-sm text-muted-foreground">
                    Configure simulation
                  </p>
                </div>
              </div>
            </button>
          </div>
        </div>
      </div>
    </PageLayout>
  );
};

export default AdminDashboard;
