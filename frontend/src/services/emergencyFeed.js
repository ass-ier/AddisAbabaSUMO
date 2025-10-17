import io from "socket.io-client";

// Lightweight emergency feed client that DOES NOT interfere with existing websocketService
// - Separate socket connection (optionally to a namespace/path) to avoid touching heatmap feed
// - Compact handlers for vehicle frames and route frames
// - Optional HTTP snapshot fetch for debug/inspection

const DEFAULT_SERVER = process.env.REACT_APP_SERVER_URL || "http://localhost:5001";
const API_BASE = process.env.REACT_APP_API_BASE || DEFAULT_SERVER;

export class EmergencyFeedClient {
  constructor({ namespace = (process.env.REACT_APP_EMERGENCY_NAMESPACE || "/"), path = (process.env.REACT_APP_EMERGENCY_PATH || undefined) } = {}) {
    this.serverUrl = DEFAULT_SERVER;
    this.namespace = namespace; // can be "/" if server does not use namespace
    this.path = path; // optional custom path
    this.socket = null;
    this.connected = false;

    this.handlers = {
      vehicleFrame: new Set(),
      routeFrame: new Set(),
      log: new Set(),
      status: new Set(),
      connected: new Set(),
      disconnected: new Set(),
    };

    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 8;
  }

  // DEV ONLY methods: allow local injection when no bridge is present
  // These do not affect production usage and will noop in production builds
  devEmitVehicles(frame) {
    if (process.env.NODE_ENV === "production") return;
    this._emit("vehicleFrame", frame);
  }
  devEmitRoutes(frame) {
    if (process.env.NODE_ENV === "production") return;
    this._emit("routeFrame", frame);
  }

  connect() {
    if (this.socket && this.connected) return Promise.resolve();

    // Try namespace first; fallback to root if server rejects
    const url = this.namespace && this.namespace !== "/" ? `${this.serverUrl}${this.namespace}` : this.serverUrl;

    return new Promise((resolve) => {
      const options = {
        withCredentials: true,
        transports: ["websocket", "polling"],
        timeout: 20000,
        autoConnect: true,
      };
      if (this.path) options.path = this.path;

      this.socket = io(url, options);

      this.socket.on("connect", () => {
        this.connected = true;
        this.reconnectAttempts = 0;
        this._emit("connected", { id: this.socket.id });
        resolve();
      });

      this.socket.on("disconnect", (reason) => {
        this.connected = false;
        this._emit("disconnected", { reason });
        if (reason !== "io client disconnect") this._scheduleReconnect();
      });

      // Emergency feed standard events
      this.socket.on("emergencyVehicles", (frame) => this._emit("vehicleFrame", frame));
      this.socket.on("emergencyRoutes", (frame) => this._emit("routeFrame", frame));
      this.socket.on("emergencyLog", (msg) => this._emit("log", msg));
      this.socket.on("emergencyStatus", (s) => this._emit("status", s));

      // Compatibility: support alternate names if bridge uses different labels
      this.socket.on("emergency", (frame) => this._emit("vehicleFrame", frame));
      this.socket.on("route", (frame) => this._emit("routeFrame", frame));

      // Tap existing simulation 'viz' feed to derive emergency vehicles (ambulance/fire/police)
      const mapVizToEmergency = (payload) => {
        try {
          if (!payload || !Array.isArray(payload.vehicles)) return;

          const matchAny = String(process.env.REACT_APP_EMERGENCY_MATCH_ANY || "false").toLowerCase() === "true";
          const typeWhitelist = String(process.env.REACT_APP_EMERGENCY_VTYPES || "ambulance,firetruck,police,vip,vip_escort")
            .split(",")
            .map((s) => s.trim().toLowerCase())
            .filter(Boolean);
          const classWhitelist = String(process.env.REACT_APP_EMERGENCY_VCLASS || "emergency,authority")
            .split(",")
            .map((s) => s.trim().toLowerCase())
            .filter(Boolean);

          const isEmergency = (v) => {
            if (matchAny) return true;
            const typeId = String(v.vTypeId || v.vType || v.type || v.vehicleType || "").toLowerCase();
            const vClass = String(v.vClass || v.class || "").toLowerCase();
            if (typeWhitelist.includes(typeId)) return true;
            if (classWhitelist.includes(vClass)) return true;
            // fallback substring checks
            if (typeId.includes("ambulance") || typeId.includes("fire") || typeId.includes("police")) return true;
            return false;
          };

          const normalizeType = (v) => {
            const typeId = String(v.vTypeId || v.vType || v.type || v.vehicleType || "").toLowerCase();
            if (typeId.includes("ambulance")) return "ambulance";
            if (typeId.includes("fire")) return "fire";
            if (typeId.includes("police")) return "police";
            if (typeId.includes("vip_escort")) return "vip_escort";
            if (typeId.includes("vip")) return "vip";
            return "other";
          };

          const list = payload.vehicles
            .filter(isEmergency)
            .map((v) => ({
              vehicleId: v.id || v.vehicleId,
              x: typeof v.x === "number" ? v.x : undefined,
              y: typeof v.y === "number" ? v.y : undefined,
              speed: v.speed,
              heading: v.angle,
              vehicleType: normalizeType(v),
              emergencyState: "en-route",
              routeId: v.routeId,
            }));

          if (list.length) this._emit("vehicleFrame", { timestamp: Date.now(), vehicles: list });
        } catch (e) {
          // eslint-disable-next-line no-console
          console.warn("viz->emergency mapping failed", e);
        }
      };

      this.socket.on("viz", mapVizToEmergency);
      this.socket.on("sumoData", mapVizToEmergency);
    });
  }

  _scheduleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) return;
    this.reconnectAttempts += 1;
    const delay = Math.min(30000, 1000 * Math.pow(2, this.reconnectAttempts));
    setTimeout(() => this.connect().catch(() => {}), delay);
  }

  on(event, cb) {
    const set = this.handlers[event];
    if (!set) return () => {};
    set.add(cb);
    return () => set.delete(cb);
  }

  _emit(event, payload) {
    const set = this.handlers[event];
    if (!set) return;
    for (const cb of set) {
      try {
        cb(payload);
      } catch (e) {
        // safe-guard
        // eslint-disable-next-line no-console
        console.error("EmergencyFeed handler error", e);
      }
    }
  }

  requestRoute({ vehicleId, routeId }) {
    if (!this.socket || !this.connected) return;
    this.socket.emit("getEmergencyRoute", { vehicleId, routeId });
  }

  async fetchSnapshot() {
    try {
      const res = await fetch(`${API_BASE}/api/emergency/snapshot`, {
        credentials: "include",
        cache: "no-store",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (e) {
      return { vehicles: [], routes: [], error: String(e) };
    }
  }

  disconnect() {
    try {
      this.socket?.disconnect();
    } catch (_) {}
    this.socket = null;
    this.connected = false;
  }
}

export const emergencyFeed = new EmergencyFeedClient();