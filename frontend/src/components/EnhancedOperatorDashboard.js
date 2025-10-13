import React, { useState, useEffect, useCallback, useRef } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
} from "recharts";
import axios from "axios";
import io from "socket.io-client";
import "./EnhancedOperatorDashboard.css";

const EnhancedOperatorDashboard = () => {
  const { user } = useAuth();
  const [dashboardData, setDashboardData] = useState({
    metrics: {
      activeVehicles: 0,
      averageSpeed: 0,
      activeIntersections: 0,
      systemHealth: 95,
      congestionLevel: "Low",
      emergencyVehicles: 0,
    },
    systemMetrics: {
      cpuUsage: 0,
      memoryUsage: 0,
      networkIO: 0,
      diskUsage: 0,
      databaseConnections: 0,
    },
    alerts: [],
    trafficData: [],
    performanceData: [],
  });

  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(new Date());
  const socketRef = useRef(null);
  const dataHistoryRef = useRef([]);
  const maxHistoryPoints = 50;

  // Socket.io connection and real-time data
  useEffect(() => {
    initializeSocket();
    fetchInitialData();

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, []);

  const initializeSocket = useCallback(() => {
    socketRef.current = io("http://localhost:5001", {
      withCredentials: true,
      transports: ["websocket"],
    });

    socketRef.current.on("connect", () => {
      console.log("Connected to WebSocket server");
      setConnected(true);

      // Subscribe to operator data streams (matching backend event names)
      socketRef.current.emit("subscribe", {
        streams: ["dashboard", "system", "traffic", "alerts"],
      });
    });

    socketRef.current.on("disconnect", () => {
      console.log("Disconnected from WebSocket server");
      setConnected(false);
    });

    // Real-time data handlers (matching backend event names)
    socketRef.current.on("dashboard", handleDashboardMetrics);
    socketRef.current.on("systemMetrics", handleSystemMetrics);
    socketRef.current.on("trafficData", handleTrafficData);
    socketRef.current.on("alerts", handleAlerts);

    socketRef.current.on("connect_error", (error) => {
      console.error("Socket connection error:", error);
      setConnected(false);
    });
  }, []);

  const handleDashboardMetrics = useCallback((data) => {
    setDashboardData((prev) => ({
      ...prev,
      metrics: {
        ...prev.metrics,
        ...data,
      },
    }));
    setLastUpdate(new Date());
  }, []);

  const handleSystemMetrics = useCallback((data) => {
    setDashboardData((prev) => ({
      ...prev,
      systemMetrics: {
        ...prev.systemMetrics,
        ...data,
      },
    }));

    // Update performance history
    const newDataPoint = {
      timestamp: new Date().toLocaleTimeString(),
      cpu: data.cpuUsage || 0,
      memory: data.memoryUsage || 0,
      network: data.networkIO || 0,
    };

    dataHistoryRef.current = [
      ...dataHistoryRef.current.slice(-maxHistoryPoints + 1),
      newDataPoint,
    ];

    setDashboardData((prev) => ({
      ...prev,
      performanceData: [...dataHistoryRef.current],
    }));
  }, []);

  const handleTrafficData = useCallback((data) => {
    setDashboardData((prev) => ({
      ...prev,
      trafficData: Array.isArray(data) ? data.slice(-10) : prev.trafficData,
    }));
  }, []);

  const handleAlerts = useCallback((data) => {
    setDashboardData((prev) => ({
      ...prev,
      alerts: Array.isArray(data) ? data.slice(0, 8) : prev.alerts,
    }));
  }, []);

  const fetchInitialData = async () => {
    try {
      setLoading(true);

      // Fetch operator dashboard data from new API
      const [dashboardRes, trafficRes, alertsRes] = await Promise.allSettled([
        axios.get("/api/operator/dashboard"),
        axios.get("/api/traffic-data?limit=10"),
        axios.get("/api/operator/alerts?limit=8"),
      ]);

      // Process dashboard data
      if (
        dashboardRes.status === "fulfilled" &&
        dashboardRes.value.data.success
      ) {
        const data = dashboardRes.value.data.data;
        setDashboardData((prev) => ({
          ...prev,
          metrics: {
            activeVehicles: data.traffic?.activeVehicles || 0,
            averageSpeed: data.traffic?.averageSpeed || 0,
            activeIntersections: data.traffic?.activeIntersections || 0,
            systemHealth: data.system?.healthScore || 95,
            congestionLevel: data.traffic?.congestionLevel || "Low",
            emergencyVehicles: data.emergency?.activeCount || 0,
          },
        }));
      }

      // Process traffic data
      if (trafficRes.status === "fulfilled") {
        setDashboardData((prev) => ({
          ...prev,
          trafficData: trafficRes.value.data || [],
        }));
      }

      // Process alerts
      if (alertsRes.status === "fulfilled" && alertsRes.value.data.success) {
        setDashboardData((prev) => ({
          ...prev,
          alerts: alertsRes.value.data.data.alerts || [],
        }));
      }
    } catch (error) {
      console.error("Error fetching initial data:", error);

      // Fallback to mock data for demonstration
      setDashboardData((prev) => ({
        ...prev,
        metrics: {
          activeVehicles: 342,
          averageSpeed: 28.5,
          activeIntersections: 24,
          systemHealth: 96,
          congestionLevel: "Moderate",
          emergencyVehicles: 2,
        },
        alerts: generateMockAlerts(),
      }));
    } finally {
      setLoading(false);
    }
  };

  const generateMockAlerts = () => [
    {
      id: 1,
      type: "info",
      severity: "info",
      message: "Traffic flow normalized at Meskel Square intersection",
      timestamp: new Date(Date.now() - 5 * 60000),
      source: "traffic",
    },
    {
      id: 2,
      type: "warning",
      severity: "warning",
      message:
        "High congestion detected on Bole Road - Estimated delay: 8 minutes",
      timestamp: new Date(Date.now() - 12 * 60000),
      source: "traffic",
    },
    {
      id: 3,
      type: "success",
      severity: "info",
      message: "SUMO simulation parameters updated successfully",
      timestamp: new Date(Date.now() - 25 * 60000),
      source: "system",
    },
    {
      id: 4,
      type: "error",
      severity: "critical",
      message:
        "Emergency vehicle route - Ambulance approaching Piazza intersection",
      timestamp: new Date(Date.now() - 45 * 60000),
      source: "emergency",
    },
  ];

  const refreshData = async () => {
    await fetchInitialData();
  };

  const formatTimestamp = (timestamp) => {
    const now = new Date();
    const time = new Date(timestamp);
    const diffInMinutes = Math.floor((now - time) / (1000 * 60));

    if (diffInMinutes < 1) return "Just now";
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h ago`;
    return time.toLocaleDateString();
  };

  const getMetricStatus = (value, thresholds) => {
    if (value >= thresholds.critical) return "error";
    if (value >= thresholds.warning) return "warning";
    return "success";
  };

  const getAlertIcon = (severity) => {
    switch (severity) {
      case "critical":
      case "error":
        return "🚨";
      case "warning":
        return "⚠️";
      case "info":
        return "ℹ️";
      default:
        return "✅";
    }
  };

  const getMetricChangeIcon = (change) => {
    if (change > 0) return "📈";
    if (change < 0) return "📉";
    return "➖";
  };

  const systemHealthData = [
    {
      name: "Healthy",
      value: dashboardData.metrics.systemHealth,
      fill: "#22c55e",
    },
    {
      name: "Issues",
      value: 100 - dashboardData.metrics.systemHealth,
      fill: "#e5e7eb",
    },
  ];

  if (loading) {
    return (
      <div className="enhanced-operator-dashboard">
        <div className="dashboard-container">
          <div className="loading-card">
            <div className="loading-skeleton loading-title"></div>
            <div className="loading-skeleton loading-value"></div>
            <div className="loading-skeleton loading-subtitle"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="enhanced-operator-dashboard">
      <div className="dashboard-container">
        {/* Enhanced Header */}
        <div className="dashboard-header">
          <div className="header-content">
            <div>
              <h1 className="dashboard-title">System Operator Dashboard</h1>
              <p className="dashboard-subtitle">
                Welcome back, {user?.username || "Operator"}. Here's your
                traffic management overview.
              </p>
            </div>
            <div className="header-actions">
              <div className="status-indicator">
                <div className="status-dot"></div>
                <span>{connected ? "Live Data" : "Offline"}</span>
              </div>
              <button className="refresh-btn" onClick={refreshData}>
                🔄 Refresh
              </button>
            </div>
          </div>
        </div>

        {/* Enhanced Metrics Grid */}
        <div className="metrics-grid">
          <div
            className={`metric-card ${getMetricStatus(dashboardData.metrics.activeVehicles, { warning: 500, critical: 800 })}`}
          >
            <div className="metric-header">
              <div className="metric-icon">🚗</div>
            </div>
            <div className="metric-value">
              {dashboardData.metrics.activeVehicles.toLocaleString()}
            </div>
            <div className="metric-label">Active Vehicles</div>
            <div className="metric-change positive">
              {getMetricChangeIcon(12)} +12% from last hour
            </div>
          </div>

          <div
            className={`metric-card ${getMetricStatus(dashboardData.metrics.averageSpeed, { warning: 20, critical: 15 })}`}
          >
            <div className="metric-header">
              <div className="metric-icon">⚡</div>
            </div>
            <div className="metric-value">
              {dashboardData.metrics.averageSpeed.toFixed(1)}
            </div>
            <div className="metric-label">Avg Speed (km/h)</div>
            <div className="metric-change positive">
              {getMetricChangeIcon(2.5)} +2.5 km/h improvement
            </div>
          </div>

          <div className="metric-card success">
            <div className="metric-header">
              <div className="metric-icon">🚦</div>
            </div>
            <div className="metric-value">
              {dashboardData.metrics.activeIntersections}
            </div>
            <div className="metric-label">Active Intersections</div>
            <div className="metric-change neutral">
              {getMetricChangeIcon(0)} All systems operational
            </div>
          </div>

          <div
            className={`metric-card ${dashboardData.metrics.systemHealth >= 95 ? "success" : dashboardData.metrics.systemHealth >= 80 ? "warning" : "error"}`}
          >
            <div className="metric-header">
              <div className="metric-icon">📊</div>
            </div>
            <div className="metric-value">
              {dashboardData.metrics.systemHealth}%
            </div>
            <div className="metric-label">System Health</div>
            <div className="metric-change positive">
              {getMetricChangeIcon(0)} Optimal performance
            </div>
          </div>

          <div className="metric-card warning">
            <div className="metric-header">
              <div className="metric-icon">🚧</div>
            </div>
            <div className="metric-value">
              {dashboardData.metrics.congestionLevel}
            </div>
            <div className="metric-label">Congestion Level</div>
            <div className="metric-change neutral">
              {getMetricChangeIcon(0)} Traffic flowing normally
            </div>
          </div>

          <div
            className={`metric-card ${dashboardData.metrics.emergencyVehicles > 0 ? "warning" : "success"}`}
          >
            <div className="metric-header">
              <div className="metric-icon">🚑</div>
            </div>
            <div className="metric-value">
              {dashboardData.metrics.emergencyVehicles}
            </div>
            <div className="metric-label">Emergency Vehicles</div>
            <div className="metric-change neutral">
              {getMetricChangeIcon(0)} Priority routing active
            </div>
          </div>
        </div>

        {/* Dashboard Content Grid */}
        <div className="dashboard-grid">
          {/* Real-time Performance Chart */}
          <div className="dashboard-section">
            <div className="section-header">
              <div className="section-icon">📈</div>
              <h3 className="section-title">Real-time System Performance</h3>
            </div>
            <div className="chart-container">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={dashboardData.performanceData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis
                    dataKey="timestamp"
                    tick={{ fontSize: 12, fill: "#64748b" }}
                    stroke="#e2e8f0"
                  />
                  <YAxis
                    tick={{ fontSize: 12, fill: "#64748b" }}
                    stroke="#e2e8f0"
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#fff",
                      border: "1px solid #e2e8f0",
                      borderRadius: "8px",
                      boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="cpu"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    name="CPU Usage (%)"
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="memory"
                    stroke="#10b981"
                    strokeWidth={2}
                    name="Memory Usage (%)"
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="network"
                    stroke="#f59e0b"
                    strokeWidth={2}
                    name="Network I/O (%)"
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* System Health & Alerts */}
          <div className="dashboard-section">
            <div className="section-header">
              <div className="section-icon">🏥</div>
              <h3 className="section-title">System Health</h3>
            </div>

            {/* System Health Pie Chart */}
            <div style={{ height: "200px", marginBottom: "2rem" }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={systemHealthData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {systemHealthData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              <div style={{ textAlign: "center", marginTop: "-6rem" }}>
                <div
                  style={{
                    fontSize: "1.5rem",
                    fontWeight: "bold",
                    color: "#1e293b",
                  }}
                >
                  {dashboardData.metrics.systemHealth}%
                </div>
                <div style={{ fontSize: "0.8rem", color: "#64748b" }}>
                  Health Score
                </div>
              </div>
            </div>

            {/* System Metrics */}
            <div className="system-metrics">
              {[
                {
                  name: "CPU Usage",
                  value: dashboardData.systemMetrics.cpuUsage || 45,
                  icon: "🖥️",
                  unit: "%",
                },
                {
                  name: "Memory",
                  value: dashboardData.systemMetrics.memoryUsage || 62,
                  icon: "💾",
                  unit: "%",
                },
                {
                  name: "Network I/O",
                  value: dashboardData.systemMetrics.networkIO || 28,
                  icon: "🌐",
                  unit: "%",
                },
                {
                  name: "Database",
                  value: dashboardData.systemMetrics.databaseConnections || 15,
                  icon: "🗄️",
                  unit: "",
                },
              ].map((metric) => (
                <div key={metric.name} className="system-metric">
                  <div className="system-metric-info">
                    <div className="system-metric-icon">{metric.icon}</div>
                    <div className="system-metric-details">
                      <h4>{metric.name}</h4>
                      <p>System resource utilization</p>
                    </div>
                  </div>
                  <div className="system-metric-value">
                    <div
                      className={`metric-percentage ${
                        metric.value < 60
                          ? "healthy"
                          : metric.value < 80
                            ? "warning"
                            : "critical"
                      }`}
                    >
                      {metric.value}
                      {metric.unit}
                    </div>
                    <div className="metric-status">
                      {metric.value < 60
                        ? "healthy"
                        : metric.value < 80
                          ? "warning"
                          : "critical"}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Alerts and Quick Actions Grid */}
        <div className="dashboard-grid">
          {/* Recent Alerts */}
          <div className="dashboard-section">
            <div className="section-header">
              <div className="section-icon">🔔</div>
              <h3 className="section-title">Recent Alerts</h3>
            </div>
            <div className="alert-list">
              {dashboardData.alerts.map((alert) => (
                <div key={alert.id} className="alert-item">
                  <div className={`alert-icon ${alert.severity || alert.type}`}>
                    {getAlertIcon(alert.severity || alert.type)}
                  </div>
                  <div className="alert-content">
                    <div className="alert-header">
                      <span
                        className={`alert-type ${alert.severity || alert.type}`}
                      >
                        {alert.type || alert.severity}
                      </span>
                    </div>
                    <div className="alert-message">{alert.message}</div>
                    <div className="alert-timestamp">
                      🕒 {formatTimestamp(alert.timestamp)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="dashboard-section">
            <div className="section-header">
              <div className="section-icon">⚡</div>
              <h3 className="section-title">Quick Actions</h3>
            </div>
            <div className="quick-actions-grid">
              <Link to="/traffic-map" className="quick-action-card">
                <div className="quick-action-content">
                  <div className="quick-action-icon">🗺️</div>
                  <div className="quick-action-info">
                    <h3>Traffic Map</h3>
                    <p>View real-time traffic visualization</p>
                  </div>
                </div>
              </Link>

              <Link to="/sumo-integration" className="quick-action-card">
                <div className="quick-action-content">
                  <div className="quick-action-icon">🚦</div>
                  <div className="quick-action-info">
                    <h3>SUMO Control</h3>
                    <p>Manage traffic simulation</p>
                  </div>
                </div>
              </Link>

              <Link to="/reports" className="quick-action-card">
                <div className="quick-action-content">
                  <div className="quick-action-icon">📊</div>
                  <div className="quick-action-info">
                    <h3>Analytics</h3>
                    <p>Generate performance reports</p>
                  </div>
                </div>
              </Link>

              <button className="quick-action-card" onClick={refreshData}>
                <div className="quick-action-content">
                  <div className="quick-action-icon">🔄</div>
                  <div className="quick-action-info">
                    <h3>Refresh Data</h3>
                    <p>Update all metrics and alerts</p>
                  </div>
                </div>
              </button>
            </div>
          </div>
        </div>

        {/* Footer Info */}
        <div className="dashboard-section" style={{ marginTop: "2rem" }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              fontSize: "0.9rem",
              color: "#64748b",
            }}
          >
            <div>
              <strong>System Status:</strong>{" "}
              {connected ? "Connected" : "Disconnected"} |
              <strong> Last Update:</strong> {lastUpdate.toLocaleTimeString()}
            </div>
            <div>
              <strong>Active User:</strong> {user?.username} ({user?.role})
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EnhancedOperatorDashboard;
