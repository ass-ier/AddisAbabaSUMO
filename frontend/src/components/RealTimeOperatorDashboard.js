import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { useDashboardData } from "../hooks/useRealTimeData";
import axios from "axios";
import PageLayout from "./PageLayout";
import "./Dashboard.css";

const RealTimeOperatorDashboard = () => {
  const { user } = useAuth();
  const {
    connected,
    connecting,
    error,
    dashboardData,
    trafficData,
    sumoStatus,
    lastUpdate,
    connect,
  } = useDashboardData();

  const [stats, setStats] = useState({
    totalVehicles: 0,
    averageSpeed: 0,
    activeIntersections: 0,
    simulationStatus: "stopped",
  });

  const [systemMetrics, setSystemMetrics] = useState([
    { name: "CPU Usage", value: 45, status: "online" },
    { name: "Memory Usage", value: 62, status: "warning" },
    { name: "Network I/O", value: 28, status: "online" },
    { name: "Database", value: 15, status: "online" },
  ]);

  const [recentAlerts, setRecentAlerts] = useState([
    {
      id: 1,
      type: "Info",
      message: "Traffic flow normal at Main Street intersection",
      timestamp: "5 minutes ago",
      status: "online",
    },
    {
      id: 2,
      type: "Warning",
      message: "High congestion detected at 2nd Avenue",
      timestamp: "15 minutes ago",
      status: "warning",
    },
    {
      id: 3,
      type: "Info",
      message: "Simulation parameters updated successfully",
      timestamp: "1 hour ago",
      status: "online",
    },
    {
      id: 4,
      type: "Alert",
      message: "Emergency vehicle approaching - route cleared",
      timestamp: "2 hours ago",
      status: "error",
    },
  ]);

  const [loading, setLoading] = useState(true);

  // Update stats from real-time data
  useEffect(() => {
    if (dashboardData) {
      const newStats = {
        totalVehicles: dashboardData.totalVehicles || stats.totalVehicles,
        averageSpeed: dashboardData.averageSpeed || stats.averageSpeed,
        activeIntersections:
          dashboardData.activeIntersections || stats.activeIntersections,
        simulationStatus:
          dashboardData.simulationStatus || stats.simulationStatus,
      };
      setStats(newStats);
      setLoading(false);
    }
  }, [dashboardData]);

  // Update stats from traffic data
  useEffect(() => {
    if (trafficData?.overview) {
      const overview = trafficData.overview;
      setStats((prevStats) => ({
        ...prevStats,
        totalVehicles: overview.totalVehicles || prevStats.totalVehicles,
        averageSpeed: overview.averageSpeed || prevStats.averageSpeed,
        activeIntersections:
          overview.activeIntersections || prevStats.activeIntersections,
      }));
    }
  }, [trafficData]);

  // Update simulation status from SUMO data
  useEffect(() => {
    if (sumoStatus) {
      setStats((prevStats) => ({
        ...prevStats,
        simulationStatus: sumoStatus.isRunning ? "running" : "stopped",
      }));
    }
  }, [sumoStatus]);

  // Fallback: fetch initial data if real-time connection fails
  useEffect(() => {
    if (!connected && !connecting && error) {
      console.log("Real-time connection failed, falling back to HTTP requests");
      fetchDashboardData();
    }
  }, [connected, connecting, error]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);

      // Fetch simulation status
      const statusResponse = await axios.get("/api/sumo/status");
      const simulationStatus = statusResponse.data;

      // Fetch traffic data
      const trafficResponse = await axios.get("/api/traffic-data");
      const trafficDataResponse = trafficResponse.data;

      setStats({
        totalVehicles: trafficDataResponse.totalVehicles || 0,
        averageSpeed: trafficDataResponse.averageSpeed || 0,
        activeIntersections: trafficDataResponse.activeIntersections || 0,
        simulationStatus: simulationStatus.status || "stopped",
      });
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
    } finally {
      setLoading(false);
    }
  };

  const dashboardStats = [
    {
      title: "Active Vehicles",
      value: stats.totalVehicles.toString(),
      change: connected ? "Real-time updates" : "+12% from last hour",
      icon: "🚗",
      status: "online",
      realTime: connected,
    },
    {
      title: "Average Speed",
      value: `${Math.round(stats.averageSpeed)} km/h`,
      change: connected ? "Live monitoring" : "+2.1 km/h improvement",
      icon: "⚡",
      status: "success",
      realTime: connected,
    },
    {
      title: "Active Intersections",
      value: stats.activeIntersections.toString(),
      change: connected ? "All systems operational" : "All systems operational",
      icon: "🚦",
      status: "online",
      realTime: connected,
    },
    {
      title: "Simulation Status",
      value:
        stats.simulationStatus.charAt(0).toUpperCase() +
        stats.simulationStatus.slice(1),
      change: connected ? "Real-time monitoring" : "Manual refresh needed",
      icon: "📊",
      status: stats.simulationStatus === "running" ? "success" : "warning",
      realTime: connected,
    },
  ];

  const getStatusColor = (status) => {
    switch (status) {
      case "error":
        return "text-status-error";
      case "warning":
        return "text-status-warning";
      case "success":
      case "online":
        return "text-status-online";
      default:
        return "text-muted-foreground";
    }
  };

  const getBadgeVariant = (status) => {
    switch (status) {
      case "error":
        return "destructive";
      case "warning":
        return "secondary";
      case "success":
      case "online":
        return "default";
      default:
        return "secondary";
    }
  };

  if (loading && !connected) {
    return (
      <PageLayout title="Dashboard" subtitle="Loading...">
        <div className="flex items-center justify-center h-64">
          <div className="loading">
            {connecting
              ? "Connecting to real-time data..."
              : "Loading dashboard data..."}
          </div>
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout
      title="Traffic Monitoring Dashboard"
      subtitle={`Welcome back, ${user?.username || "Operator"}`}
    >
      <div className="space-y-6">
        {/* Connection Status Banner */}
        <div
          className={`p-3 rounded-lg border ${
            connected
              ? "bg-green-50 border-green-200"
              : error
                ? "bg-red-50 border-red-200"
                : "bg-yellow-50 border-yellow-200"
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {connected ? (
                <>
                  <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                  <span className="text-green-800 font-medium">
                    Real-time data connected
                  </span>
                  {lastUpdate && (
                    <span className="text-green-600 text-sm">
                      • Last update: {new Date(lastUpdate).toLocaleTimeString()}
                    </span>
                  )}
                </>
              ) : connecting ? (
                <>
                  <div className="w-3 h-3 bg-yellow-500 rounded-full animate-pulse"></div>
                  <span className="text-yellow-800 font-medium">
                    Connecting to real-time data...
                  </span>
                </>
              ) : (
                <>
                  <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                  <span className="text-red-800 font-medium">
                    Real-time connection unavailable
                  </span>
                  <button
                    onClick={connect}
                    className="ml-2 px-2 py-1 bg-red-600 text-white text-xs rounded hover:bg-red-700"
                  >
                    Retry Connection
                  </button>
                </>
              )}
            </div>
            {connected && (
              <span className="text-green-600 text-sm">
                🔄 Live Updates Active
              </span>
            )}
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {dashboardStats.map((stat) => (
            <div key={stat.title} className="card shadow-card">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-muted-foreground">
                      {stat.title}
                    </p>
                    {stat.realTime && (
                      <div
                        className="w-2 h-2 bg-green-500 rounded-full animate-pulse"
                        title="Real-time data"
                      ></div>
                    )}
                  </div>
                  <p className="text-2xl font-bold">{stat.value}</p>
                  <p className="text-xs text-muted-foreground">{stat.change}</p>
                </div>
                <div className="text-3xl">{stat.icon}</div>
              </div>
            </div>
          ))}
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Recent Alerts */}
          <div className="card shadow-card">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-2xl">📋</span>
              <h3 className="text-lg font-semibold">Recent Alerts</h3>
              {connected && (
                <div
                  className="w-2 h-2 bg-green-500 rounded-full animate-pulse"
                  title="Real-time updates"
                ></div>
              )}
            </div>
            <div className="space-y-4">
              {recentAlerts.map((alert) => (
                <div key={alert.id} className="flex items-start space-x-3">
                  <div className="flex-shrink-0">
                    {alert.status === "error" && (
                      <span className="text-status-error text-lg">🚨</span>
                    )}
                    {alert.status === "warning" && (
                      <span className="text-status-warning text-lg">⚠️</span>
                    )}
                    {alert.status === "online" && (
                      <span className="text-status-online text-lg">✅</span>
                    )}
                  </div>
                  <div className="flex-grow">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-sm font-medium">{alert.message}</p>
                        <p className="text-xs text-muted-foreground">
                          {alert.timestamp}
                        </p>
                      </div>
                      <span
                        className={`px-2 py-1 text-xs rounded-full ${getStatusColor(
                          alert.status
                        )} bg-opacity-10`}
                      >
                        {alert.type}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* System Metrics */}
          <div className="card shadow-card">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-2xl">⚙️</span>
              <h3 className="text-lg font-semibold">System Metrics</h3>
              {connected && (
                <div
                  className="w-2 h-2 bg-green-500 rounded-full animate-pulse"
                  title="Real-time updates"
                ></div>
              )}
            </div>
            <div className="space-y-4">
              {systemMetrics.map((metric) => (
                <div
                  key={metric.name}
                  className="flex items-center justify-between"
                >
                  <span className="text-sm font-medium">{metric.name}</span>
                  <div className="flex items-center space-x-2">
                    <div className="w-32 bg-gray-200 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full ${
                          metric.status === "online"
                            ? "bg-green-500"
                            : metric.status === "warning"
                              ? "bg-yellow-500"
                              : "bg-red-500"
                        }`}
                        style={{ width: `${metric.value}%` }}
                      ></div>
                    </div>
                    <span className="text-sm text-muted-foreground">
                      {metric.value}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="card shadow-card">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-2xl">🚀</span>
            <h3 className="text-lg font-semibold">Quick Actions</h3>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <Link
              to="/traffic-map"
              className="flex items-center p-4 border rounded-lg hover:bg-gray-50 transition-colors"
            >
              <span className="text-2xl mr-3">🗺️</span>
              <div>
                <p className="font-medium">Traffic Map</p>
                <p className="text-sm text-muted-foreground">
                  View real-time traffic flow
                </p>
              </div>
            </Link>

            <Link
              to="/sumo-integration"
              className="flex items-center p-4 border rounded-lg hover:bg-gray-50 transition-colors"
            >
              <span className="text-2xl mr-3">🎮</span>
              <div>
                <p className="font-medium">SUMO Control</p>
                <p className="text-sm text-muted-foreground">
                  Manage simulation
                </p>
              </div>
            </Link>

            <Link
              to="/reports"
              className="flex items-center p-4 border rounded-lg hover:bg-gray-50 transition-colors"
            >
              <span className="text-2xl mr-3">📊</span>
              <div>
                <p className="font-medium">Analytics</p>
                <p className="text-sm text-muted-foreground">
                  View detailed reports
                </p>
              </div>
            </Link>
          </div>
        </div>
      </div>
    </PageLayout>
  );
};

export default RealTimeOperatorDashboard;
