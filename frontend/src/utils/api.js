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

export const api = {
  // Users
  listUsers: async () => fetchJson("/api/users", { headers: authHeaders() }),
  createUser: async (body) =>
    fetchJson("/api/register", {
      method: "POST",
      headers: jsonHeaders(),
      body: JSON.stringify(body),
    }),
  updateUser: async (id, body) =>
    fetchJson(`/api/users/${id}`, {
      method: "PUT",
      headers: jsonHeaders(),
      body: JSON.stringify(body),
    }),
  deleteUser: async (id) =>
    fetchJson(`/api/users/${id}`, { method: "DELETE", headers: authHeaders() }),

  // Settings
  getSettings: async () =>
    fetchJson("/api/settings", { headers: authHeaders() }),
  saveSettings: async (body) =>
    fetchJson("/api/settings", {
      method: "PUT",
      headers: jsonHeaders(),
      body: JSON.stringify(body),
    }),

  // Audit logs
  listAuditLogs: async (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return fetchJson(`/api/audit${qs ? `?${qs}` : ""}`, {
      headers: authHeaders(),
    });
  },

  // Reports
  getKpis: async () =>
    fetchJson("/api/reports/kpis", { headers: authHeaders() }),
  getTrends: async () =>
    fetchJson("/api/reports/trends", { headers: authHeaders() }),

  // SUMO
  getSumoStatus: async () =>
    fetchJson("/api/sumo/status", { headers: authHeaders() }),
  sumoControl: async (command, parameters = {}) =>
    fetchJson("/api/sumo/control", {
      method: "POST",
      headers: jsonHeaders(),
      body: JSON.stringify({ command, parameters }),
    }),
  openSumoGui: async (withConfig = true) =>
    fetchJson("/api/sumo/open-gui", {
      method: "POST",
      headers: jsonHeaders(),
      body: JSON.stringify({ withConfig }),
    }),

  // SUMO config selection
  listSumoConfigs: async () =>
    fetchJson("/api/sumo/configs", { headers: authHeaders() }),
  setSumoConfig: async (name) =>
    fetchJson("/api/sumo/config", {
      method: "PUT",
      headers: jsonHeaders(),
      body: JSON.stringify({ name }),
    }),

  // Map settings (mode, area filter)
  getMapSettings: async () =>
    fetchJson("/api/map/settings", { headers: authHeaders() }),
  updateMapSettings: async (body) =>
    fetchJson("/api/map/settings", {
      method: "PUT",
      headers: jsonHeaders(),
      body: JSON.stringify(body),
    }),

  // Intersections
  overrideIntersection: async (id, body) =>
    fetchJson(`/api/intersections/${id}/override`, {
      method: "POST",
      headers: jsonHeaders(),
      body: JSON.stringify(body),
    }),

  // Emergencies
  listEmergencies: async () =>
    fetchJson("/api/emergencies", { headers: authHeaders() }),
  forceClearEmergency: async (id) =>
    fetchJson(`/api/emergencies/${id}/force-clear`, {
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
