import React, { useEffect, useState } from "react";
import PageLayout from "../../components/PageLayout";
import { api } from "../../utils/api";
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

          <div className="card shadow-card p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">High Priority</p>
                <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                  {items.filter((e) => e.priority === "high").length}
                </p>
              </div>
              <span className="text-3xl">⚠️</span>
            </div>
          </div>

          <div className="card shadow-card p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">En Route</p>
                <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                  {items.filter((e) => e.status === "active").length}
                </p>
              </div>
              <span className="text-3xl">🚑</span>
            </div>
          </div>
        </div>

        {/* Emergency List */}
        <div className="card shadow-card p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Active Emergencies</h2>
            <button
              onClick={load}
              className="px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
              disabled={loading}
            >
              {loading ? "Refreshing..." : "Refresh"}
            </button>
          </div>

          {loading && items.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Loading emergencies...
            </div>
          ) : items.length === 0 ? (
            <div className="text-center py-8">
              <span className="text-4xl mb-2 block">✅</span>
              <p className="text-muted-foreground">
                No active emergencies - All clear!
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700">
                    <th className="text-left p-3 text-sm font-semibold">
                      Priority
                    </th>
                    <th className="text-left p-3 text-sm font-semibold">
                      Vehicle
                    </th>
                    <th className="text-left p-3 text-sm font-semibold">
                      Type
                    </th>
                    <th className="text-left p-3 text-sm font-semibold">
                      Location
                    </th>
                    <th className="text-left p-3 text-sm font-semibold">ETA</th>
                    <th className="text-left p-3 text-sm font-semibold">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((emergency) => (
                    <tr
                      key={emergency._id}
                      className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                    >
                      <td className="p-3">
                        <span
                          className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusBadge(
                            emergency.priority
                          )}`}
                        >
                          {emergency.priority?.toUpperCase() || "MEDIUM"}
                        </span>
                      </td>
                      <td className="p-3 font-medium">
                        {emergency.vehicleId || "N/A"}
                      </td>
                      <td className="p-3">
                        <span className="flex items-center gap-2">
                          {emergency.type === "ambulance" && "🚑"}
                          {emergency.type === "fire" && "🚒"}
                          {emergency.type === "police" && "🚓"}
                          {emergency.type || "Emergency"}
                        </span>
                      </td>
                      <td className="p-3 text-sm text-muted-foreground">
                        {emergency.intersectionId || "—"}
                      </td>
                      <td className="p-3 text-sm">
                        {emergency.eta
                          ? `${emergency.eta} min`
                          : "Calculating..."}
                      </td>
                      <td className="p-3">
                        <button
                          onClick={() => acknowledgeEmergency(emergency._id)}
                          className="px-3 py-1 text-xs bg-green-500 text-white rounded hover:bg-green-600 transition-colors"
                        >
                          Acknowledge
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Operator Notes Section */}
        <div className="card shadow-card p-6">
          <h3 className="text-lg font-semibold mb-3">
            📝 Emergency Response Guidelines
          </h3>
          <div className="space-y-2 text-sm text-muted-foreground">
            <p>
              • <strong>High Priority:</strong> Immediate response required -
              monitor traffic lights and clear routes
            </p>
            <p>
              • <strong>Medium Priority:</strong> Standard response - ensure
              smooth traffic flow
            </p>
            <p>
              • <strong>Low Priority:</strong> Monitor and acknowledge when
              convenient
            </p>
            <p>
              • <strong>Action:</strong> Click "Acknowledge" when you've noted
              the emergency
            </p>
          </div>
        </div>
      </div>
    </PageLayout>
  );
}
