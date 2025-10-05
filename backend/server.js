const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const http = require("http");
const socketIo = require("socket.io");
const { spawn } = require("child_process");
const path = require("path");
require("dotenv").config({ path: "./config.env" });

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true,
  },
});

const PORT = process.env.PORT || 5001;

// Paths and helpers for SUMO configs located in frontend/public/Sumoconfigs
const ROOT_DIR = path.join(__dirname, "..");
const DEFAULT_SUMO_CONFIG_DIR = path.join(ROOT_DIR, "frontend", "public", "Sumoconfigs");
function resolveSumoConfigPath(nameOrPath) {
  if (!nameOrPath) return path.join(DEFAULT_SUMO_CONFIG_DIR, "AddisAbabaSimple.sumocfg");
  // If absolute or contains drive letter on Windows, return as-is
  if (path.isAbsolute(nameOrPath)) return nameOrPath;
  return path.join(DEFAULT_SUMO_CONFIG_DIR, nameOrPath);
}

// Middleware
app.use(
  cors({
    origin: "http://localhost:3000",
    credentials: true,
  })
);
app.use(express.json());

// MongoDB Connection
mongoose.connect(
  process.env.MONGODB_URI || "mongodb://localhost:27017/traffic_management",
  {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  }
);

const db = mongoose.connection;
db.on("error", console.error.bind(console, "MongoDB connection error:"));
db.once("open", () => {
  console.log("Connected to MongoDB");
});

// Helper: parse cookie header (simple)
function getCookie(req, name) {
  const cookie = req.headers?.cookie || "";
  const parts = cookie.split(/; */).map((c) => c.split("="));
  for (const [k, v] of parts) {
    if (k === name) return decodeURIComponent(v || "");
  }
  return null;
}

// User Schema
const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: {
    type: String,
    enum: ["super_admin", "admin", "operator", "analyst"],
    required: true,
  },
  region: { type: String, default: "" },
  createdAt: { type: Date, default: Date.now },
});

// Traffic Data Schema
const trafficDataSchema = new mongoose.Schema({
  intersectionId: { type: String, required: true },
  trafficFlow: { type: Number, required: true },
  signalStatus: { type: String, required: true },
  vehicleCount: { type: Number, default: 0 },
  averageSpeed: { type: Number, default: 0 },
  timestamp: { type: Date, default: Date.now },
});

// Simulation Status Schema
const simulationStatusSchema = new mongoose.Schema({
  isRunning: { type: Boolean, default: false },
  startTime: { type: Date },
  endTime: { type: Date },
  currentStep: { type: Number, default: 0 },
  totalSteps: { type: Number, default: 0 },
  configPath: { type: String },
  lastUpdated: { type: Date, default: Date.now },
});

// Settings Schema
const settingsSchema = new mongoose.Schema({
  sumo: {
    stepLength: { type: Number, default: 1.0 },
    startWithGui: { type: Boolean, default: false },
    selectedConfig: { type: String, default: "AddisAbabaSimple.sumocfg" },
    configDir: { type: String, default: DEFAULT_SUMO_CONFIG_DIR },
  },
  adaptive: {
    enabled: { type: Boolean, default: true },
    minGreen: { type: Number, default: 8 },
    maxGreen: { type: Number, default: 45 },
  },
  emergency: {
    priorityLevel: { type: String, default: "high" },
    defaultHandling: { type: String, default: "forceGreen" },
  },
  mongodb: {
    uri: { type: String, default: process.env.MONGODB_URI || "" },
  },
  updatedAt: { type: Date, default: Date.now },
});

// Audit Log Schema
const auditLogSchema = new mongoose.Schema({
  time: { type: Date, default: Date.now },
  user: { type: String },
  role: { type: String },
  action: { type: String, required: true },
  target: { type: String },
  meta: { type: Object, default: {} },
});

// Emergency Schema
const emergencySchema = new mongoose.Schema({
  vehicleId: { type: String, required: true },
  type: {
    type: String,
    enum: ["ambulance", "fire_truck", "police", "other"],
    default: "ambulance",
  },
  location: { type: String, default: "" },
  intersectionId: { type: String, default: "" },
  priority: {
    type: String,
    enum: ["low", "med", "high", "critical"],
    default: "high",
  },
  eta: { type: String, default: "" },
  active: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
});

const User = mongoose.model("User", userSchema);
const TrafficData = mongoose.model("TrafficData", trafficDataSchema);
const SimulationStatus = mongoose.model(
  "SimulationStatus",
  simulationStatusSchema
);
const Settings = mongoose.model("Settings", settingsSchema);
const AuditLog = mongoose.model("AuditLog", auditLogSchema);
const Emergency = mongoose.model("Emergency", emergencySchema);
let sumoBridgeProcess = null;

// Map settings (in-memory; could be persisted similarly to Settings if needed)
// bbox: { minLat, minLon, maxLat, maxLon } for Addis Ababa by default
let mapSettings = {
  mode: "simulation", // or "real"
  bbox: {
    minLat: 8.85,
    minLon: 38.6,
    maxLat: 9.15,
    maxLon: 38.9,
  },
};

