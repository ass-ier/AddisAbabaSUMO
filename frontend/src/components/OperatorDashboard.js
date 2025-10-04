import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import axios from "axios";
import PageLayout from "./PageLayout";
import "./Dashboard.css";

const OperatorDashboard = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState({
    totalVehicles: 0,
    averageSpeed: 0,
    activeIntersections: 0,
    simulationStatus: "stopped",
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);

      // Fetch simulation status
      const statusResponse = await axios.get("/api/sumo/status");
      const simulationStatus = statusResponse.data;

      // Fetch traffic data
      const trafficResponse = await axios.get("/api/traffic-data");
      const trafficData = trafficResponse.data;

      setStats({
        totalVehicles: trafficData.totalVehicles || 0,
        averageSpeed: trafficData.averageSpeed || 0,
        activeIntersections: trafficData.activeIntersections || 0,
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
      change: "+12% from last hour",
      icon: "🚗",
      status: "online",
    },
    {
      title: "Average Speed",
      value: `${stats.averageSpeed} km/h`,
      change: "+2.1 km/h improvement",
      icon: "⚡",
      status: "success",
    },
    {
      title: "Active Intersections",
      value: stats.activeIntersections.toString(),
      change: "All systems operational",
      icon: "🚦",
      status: "online",
    },
    {
      title: "Simulation Status",
      value:
        stats.simulationStatus.charAt(0).toUpperCase() +
        stats.simulationStatus.slice(1),
      change: "Real-time monitoring",
      icon: "📊",
      status: stats.simulationStatus === "running" ? "success" : "warning",
    },
  ];

  const recentAlerts = [
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
  ];

  const systemMetrics = [
    { name: "CPU Usage", value: 45, status: "online" },
    { name: "Memory Usage", value: 62, status: "warning" },
    { name: "Network I/O", value: 28, status: "online" },
    { name: "Database", value: 15, status: "online" },
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

  if (loading) {
    return (
      <PageLayout title="Dashboard" subtitle="Loading...">
        <div className="flex items-center justify-center h-64">
          <div className="loading">Loading dashboard data...</div>
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
        {/* Stats Grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {dashboardStats.map((stat) => (
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
          {/* Recent Alerts */}
          <div className="card shadow-card">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-2xl">📋</span>
              <h3 className="text-lg font-semibold">Recent Alerts</h3>
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
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <span
                        className={`badge badge-${getBadgeVariant(
                          alert.status
                        )}`}
                      >
                        {alert.type}
                      </span>
                    </div>
                    <p className="text-sm text-foreground">{alert.message}</p>
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      🕒 {alert.timestamp}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* System Metrics */}
          <div className="card shadow-card">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-2xl">🖥️</span>
              <h3 className="text-lg font-semibold">System Metrics</h3>
            </div>
            <div className="space-y-4">
              {systemMetrics.map((metric) => (
                <div key={metric.name} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{metric.name}</span>
                    <span
                      className={`text-sm ${getStatusColor(metric.status)}`}
                    >
                      {metric.value}%
                    </span>
                  </div>
                  <div className="progress">
                    <div
                      className="progress-bar"
                      style={{ width: `${metric.value}%` }}
                    ></div>
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
                  <h4 className="font-medium">Reports</h4>
                  <p className="text-sm text-muted-foreground">
                    Generate traffic reports
                  </p>
                </div>
              </div>
            </button>
            <button className="p-4 text-left border rounded-lg hover:bg-gray-50 transition-colors">
              <div className="flex items-center gap-3">
                <span className="text-2xl">🚦</span>
                <div>
                  <h4 className="font-medium">SUMO Control</h4>
                  <p className="text-sm text-muted-foreground">
                    Manage simulation
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

export default OperatorDashboard;
