import React, { useEffect, useState } from "react";
import { api } from "../utils/api";

export default function EmergencyPanel() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    try {
      setLoading(true);
      const res = await api.listEmergencies();
      setItems(res.items || []);
    } catch (_) {
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const forceClear = async (id) => {
    if (!window.confirm("Force clear this emergency route?")) return;
    await api.forceClearEmergency(id);
    window.dispatchEvent(
      new CustomEvent("notify", {
        detail: { type: "success", message: "Emergency cleared" },
      })
    );
    load();
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">
          Emergency Management
        </h1>
        <p className="text-gray-600">Active emergencies and controls</p>
      </div>
      <div className="bg-white p-4 rounded shadow shadow-card">
        {loading ? (
          <div>Loading...</div>
        ) : items.length === 0 ? (
          <div>No active emergencies</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-100">
                <th className="p-2 text-left">Vehicle</th>
                <th className="p-2 text-left">Type</th>
                <th className="p-2 text-left">Priority</th>
                <th className="p-2 text-left">Intersection</th>
                <th className="p-2 text-left">ETA</th>
                <th className="p-2 text-left">Action</th>
              </tr>
            </thead>
            <tbody>
              {items.map((e) => (
                <tr key={e._id} className="border-b">
                  <td className="p-2">{e.vehicleId}</td>
                  <td className="p-2">{e.type}</td>
                  <td className="p-2">{e.priority}</td>
                  <td className="p-2">{e.intersectionId || "—"}</td>
                  <td className="p-2">{e.eta || "—"}</td>
                  <td className="p-2">
                    <button
                      className="text-red-600 hover:text-red-800 text-xs"
                      onClick={() => forceClear(e._id)}
                    >
                      Force Clear Route
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
