import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import PageLayout from "./PageLayout";
import { useAuth } from "../contexts/AuthContext";
import "./Dashboard.css";

const SuperAdminDashboard = () => {
  const { user } = useAuth();
  const roleLabel =
    user?.role === "super_admin"
      ? "Super Admin"
      : user?.role === "operator"
        ? "Operator"
        : user?.role === "analyst"
          ? "Analyst"
          : "User";

  const [stats, setStats] = useState({
    userCount: 0,
    activeSimulations: 0,
    systemHealth: 0,
    emergencyCount: 0,
  });
  const [recentActivities, setRecentActivities] = useState([]);

  useEffect(() => {
    (async () => {
      try {
        const { api } = await import("../utils/api");
        const data = await api.getStatsOverview();
        let userCount = data.userCount || 0;
        try {
          const u = await api.getUserCount();
          if (typeof u.count === "number") userCount = u.count;
        } catch {}
        setStats({ ...data, userCount });
        // recent activities: 5 most recent audit logs
        try {
          const audits = await api.listAuditLogs({ limit: 5 });
          const items = Array.isArray(audits.items) ? audits.items : [];
          setRecentActivities(items);
        } catch (e) {
          setRecentActivities([]);
        }
      } catch (err) {
        console.warn("Failed to load overview stats:", err?.message || err);
      }
    })();
  }, []);

  const systemStats = [
    {
      title: "Total Users",
      value: String(stats.userCount || 0),
      change: "",
      icon: "👥",
      status: "online",
    },
    {
      title: "Active Simulations",
      value: String(stats.activeSimulations || 0),
      change: "",
      icon: "🚦",
      status: "warning",
    },
    {
      title: "System Health",
      value: `${stats.systemHealth || 0}%`,
      change: "",
      icon: "💚",
      status:
        stats.systemHealth >= 80
          ? "success"
          : stats.systemHealth >= 60
            ? "warning"
            : "error",
    },
    {
      title: "Emergency Overrides",
      value: String(stats.emergencyCount || 0),
      change: "Active",
      icon: "🚨",
      status: "error",
    },
  ];

  // derive a short, human-readable message for an audit item
  const formatAudit = (a) => {
    const when = a.time ? new Date(a.time).toLocaleString() : "";
    const user = a.user || "unknown";
    const role = a.role || "";
    const action = a.action || "";
    let emoji = "📝";
    if (action.includes("login")) emoji = "🔐";
    else if (action.includes("logout")) emoji = "🚪";
    else if (action.includes("start_simulation")) emoji = "▶️";
    else if (action.includes("stop_simulation")) emoji = "⏹️";
    else if (action.includes("pause_simulation")) emoji = "⏸️";
    else if (action.includes("resume_simulation")) emoji = "▶️";
    return {
      id: a._id || when + user + action,
      emoji,
      title: action,
      who: `${user}${role ? " (" + role + ")" : ""}`,
      when,
    };
  };

  const quickActions = [
    {
      title: "User Management",
      description: "Manage system users and permissions",
      icon: "👥",
      link: "/admin/users",
      color: "blue",
      roles: ["super_admin"],
    },
    {
      title: "System Settings",
      description: "Configure SUMO and system parameters",
      icon: "⚙️",
      link: "/sumo-integration",
      color: "gray",
      roles: ["super_admin", "operator"],
    },
    {
      title: "Audit Logs",
      description: "View and export system activity logs",
      icon: "📋",
      link: "/admin/audit",
      color: "green",
      roles: ["super_admin", "analyst", "operator"],
    },
    {
      title: "System Reports",
      description: "Generate comprehensive system reports",
      icon: "📊",
      link: "/admin/reports",
      color: "purple",
      roles: ["super_admin", "analyst", "operator"],
    },
  ];

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

  return (
    <PageLayout
      title={`${roleLabel} Dashboard`}
      subtitle="Complete system oversight and management"
    >
      <div className="space-y-6">
        {/* System Stats */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {systemStats.map((stat) => (
            <div key={stat.title} className="card shadow-card">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    {stat.title}
                  </p>
                  <p
                    className={`text-2xl font-bold ${stat.title === "System Health" ? (stats.systemHealth >= 80 ? "text-green-700" : stats.systemHealth >= 60 ? "text-yellow-700" : "text-red-700") : ""}`}
                  >
                    {stat.value}
                  </p>
                  <p className="text-xs text-muted-foreground">{stat.change}</p>
                </div>
                <div className="text-3xl">{stat.icon}</div>
              </div>
            </div>
          ))}
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Recent Activities */}
          <div className="card shadow-card">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-2xl">📋</span>
              <h3 className="text-lg font-semibold">Recent Activities</h3>
            </div>
            <div className="space-y-4">
              {Array.isArray(recentActivities) &&
              recentActivities.length > 0 ? (
                recentActivities.map((aRaw) => {
                  const a = formatAudit(aRaw);
                  return (
                    <div key={a.id} className="flex items-start space-x-3">
                      <div className="flex-shrink-0">
                        <span className="text-lg">{a.emoji}</span>
                      </div>
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center gap-2">
                          <span className={`badge badge-default`}>
                            {a.title}
                          </span>
                        </div>
                        <p className="text-sm text-foreground">{a.who}</p>
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          🕒 {a.when}
                        </p>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="text-sm text-muted-foreground">
                  No recent activities
                </div>
              )}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="card shadow-card">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-2xl">⚡</span>
              <h3 className="text-lg font-semibold">Quick Actions</h3>
            </div>
            <div className="grid gap-3">
              {quickActions
                .filter((a) => !a.roles || a.roles.includes(user?.role))
                .map((action) => (
                  <Link
                    key={action.title}
                    to={action.link}
                    className={`p-4 rounded-lg border-2 border-transparent hover:border-${action.color}-200 transition-all duration-200 hover:shadow-md`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{action.icon}</span>
                      <div>
                        <h4 className="font-medium">{action.title}</h4>
                        <p className="text-sm text-muted-foreground">
                          {action.description}
                        </p>
                      </div>
                    </div>
                  </Link>
                ))}
            </div>
          </div>
        </div>

        {/* System Overview */}
        <div className="card shadow-card">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-2xl">🖥️</span>
            <h3 className="text-lg font-semibold">System Overview</h3>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {/* Traffic Control */}
            <div className="text-center p-6 rounded-lg border border-green-200 dark:border-transparent bg-green-50 dark:bg-green-900/20 hover:shadow-md transition-all duration-200">
              <div className="text-4xl mb-3">🚦</div>
              <h4 className="font-semibold text-green-800 dark:text-green-400 mb-2">
                Traffic Control
              </h4>
              <p className="text-sm text-green-600 dark:text-green-300">
                {stats.activeSimulations} active simulations
              </p>
            </div>

            {/* User Management */}
            <div className="text-center p-6 rounded-lg border border-blue-200 dark:border-transparent bg-blue-50 dark:bg-blue-900/20 hover:shadow-md transition-all duration-200">
              <div className="text-4xl mb-3">👥</div>
              <h4 className="font-semibold text-blue-800 dark:text-blue-400 mb-2">
                User Management
              </h4>
              <p className="text-sm text-blue-600 dark:text-blue-300">
                {stats.userCount} total users
              </p>
            </div>

            {/* Emergencies */}
            <div className="text-center p-6 rounded-lg border border-purple-200 dark:border-transparent bg-purple-50 dark:bg-purple-900/20 hover:shadow-md transition-all duration-200">
              <div className="text-4xl mb-3">🚨</div>
              <h4 className="font-semibold text-purple-800 dark:text-purple-400 mb-2">
                Emergencies
              </h4>
              <p className="text-sm text-purple-600 dark:text-purple-300">
                {stats.emergencyCount} active emergencies
              </p>
            </div>
          </div>
        </div>
      </div>
    </PageLayout>
  );
};

export default SuperAdminDashboard;
