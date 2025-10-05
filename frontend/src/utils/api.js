async function fetchJson(url, options = {}) {
  const res = await fetch(url, options);
  const contentType = res.headers.get("content-type") || "";
  const isJson = contentType.includes("application/json");

  if (!res.ok) {
    try {
      if (isJson) {
        const err = await res.json();
        throw new Error(err?.message || `${res.status} ${res.statusText}`);
      } else {
        const text = await res.text();
        throw new Error(text || `${res.status} ${res.statusText}`);
      }
    } catch (e) {
      throw new Error(e.message || `${res.status} ${res.statusText}`);
    }
  }

  if (!isJson) {
    const text = await res.text();
    // Return text if needed by caller; default throw for unexpected content
    try {
      return JSON.parse(text);
    } catch (_) {
      throw new Error("Expected JSON response but received non-JSON");
    }
  }

  return res.json();
}

// Base API URL (can be overridden with REACT_APP_API_BASE)
const BASE_API = process.env.REACT_APP_API_BASE || "http://localhost:5001";

export const api = {
  // Users
  listUsers: async () => fetchJson(`${BASE_API}/api/users`, { headers: authHeaders() }),
  createUser: async (body) =>
    fetchJson(`${BASE_API}/api/register`, {
      method: "POST",
      headers: jsonHeaders(),
      body: JSON.stringify(body),
    }),
  updateUser: async (id, body) =>
    fetchJson(`${BASE_API}/api/users/${id}`, {
      method: "PUT",
      headers: jsonHeaders(),
      body: JSON.stringify(body),
    }),
  deleteUser: async (id) =>
    fetchJson(`${BASE_API}/api/users/${id}`, { method: "DELETE", headers: authHeaders() }),

  // Settings
  getSettings: async () =>
    fetchJson(`${BASE_API}/api/settings`, { headers: authHeaders() }),
  saveSettings: async (body) =>
    fetchJson(`${BASE_API}/api/settings`, {
      method: "PUT",
      headers: jsonHeaders(),
      body: JSON.stringify(body),
    }),

  // Audit logs
  listAuditLogs: async (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return fetchJson(`${BASE_API}/api/audit${qs ? `?${qs}` : ""}`, {
      headers: authHeaders(),
    });
  },

  // Reports
  getKpis: async () =>
    fetchJson(`${BASE_API}/api/reports/kpis`, { headers: authHeaders() }),
  getTrends: async () =>
    fetchJson(`${BASE_API}/api/reports/trends`, { headers: authHeaders() }),

  // SUMO
  getSumoStatus: async () =>
    fetchJson(`${BASE_API}/api/sumo/status`, { headers: authHeaders() }),
  sumoControl: async (command, parameters = {}) =>
    fetchJson(`${BASE_API}/api/sumo/control`, {
      method: "POST",
      headers: jsonHeaders(),
      body: JSON.stringify({ command, parameters }),
    }),
  openSumoGui: async (withConfig = true) =>
    fetchJson(`${BASE_API}/api/sumo/open-gui`, {
      method: "POST",
      headers: jsonHeaders(),
      body: JSON.stringify({ withConfig }),
    }),

  // Stats
  getStatsOverview: async () =>
    fetchJson(`${BASE_API}/api/stats/overview`, { headers: authHeaders() }),
  getAdminStats: async () =>
    fetchJson(`${BASE_API}/api/stats/admin`, { headers: authHeaders() }),
  getUserCount: async () =>
    fetchJson(`${BASE_API}/api/users/count`, { headers: authHeaders() }),

  // SUMO config selection
  listSumoConfigs: async () =>
    fetchJson(`${BASE_API}/api/sumo/configs`, { headers: authHeaders() }),
  setSumoConfig: async (name) =>
    fetchJson(`${BASE_API}/api/sumo/config`, {
      method: "PUT",
      headers: jsonHeaders(),
      body: JSON.stringify({ name }),
    }),

  // Map settings (mode, area filter)
  getMapSettings: async () =>
    fetchJson(`${BASE_API}/api/map/settings`, { headers: authHeaders() }),
  updateMapSettings: async (body) =>
    fetchJson(`${BASE_API}/api/map/settings`, {
      method: "PUT",
      headers: jsonHeaders(),
      body: JSON.stringify(body),
    }),

  // Intersections
  overrideIntersection: async (id, body) =>
    fetchJson(`${BASE_API}/api/intersections/${id}/override`, {
      method: "POST",
      headers: jsonHeaders(),
      body: JSON.stringify(body),
    }),

  // Emergencies
  listEmergencies: async () =>
    fetchJson(`${BASE_API}/api/emergencies`, { headers: authHeaders() }),
  forceClearEmergency: async (id) =>
    fetchJson(`${BASE_API}/api/emergencies/${id}/force-clear`, {
      method: "POST",
      headers: authHeaders(),
    }),
};

function authHeaders() {
  const token = sessionStorage.getItem("token");
  return { Authorization: `Bearer ${token}` };
}

function jsonHeaders() {
  const token = sessionStorage.getItem("token");
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
}