// Authentication middleware
const authenticateToken = (req, res, next) => {
  let token = null;
  const authHeader = req.headers["authorization"];
  if (authHeader && authHeader.startsWith("Bearer ")) {
    token = authHeader.split(" ")[1];
  }
  if (!token) {
    token = getCookie(req, "access_token");
  }

  if (!token) return res.sendStatus(401);

  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
};

// Authorization middleware
const requireRole = (role) => {
  return (req, res, next) => {
    if (req.user.role !== role) {
      return res.status(403).json({ message: "Insufficient permissions" });
    }
    next();
  };
};

const requireAnyRole = (roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ message: "Insufficient permissions" });
    }
    next();
  };
};

// Simple login rate limiter (memory, per IP)
const loginAttempts = new Map();
function rateLimitLogin(req, res, next) {
  const ip =
    req.headers["x-forwarded-for"] || req.socket.remoteAddress || "unknown";
  const now = Date.now();
  const rec = loginAttempts.get(ip) || { count: 0, reset: now + 5 * 60 * 1000 };
  if (now > rec.reset) {
    rec.count = 0;
    rec.reset = now + 5 * 60 * 1000;
  }
  if (rec.count > 50) {
    return res
      .status(429)
      .json({ message: "Too many login attempts. Try later." });
  }
  rec.count += 1;
  loginAttempts.set(ip, rec);
  next();
}

// Audit helper
async function recordAudit(req, action, target, meta = {}) {
  try {
    await AuditLog.create({
      user: req.user?.username || "anonymous",
      role: req.user?.role || "",
      action,
      target,
      meta,
    });
  } catch (e) {
    console.error("Audit record failed:", e.message);
  }
}

// Initialize default users
const initializeUsers = async () => {
  try {
    const existingAdmin = await User.findOne({ username: "admin" });
    if (!existingAdmin) {
      const hashedPassword = await bcrypt.hash("admin123", 10);
      const admin = new User({
        username: "admin",
        password: hashedPassword,
        role: "super_admin",
        region: "Addis Ababa",
      });
      await admin.save();
      console.log("Default admin user created: admin/admin123");
    }

    const existingOperator = await User.findOne({ username: "operator" });
    if (!existingOperator) {
      const hashedPassword = await bcrypt.hash("operator123", 10);
      const operator = new User({
        username: "operator",
        password: hashedPassword,
        role: "operator",
        region: "Addis Ababa",
      });
      await operator.save();
      console.log("Default operator user created: operator/operator123");
    }
  } catch (error) {
    console.error("Error initializing users:", error);
  }
};

