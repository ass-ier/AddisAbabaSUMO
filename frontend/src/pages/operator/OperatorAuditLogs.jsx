import React, { useEffect, useState } from "react";
import PageLayout from "../../components/PageLayout";
import { api } from "../../utils/api";
import { useAuth } from "../../contexts/AuthContext";
import "../../components/Dashboard.css";

export default function OperatorAuditLogs() {
  const { user } = useAuth();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState({
    action: "",
    date: "",
  });

  const load = async () => {
    try {
      setLoading(true);
      const params = {};
      // Operator sees only their own logs
      params.user = user?.username;
      if (filter.action) params.action = filter.action;
      if (filter.date) params.startDate = filter.date;

      const res = await api.listAuditLogs(params);
      setLogs(res.items || []);
    } catch (err) {
      console.error("Failed to load audit logs:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const getActionIcon = (action) => {
    if (action?.includes("login")) return "🔐";
    if (action?.includes("logout")) return "🚪";
    if (action?.includes("start")) return "▶️";
    if (action?.includes("stop")) return "⏹️";
    if (action?.includes("pause")) return "⏸️";
    if (action?.includes("emergency")) return "🚨";
    if (action?.includes("traffic")) return "🚦";
    return "📝";
  };

  const getActionColor = (action) => {
    if (action?.includes("login")) return "text-green-600 dark:text-green-400";
    if (action?.includes("logout")) return "text-gray-600 dark:text-gray-400";
    if (action?.includes("start")) return "text-blue-600 dark:text-blue-400";
    if (action?.includes("stop")) return "text-red-600 dark:text-red-400";
    if (action?.includes("emergency"))
      return "text-orange-600 dark:text-orange-400";
    return "text-gray-600 dark:text-gray-400";
  };

  // Stats from logs
  const stats = {
    total: logs.length,
    today: logs.filter(
      (l) =>
        l.time && new Date(l.time).toDateString() === new Date().toDateString()
    ).length,
    simulations: logs.filter((l) => l.action?.includes("simulation")).length,
    emergencies: logs.filter((l) => l.action?.includes("emergency")).length,
  };

  return (
    <PageLayout
      title="My Activity Log"
      subtitle="Your operational activities and actions"
    >
      <div className="space-y-6">
        {/* Stats Overview */}
        <div className="grid gap-4 md:grid-cols-4">
          <div className="card shadow-card p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Actions</p>
                <p className="text-2xl font-bold">{stats.total}</p>
              </div>
              <span className="text-3xl">📊</span>
            </div>
          </div>

          <div className="card shadow-card p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Today</p>
                <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                  {stats.today}
                </p>
              </div>
              <span className="text-3xl">📅</span>
            </div>
          </div>

          <div className="card shadow-card p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Simulations</p>
                <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                  {stats.simulations}
                </p>
              </div>
              <span className="text-3xl">🚦</span>
            </div>
          </div>

          <div className="card shadow-card p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">
                  Emergency Actions
                </p>
                <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                  {stats.emergencies}
                </p>
              </div>
              <span className="text-3xl">🚨</span>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="card shadow-card p-4">
          <div className="grid md:grid-cols-4 gap-3">
            <select
              className="border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 p-2 rounded"
              value={filter.action}
              onChange={(e) => setFilter({ ...filter, action: e.target.value })}
            >
              <option value="">All Actions</option>
              <option value="login">Login</option>
              <option value="logout">Logout</option>
              <option value="simulation">Simulations</option>
              <option value="emergency">Emergencies</option>
              <option value="traffic">Traffic Control</option>
            </select>

            <input
              className="border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 p-2 rounded"
              type="date"
              value={filter.date}
              onChange={(e) => setFilter({ ...filter, date: e.target.value })}
            />

            <button
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
              onClick={load}
              disabled={loading}
            >
              {loading ? "Loading..." : "Apply Filters"}
            </button>

            <button
              className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 transition-colors"
              onClick={() => {
                setFilter({ action: "", date: "" });
                load();
              }}
            >
              Clear
            </button>
          </div>
        </div>

        {/* Activity Log */}
        <div className="card shadow-card p-6">
          <h2 className="text-lg font-semibold mb-4">Recent Activities</h2>

          {loading ? (
            <div className="text-center py-8 text-muted-foreground">
              Loading activities...
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-8">
              <span className="text-4xl mb-2 block">📭</span>
              <p className="text-muted-foreground">No activities found</p>
            </div>
          ) : (
            <div className="space-y-3">
              {logs.map((log, index) => (
                <div
                  key={index}
                  className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                >
                  <div className="flex items-start gap-3">
                    <span className="text-2xl">
                      {getActionIcon(log.action)}
                    </span>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <span
                          className={`font-medium ${getActionColor(
                            log.action
                          )}`}
                        >
                          {log.action || "Unknown Action"}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {log.time ? new Date(log.time).toLocaleString() : "—"}
                        </span>
                      </div>
                      {log.target && (
                        <p className="text-sm text-muted-foreground mt-1">
                          Target: {log.target}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Info Section */}
        <div className="card shadow-card p-6 bg-blue-50 dark:bg-blue-900/20">
          <div className="flex items-start gap-3">
            <span className="text-2xl">ℹ️</span>
            <div>
              <h3 className="font-semibold mb-2">About Activity Logs</h3>
              <p className="text-sm text-muted-foreground">
                This log shows your personal activities in the system. All
                actions are automatically recorded for accountability and audit
                purposes. Keep track of your daily operations and review your
                work history.
              </p>
            </div>
          </div>
        </div>
      </div>
    </PageLayout>
  );
}