// Routes
app.post("/api/register", async (req, res) => {
  try {
    const { username, password, role, region } = req.body;

    // Check if user exists
    const existingUser = await User.findOne({ username });
    if (existingUser) {
      return res.status(400).json({ message: "User already exists" });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const user = new User({
      username,
      password: hashedPassword,
      role,
      region,
    });

    await user.save();

    res.status(201).json({ message: "User created successfully" });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

app.post("/api/login", rateLimitLogin, async (req, res) => {
  try {
    const { username, password } = req.body;

    // Find user
    const user = await User.findOne({ username });
    if (!user) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    // Check password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    // Generate JWT
    const token = jwt.sign(
      { id: user._id, username: user.username, role: user.role },
      process.env.ACCESS_TOKEN_SECRET,
      { expiresIn: "1h" }
    );

    // Set HttpOnly cookie
    res.cookie("access_token", token, {
      httpOnly: true,
      secure: false, // set true behind HTTPS
      sameSite: "lax",
      maxAge: 60 * 60 * 1000,
      path: "/",
    });

    // Record audit: login
    try {
      await AuditLog.create({
        user: user.username,
        role: user.role,
        action: "login",
        target: String(user._id),
        meta: {},
      });
    } catch (_) {}

    res.json({
      token, // also return for backward compatibility
      user: {
        id: user._id,
        username: user.username,
        role: user.role,
        region: user.region,
      },
    });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

app.post("/api/logout", authenticateToken, async (req, res) => {
  try {
    res.clearCookie("access_token", { path: "/" });
    try {
      await AuditLog.create({
        user: req.user?.username || "unknown",
        role: req.user?.role || "",
        action: "logout",
        target: req.user?.id ? String(req.user.id) : "",
        meta: {},
      });
    } catch (_) {}
    return res.json({ ok: true });
  } catch (e) {
    return res.status(500).json({ message: "Server error" });
  }
});

// Validate current session/token and return user info
app.get("/api/auth/validate", authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("-password");
    if (!user) {
      return res.status(401).json({ message: "Invalid token" });
    }
    return res.json({
      user: {
        id: user._id,
        username: user.username,
        role: user.role,
        region: user.region,
      },
    });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Server error", error: error.message });
  }
});

// Protected routes
app.get(
  "/api/users",
  authenticateToken,
  requireRole("super_admin"),
  async (req, res) => {
    try {
      const users = await User.find().select("-password");
      res.json(users);
    } catch (error) {
      res.status(500).json({ message: "Server error", error: error.message });
    }
  }
);

// Update user (role, region, or password reset)
app.put(
  "/api/users/:id",
  authenticateToken,
  requireRole("super_admin"),
  async (req, res) => {
    try {
      const { role, region, password } = req.body;
      const update = {};
      if (role) update.role = role;
      if (typeof region === "string") update.region = region;
      if (password) update.password = await bcrypt.hash(password, 10);
      const updated = await User.findByIdAndUpdate(req.params.id, update, {
        new: true,
      }).select("-password");
      await recordAudit(req, "update_user", req.params.id, { role, region });
      res.json(updated);
    } catch (error) {
      res.status(500).json({ message: "Server error", error: error.message });
    }
  }
);

// Delete user
app.delete(
  "/api/users/:id",
  authenticateToken,
  requireRole("super_admin"),
  async (req, res) => {
    try {
      await User.findByIdAndDelete(req.params.id);
      await recordAudit(req, "delete_user", req.params.id);
      res.json({ ok: true });
    } catch (error) {
      res.status(500).json({ message: "Server error", error: error.message });
    }
  }
);

// Users: count (super_admin)
app.get(
  "/api/users/count",
  authenticateToken,
  requireRole("super_admin"),
  async (req, res) => {
    try {
      const count = await User.countDocuments({});
      res.json({ count });
    } catch (e) {
      res
        .status(500)
        .json({ message: "Failed to count users", error: e.message });
    }
  }
);

// Settings endpoints
app.get(
  "/api/settings",
  authenticateToken,
  requireAnyRole(["super_admin", "admin"]),
  async (req, res) => {
    try {
      let s = await Settings.findOne();
      if (!s) {
        s = await Settings.create({});
      }
      res.json(s);
    } catch (error) {
      res.status(500).json({ message: "Server error", error: error.message });
    }
  }
);

app.put(
  "/api/settings",
  authenticateToken,
  requireRole("super_admin"),
  async (req, res) => {
    try {
      const body = req.body || {};
      const s = await Settings.findOneAndUpdate(
        {},
        { ...body, updatedAt: new Date() },
        { new: true, upsert: true }
      );
      await recordAudit(req, "update_settings", "settings", {});
      res.json(s);
    } catch (error) {
      res.status(500).json({ message: "Server error", error: error.message });
    }
  }
);

// Map settings endpoints (any authenticated role)
app.get("/api/map/settings", authenticateToken, async (req, res) => {
  try {
    res.json(mapSettings);
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

app.put("/api/map/settings", authenticateToken, async (req, res) => {
  try {
    const body = req.body || {};
    if (body.mode && ["simulation", "real"].includes(body.mode)) {
      mapSettings.mode = body.mode;
    }
    if (
      body.bbox &&
      typeof body.bbox.minLat === "number" &&
      typeof body.bbox.minLon === "number" &&
      typeof body.bbox.maxLat === "number" &&
      typeof body.bbox.maxLon === "number"
    ) {
      mapSettings.bbox = { ...body.bbox };
    }
    res.json(mapSettings);
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// Audit logs
app.get(
  "/api/audit",
  authenticateToken,
  requireRole("super_admin"),
  async (req, res) => {
    try {
      const { user, role, startDate, endDate, limit = 200 } = req.query;
      const query = {};
      if (user) query.user = user;
      if (role) query.role = role;
      if (startDate || endDate) {
        query.time = {};
        if (startDate) query.time.$gte = new Date(startDate);
        if (endDate) query.time.$lte = new Date(endDate);
      }
      const items = await AuditLog.find(query)
        .sort({ time: -1 })
        .limit(parseInt(limit));
      res.json({ items });
    } catch (error) {
      res.status(500).json({ message: "Server error", error: error.message });
    }
  }
);

// Audit CSV export (super_admin)
app.get(
  "/api/audit/export.csv",
  authenticateToken,
  requireRole("super_admin"),
  async (req, res) => {
    try {
      const { user, role, startDate, endDate, limit = 1000 } = req.query;
      const query = {};
      if (user) query.user = user;
      if (role) query.role = role;
      if (startDate || endDate) {
        query.time = {};
        if (startDate) query.time.$gte = new Date(startDate);
        if (endDate) query.time.$lte = new Date(endDate);
      }
      const items = await AuditLog.find(query)
        .sort({ time: -1 })
        .limit(parseInt(limit));
      const headers = ["time", "user", "role", "action", "target"];
      const rows = items.map((l) => [
        l.time ? new Date(l.time).toISOString() : "",
        l.user || "",
        l.role || "",
        l.action || "",
        l.target || "",
      ]);
      const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join(
        "\n"
      );
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", "attachment; filename=audits.csv");
      res.send(csv);
    } catch (error) {
      res.status(500).json({ message: "Server error", error: error.message });
    }
  }
);

app.post("/api/traffic-data", authenticateToken, async (req, res) => {
  try {
    const {
      intersectionId,
      trafficFlow,
      signalStatus,
      vehicleCount,
      averageSpeed,
    } = req.body;

    const trafficData = new TrafficData({
      intersectionId,
      trafficFlow,
      signalStatus,
      vehicleCount,
      averageSpeed,
    });

    await trafficData.save();

    // Emit real-time data to connected clients
    io.emit("trafficData", trafficData);

    res
      .status(201)
      .json({ message: "Traffic data saved successfully", data: trafficData });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

app.get("/api/traffic-data", authenticateToken, async (req, res) => {
  try {
    const { intersectionId, startDate, endDate, limit = 100 } = req.query;
    let query = {};

    if (intersectionId) {
      query.intersectionId = intersectionId;
    }

    if (startDate && endDate) {
      query.timestamp = {
        $gte: new Date(startDate),
        $lte: new Date(endDate),
      };
    }

    const trafficData = await TrafficData.find(query)
      .sort({ timestamp: -1 })
      .limit(parseInt(limit));
    res.json(trafficData);
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// Traffic data CSV export (any authenticated)
app.get("/api/traffic-data/export.csv", authenticateToken, async (req, res) => {
  try {
    const { intersectionId, startDate, endDate, limit = 1000 } = req.query;
    const query = {};
    if (intersectionId) query.intersectionId = intersectionId;
    if (startDate && endDate) {
      query.timestamp = { $gte: new Date(startDate), $lte: new Date(endDate) };
    }
    const items = await TrafficData.find(query)
      .sort({ timestamp: -1 })
      .limit(parseInt(limit));
    const headers = [
      "timestamp",
      "intersectionId",
      "trafficFlow",
      "vehicleCount",
      "averageSpeed",
      "signalStatus",
    ];
    const rows = items.map((d) => [
      d.timestamp ? new Date(d.timestamp).toISOString() : "",
      d.intersectionId || "",
      d.trafficFlow ?? "",
      d.vehicleCount ?? "",
      d.averageSpeed ?? "",
      d.signalStatus ?? "",
    ]);
    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      "attachment; filename=traffic-data.csv"
    );
    res.send(csv);
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// Reports endpoints (simple aggregates)
app.get(
  "/api/reports/kpis",
  authenticateToken,
  requireAnyRole(["super_admin", "admin"]),
  async (req, res) => {
    try {
      const latest = await TrafficData.find()
        .sort({ timestamp: -1 })
        .limit(100);
      const avgSpeed =
        latest.length > 0
          ? (
              latest.reduce((acc, d) => acc + (d.averageSpeed || 0), 0) /
              latest.length
            ).toFixed(1)
          : 0;
      res.json({
        uptime: 99.9,
        congestionReduction: 15.2,
        avgResponse: 24,
        avgSpeed: Number(avgSpeed),
      });
    } catch (error) {
      res.status(500).json({ message: "Server error", error: error.message });
    }
  }
);

app.get(
  "/api/reports/trends",
  authenticateToken,
  requireAnyRole(["super_admin", "admin"]),
  async (req, res) => {
    try {
      const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const data = await TrafficData.find({ timestamp: { $gte: since } });
      const byDay = {};
      data.forEach((d) => {
        const key = new Date(d.timestamp).toISOString().slice(0, 10);
        if (!byDay[key])
          byDay[key] = { day: key, avgSpeed: 0, count: 0, emergencies: 0 };
        byDay[key].avgSpeed += d.averageSpeed || 0;
        byDay[key].count += 1;
        // naive emergencies proxy using high trafficFlow
        if ((d.trafficFlow || 0) > 1000) byDay[key].emergencies += 1;
      });
      const daily = Object.values(byDay).map((x) => ({
        day: x.day,
        avgSpeed: x.count ? Number((x.avgSpeed / x.count).toFixed(1)) : 0,
        emergencies: x.emergencies,
      }));
      res.json({ daily, weekly: [] });
    } catch (error) {
      res.status(500).json({ message: "Server error", error: error.message });
    }
  }
);

// SUMO config endpoints
app.get("/api/sumo/configs", authenticateToken, async (req, res) => {
  try {
    const fs = require("fs");
    const dir = DEFAULT_SUMO_CONFIG_DIR;
    const files = fs
      .readdirSync(dir, { withFileTypes: true })
      .filter((d) => d.isFile() && d.name.toLowerCase().endsWith(".sumocfg"))
      .map((d) => d.name)
      .sort();
    let selected = null;
    try {
      const s = await Settings.findOne();
      selected = s?.sumo?.selectedConfig || null;
    } catch (_) {}
    res.json({ directory: dir, files, selected });
  } catch (e) {
    res.status(500).json({ message: "Failed to list SUMO configs", error: e.message });
  }
});

app.put("/api/sumo/config", authenticateToken, requireAnyRole(["super_admin", "admin"]), async (req, res) => {
  try {
    const { name } = req.body || {};
    if (!name || typeof name !== "string" || !name.endsWith(".sumocfg")) {
      return res.status(400).json({ message: "Invalid config name" });
    }
    const fs = require("fs");
    const fullPath = path.join(DEFAULT_SUMO_CONFIG_DIR, name);
    if (!fs.existsSync(fullPath)) {
      return res.status(404).json({ message: "Config not found" });
    }
    const s = await Settings.findOneAndUpdate(
      {},
      { $set: { "sumo.selectedConfig": name, "sumo.configDir": DEFAULT_SUMO_CONFIG_DIR, updatedAt: new Date() } },
      { new: true, upsert: true }
    );
    await recordAudit(req, "set_sumo_config", name);
    res.json({ ok: true, selected: s?.sumo?.selectedConfig || name });
  } catch (e) {
    res.status(500).json({ message: "Failed to set SUMO config", error: e.message });
  }
});

// SUMO integration endpoints
app.get("/api/sumo/status", authenticateToken, async (req, res) => {
  try {
    let status = await SimulationStatus.findOne().sort({ lastUpdated: -1 });
    if (!status) {
      status = new SimulationStatus({ isRunning: false });
      await status.save();
    }
    res.json(status);
  } catch (error) {
    res.status(500).json({
      message: "Error getting simulation status",
      error: error.message,
    });
  }
});

app.post("/api/sumo/control", authenticateToken, async (req, res) => {
  try {
    const { command, parameters = {} } = req.body;

    let status = await SimulationStatus.findOne().sort({ lastUpdated: -1 });
    if (!status) {
      status = new SimulationStatus();
    }

    switch (command) {
      case "start_simulation":
        if (status.isRunning) {
          return res
            .status(400)
            .json({ message: "Simulation is already running" });
        }

        // Determine config path: prefer Settings.sumo.selectedConfig; fallback to env
        let selectedConfigName = null;
        try {
          const s = await Settings.findOne();
          selectedConfigName = s?.sumo?.selectedConfig || null;
        } catch (_) {}
        const envCfg = process.env.SUMO_CONFIG_PATH || "";
        const cfgPathEffective = resolveSumoConfigPath(selectedConfigName || envCfg);

        status.isRunning = true;
        status.startTime = new Date();
        status.configPath = cfgPathEffective;
        status.currentStep = 0;
        status.totalSteps = 10800; // 3 hours default
        status.lastUpdated = new Date();
        await status.save();

        // Emit status update
        io.emit("simulationStatus", status);

        // Spawn SUMO TraCI bridge (Python)
        try {
          const fs = require("fs");
          function selectPythonCommand() {
            const candidates = [];
            if (process.env.PYTHON_EXE) candidates.push(process.env.PYTHON_EXE);
            if (process.platform === "win32") candidates.push("py");
            candidates.push("python", "python3");
            for (const cmd of candidates) {
              if (!cmd) continue;
              if (cmd.includes(":") || cmd.includes("/") || cmd.includes("\\")) {
                if (fs.existsSync(cmd)) return cmd;
                continue;
              }
              return cmd;
            }
            return "python";
          }

          const pythonExe = selectPythonCommand();
          const bridgePath = require("path").join(__dirname, "sumo_bridge.py");
          const env = { ...process.env };
          if (process.env.SUMO_HOME) {
            const pathMod = require('path');
            env.PYTHONPATH = [
              env.PYTHONPATH || "",
              pathMod.join(process.env.SUMO_HOME, "tools"),
            ]
              .filter(Boolean)
              .join(pathMod.delimiter);
            // Ensure SUMO bin is on PATH so "sumo" resolves if used
            const sumoBin = pathMod.join(process.env.SUMO_HOME, 'bin');
            env.PATH = [sumoBin, env.PATH || process.env.PATH || ""].filter(Boolean).join(pathMod.delimiter);
          }

          // Decide whether to launch with GUI
          let startWithGuiFlag = false;
          if (typeof parameters.startWithGui === 'boolean') {
            startWithGuiFlag = parameters.startWithGui;
          } else {
            try {
              const s = await Settings.findOne();
              startWithGuiFlag = !!(s && s.sumo && s.sumo.startWithGui);
            } catch (_) {}
          }

          function fileExists(p) {
            try { return !!p && require('fs').existsSync(p); } catch { return false; }
          }
          function resolveSumoBinary(sel, wantGui) {
            const fs = require('fs');
            const path = require('path');
            const isAbs = sel && (sel.includes(':') || sel.includes('/') || sel.includes('\\'));
            if (isAbs && fileExists(sel)) return sel;
            // Try SUMO_HOME/bin
            if (process.env.SUMO_HOME) {
              const bin = path.join(process.env.SUMO_HOME, 'bin',
                process.platform === 'win32' ? (wantGui ? 'sumo-gui.exe' : 'sumo.exe') : (wantGui ? 'sumo-gui' : 'sumo')
              );
              if (fileExists(bin)) return bin;
            }
            // Fallback to name on PATH
            return wantGui ? (process.platform === 'win32' ? 'sumo-gui.exe' : 'sumo-gui') : (process.platform === 'win32' ? 'sumo.exe' : 'sumo');
          }

          const selectedBinary = resolveSumoBinary(
            startWithGuiFlag ? process.env.SUMO_BINARY_GUI_PATH : process.env.SUMO_BINARY_PATH,
            !!startWithGuiFlag
          );

          const fsCheck = require('fs');
          if (!fsCheck.existsSync(cfgPathEffective)) {
            io.emit("simulationLog", { level: "error", message: `SUMO config not found: ${cfgPathEffective}`, ts: Date.now() });
            status.isRunning = false;
            status.lastUpdated = new Date();
            await status.save();
            io.emit("simulationStatus", status);
            return res.status(400).json({ message: "SUMO config not found" });
          }
          if (!(selectedBinary && (selectedBinary.includes(':') || selectedBinary.includes('/') || selectedBinary.includes('\\')))) {
            // If using name on PATH, that's fine. Otherwise verify absolute path exists (handled above in resolve)
          } else if (!fsCheck.existsSync(selectedBinary)) {
            io.emit("simulationLog", { level: "error", message: `SUMO binary not found: ${selectedBinary}`, ts: Date.now() });
            status.isRunning = false;
            status.lastUpdated = new Date();
            await status.save();
            io.emit("simulationStatus", status);
            return res.status(400).json({ message: "SUMO binary not found" });
          }

          const settingsDoc = await Settings.findOne();
          const stepLen = settingsDoc?.sumo?.stepLength || 1.0;
          const args = [
            bridgePath,
            "--sumo-bin",
            selectedBinary,
            "--sumo-cfg",
            cfgPathEffective,
            "--step-length",
            String(stepLen),
          ];

          sumoBridgeProcess = spawn(pythonExe, args, { env });

          // Announce launch
          io.emit("simulationLog", {
            level: "info",
            message: `Launching SUMO (${selectedBinary}) config=${cfgPathEffective} step=${stepLen}`,
            ts: Date.now(),
          });
          if (sumoBridgeProcess.pid) {
            io.emit("simulationLog", {
              level: "info",
              message: `SUMO bridge PID=${sumoBridgeProcess.pid}`,
              ts: Date.now(),
            });
          }

          // Prevent crash on spawn errors and reflect status
          sumoBridgeProcess.on("error", async (err) => {
            const msg = err?.message || String(err);
            console.error("[SUMO BRIDGE] spawn error:", msg);
            io.emit("simulationLog", { level: "error", message: `Bridge spawn error: ${msg}` , ts: Date.now() });
            try {
              status.isRunning = false;
              status.endTime = new Date();
              status.lastUpdated = new Date();
              await status.save();
            } catch (_) {}
            io.emit("simulationStatus", status);
          });

          let buffer = "";
          let lastStepLog = 0;
          sumoBridgeProcess.stdout.on("data", (chunk) => {
            buffer += chunk.toString();
            let index;
            while ((index = buffer.indexOf("\n")) >= 0) {
              const line = buffer.slice(0, index).trim();
              buffer = buffer.slice(index + 1);
              if (!line) continue;
              try {
                const payload = JSON.parse(line);
                // Apply optional bbox filtering for city-wide scenarios
                const bbox = mapSettings?.bbox;
                if (bbox && payload && typeof payload === "object") {
                  const within = (lat, lon) =>
                    typeof lat === "number" &&
                    typeof lon === "number" &&
                    lat >= bbox.minLat &&
                    lat <= bbox.maxLat &&
                    lon >= bbox.minLon &&
                    lon <= bbox.maxLon;

                  if (payload.type === "net" && Array.isArray(payload.lanes)) {
                    payload.lanes = payload.lanes
                      .map((l) => ({
                        ...l,
                        lonlat: Array.isArray(l.lonlat)
                          ? l.lonlat.filter((p) => within(p.lat, p.lon))
                          : [],
                      }))
                      .filter((l) => (l.lonlat?.length || 0) >= 2);
                    // include bbox as geoBounds for frontend fit
                    payload.geoBounds = {
                      minLat: bbox.minLat,
                      minLon: bbox.minLon,
                      maxLat: bbox.maxLat,
                      maxLon: bbox.maxLon,
                    };
                  } else if (payload.type === "viz") {
                    if (Array.isArray(payload.vehicles)) {
                      payload.vehicles = payload.vehicles.filter((v) =>
                        within(v.lat, v.lon)
                      );
                    }
                    if (Array.isArray(payload.tls)) {
                      payload.tls = payload.tls.filter((t) =>
                        within(t.lat, t.lon)
                      );
                    }
                  }
                }
                // Broadcast visualization and also lightweight stats
                io.emit("viz", payload);

                // Periodic console-like log (every 50 steps)
                if (payload.type === "viz" && typeof payload.step === "number") {
                  status.currentStep = payload.step;
                  if (payload.step >= lastStepLog + 50) {
                    const vCount = Array.isArray(payload.vehicles) ? payload.vehicles.length : 0;
                    const tlsCount = Array.isArray(payload.tls) ? payload.tls.length : 0;
                    let avgSpeed = 0;
                    if (vCount > 0) {
                      let sum = 0;
                      for (const v of payload.vehicles) {
                        if (typeof v.speed === 'number') sum += v.speed;
                      }
                      avgSpeed = Number((sum / vCount).toFixed(2));
                    }
                    io.emit("simulationLog", {
                      level: "info",
                      message: `Step ${payload.step} | vehicles=${vCount} avgSpeed=${avgSpeed}m/s tls=${tlsCount}`,
                      ts: Date.now(),
                    });
                    lastStepLog = payload.step;
                  }
                }
              } catch (e) {
                // ignore malformed line
              }
            }
          });

          sumoBridgeProcess.stderr.on("data", (chunk) => {
            const msg = chunk.toString();
            console.error("[SUMO BRIDGE]", msg);
            io.emit("simulationLog", { level: "warn", message: msg.trim(), ts: Date.now() });
          });

          sumoBridgeProcess.on("exit", (code) => {
            sumoBridgeProcess = null;
            status.isRunning = false;
            status.endTime = new Date();
            status.lastUpdated = new Date();
            status.save().then(() => io.emit("simulationStatus", status));
            io.emit("simulationLog", { level: (code === 0 ? "info" : "error"), message: `SUMO bridge exited with code ${code}`, ts: Date.now() });
            console.log(`SUMO bridge exited with code ${code}`);
          });
        } catch (err) {
          console.error("Failed to start SUMO bridge:", err);
          io.emit("simulationLog", { level: "error", message: `Failed to start SUMO bridge: ${err?.message || err}`, ts: Date.now() });
        }

        await recordAudit(req, "start_simulation", "sumo", parameters);
        res.json({
          status: "success",
          message: "Simulation started successfully",
          data: status,
        });
        break;

      case "stop_simulation":
        if (!status.isRunning) {
          return res
            .status(400)
            .json({ message: "No simulation is currently running" });
        }

        // Stop bridge if running
        if (sumoBridgeProcess) {
          try {
            sumoBridgeProcess.kill("SIGTERM");
          } catch (e) {}
          sumoBridgeProcess = null;
        }

        status.isRunning = false;
        status.endTime = new Date();
        status.lastUpdated = new Date();
        await status.save();

        // Emit status update
        io.emit("simulationStatus", status);

        await recordAudit(req, "stop_simulation", "sumo");
        res.json({
          status: "success",
          message: "Simulation stopped successfully",
          data: status,
        });
        break;

      case "pause_simulation":
        if (!status.isRunning) {
          return res
            .status(400)
            .json({ message: "No simulation is currently running" });
        }

        status.isRunning = false;
        status.lastUpdated = new Date();
        await status.save();

        io.emit("simulationStatus", status);

        await recordAudit(req, "pause_simulation", "sumo");
        res.json({
          status: "success",
          message: "Simulation paused successfully",
          data: status,
        });
        break;

      case "resume_simulation":
        if (status.isRunning) {
          return res
            .status(400)
            .json({ message: "Simulation is already running" });
        }

        status.isRunning = true;
        status.lastUpdated = new Date();
        await status.save();

        io.emit("simulationStatus", status);

        await recordAudit(req, "resume_simulation", "sumo");
        res.json({
          status: "success",
          message: "Simulation resumed successfully",
          data: status,
        });
        break;

      default:
        res.status(400).json({ message: "Invalid command" });
    }
  } catch (error) {
    res
      .status(500)
      .json({ message: "SUMO command error", error: error.message });
  }
});

// Open SUMO GUI application (admin or super_admin)
app.post(
  "/api/sumo/open-gui",
  authenticateToken,
  requireAnyRole(["super_admin", "admin"]),
  async (req, res) => {
    try {
      const startWithCfg = req.body?.withConfig !== false; // default true
      // Resolve from settings or env
      let selectedConfigName = null;
      try {
        const s = await Settings.findOne();
        selectedConfigName = s?.sumo?.selectedConfig || null;
      } catch (_) {}
      const cfgPath = resolveSumoConfigPath(selectedConfigName || process.env.SUMO_CONFIG_PATH || "");
      const guiBinary =
        process.env.SUMO_BINARY_GUI_PATH ||
        (process.platform === "win32" ? "sumo-gui.exe" : "sumo-gui");

      const args = [];
      if (startWithCfg && cfgPath) {
        args.push("-c", cfgPath);
      }

      const child = spawn(guiBinary, args, { detached: true, stdio: "ignore" });
      child.unref();

      await recordAudit(req, "open_sumo_gui", guiBinary, { args });
      return res.json({ ok: true });
    } catch (e) {
      return res
        .status(500)
        .json({ message: "Failed to open SUMO GUI", error: e.message });
    }
  }
);

// Intersection manual override (admin/super_admin)
app.post(
  "/api/intersections/:id/override",
  authenticateToken,
  async (req, res) => {
    try {
      if (!["admin", "super_admin"].includes(req.user.role)) {
        return res.status(403).json({ message: "Insufficient permissions" });
      }
      const intersectionId = req.params.id;
      const { desiredState = "green", durationSec = 15 } = req.body || {};
      // Here you would send a command to SUMO/TraCI to force state
      // For now we just record an audit event
      await recordAudit(req, "intersection_override", intersectionId, {
        desiredState,
        durationSec,
      });
      res.json({ ok: true, intersectionId, desiredState, durationSec });
    } catch (error) {
      res.status(500).json({ message: "Server error", error: error.message });
    }
  }
);

// Emergencies: list active
app.get("/api/emergencies", authenticateToken, async (req, res) => {
  try {
    const items = await Emergency.find({ active: true }).sort({
      createdAt: -1,
    });
    res.json({ items });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// Emergencies: force clear route (admin/super_admin)
app.post(
  "/api/emergencies/:id/force-clear",
  authenticateToken,
  async (req, res) => {
    try {
      if (!["admin", "super_admin"].includes(req.user.role)) {
        return res.status(403).json({ message: "Insufficient permissions" });
      }
      const doc = await Emergency.findByIdAndUpdate(
        req.params.id,
        { active: false },
        { new: true }
      );
      await recordAudit(req, "force_clear_emergency", req.params.id);
      res.json({ ok: true, item: doc });
    } catch (error) {
      res.status(500).json({ message: "Server error", error: error.message });
    }
  }
);

// Emergencies: seed endpoint (optional, for demo)
app.post(
  "/api/emergencies",
  authenticateToken,
  requireRole("super_admin"),
  async (req, res) => {
    try {
      const payload = req.body || {};
      const doc = await Emergency.create(payload);
      res.status(201).json({ ok: true, item: doc });
    } catch (error) {
      res.status(500).json({ message: "Server error", error: error.message });
    }
  }
);

// Stats: overview for super admin
app.get(
  "/api/stats/overview",
  authenticateToken,
  requireAnyRole(["super_admin", "admin"]),
  async (req, res) => {
    try {
      const results = await Promise.allSettled([
        User.countDocuments({}),
        Emergency.countDocuments({ active: true }),
        SimulationStatus.findOne().sort({ lastUpdated: -1 }),
        Promise.resolve(mongoose.connection.readyState),
        TrafficData.countDocuments({ timestamp: { $gte: new Date(Date.now() - 15 * 60 * 1000) } }),
      ]);

      const [uRes, eRes, sRes, mRes, tRes] = results;
      const userCount = uRes.status === 'fulfilled' ? Number(uRes.value || 0) : 0;
      const activeEmergencies = eRes.status === 'fulfilled' ? Number(eRes.value || 0) : 0;
      const latestStatus = sRes.status === 'fulfilled' ? sRes.value : null;
      const mongoState = mRes.status === 'fulfilled' ? mRes.value : mongoose.connection.readyState;
      const recentTrafficDocs = tRes.status === 'fulfilled' ? Number(tRes.value || 0) : 0;

      // Log any failures for debugging without failing the endpoint
      if (uRes.status === 'rejected') console.warn('[overview] userCount failed:', uRes.reason?.message || uRes.reason);
      if (eRes.status === 'rejected') console.warn('[overview] emergencies failed:', eRes.reason?.message || eRes.reason);
      if (sRes.status === 'rejected') console.warn('[overview] sim status failed:', sRes.reason?.message || sRes.reason);
      if (tRes.status === 'rejected') console.warn('[overview] telemetry count failed:', tRes.reason?.message || tRes.reason);

      const activeSimulations = latestStatus?.isRunning ? 1 : 0;

      // Dynamic health score [0..100]
      const mongoHealthy = mongoState === 1; // 1 = connected
      const simHealthy = !!activeSimulations; // running = healthy
      const telemetryHealthy = recentTrafficDocs > 0; // we have fresh data

      let score = 0;
      score += mongoHealthy ? 40 : 0;
      score += simHealthy ? 40 : 20; // if not running, still partially OK
      score += telemetryHealthy ? 20 : 0;
      const systemHealth = Math.min(100, Math.max(0, score));

      res.json({
        userCount,
        activeSimulations,
        systemHealth,
        emergencyCount: activeEmergencies,
        health: {
          mongoHealthy,
          simHealthy,
          telemetryHealthy,
          mongoState,
          recentTrafficDocs,
        },
      });
    } catch (e) {
      // Absolute fallback: best-effort values with minimal info, never 500
      const mongoState = mongoose.connection.readyState;
      const mongoHealthy = mongoState === 1;
      const systemHealth = mongoHealthy ? 40 : 0;
      return res.status(200).json({
        userCount: 0,
        activeSimulations: 0,
        systemHealth,
        emergencyCount: 0,
        health: { mongoHealthy, simHealthy: false, telemetryHealthy: false, mongoState, recentTrafficDocs: 0 },
      });
    }
  }
);

// Stats: admin operations
app.get(
  "/api/stats/admin",
  authenticateToken,
  requireAnyRole(["super_admin", "admin"]),
  async (req, res) => {
    try {
      const since = new Date(Date.now() - 60 * 60 * 1000);
      const recent = await TrafficData.find({ timestamp: { $gte: since } });
      const vehicleCount = recent.reduce(
        (acc, d) => acc + (d.vehicleCount || 0),
        0
      );
      const activeVehicles = Math.round(
        vehicleCount / Math.max(recent.length, 1)
      );
      const avgSpeed = recent.length
        ? Number(
            (
              recent.reduce((a, d) => a + (d.averageSpeed || 0), 0) /
              recent.length
            ).toFixed(1)
          )
        : 0;
      const queueLength = recent.reduce(
        (acc, d) => acc + (d.trafficFlow || 0),
        0
      );
      const emergencyOverrides = await Emergency.countDocuments({
        active: true,
      });

      res.json({
        activeVehicles: isNaN(activeVehicles) ? 0 : activeVehicles,
        avgSpeed,
        queueLength,
        emergencyOverrides,
      });
    } catch (e) {
      res
        .status(500)
        .json({ message: "Failed to load admin stats", error: e.message });
    }
  }
);

// Socket.IO connection handling
io.on("connection", (socket) => {
  console.log("Client connected:", socket.id);

  socket.on("disconnect", () => {
    console.log("Client disconnected:", socket.id);
  });

  // Send current simulation status to newly connected client
  socket.on("getStatus", async () => {
    try {
      const status = await SimulationStatus.findOne().sort({ lastUpdated: -1 });
      socket.emit("simulationStatus", status || { isRunning: false });
    } catch (error) {
      console.error("Error getting status:", error);
    }
  });
});

// Serve static files in production
if (process.env.NODE_ENV === "production") {
  app.use(express.static(path.join(__dirname, "../frontend/build")));

  app.get("*", (req, res) => {
    res.sendFile(path.join(__dirname, "../frontend/build", "index.html"));
  });
}

// Initialize users and start server
initializeUsers().then(() => {
  server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`SUMO config path: ${process.env.SUMO_CONFIG_PATH}`);
  });
});
