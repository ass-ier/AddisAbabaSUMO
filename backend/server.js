const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const http = require("http");
const Redis = require("ioredis"); // Import ioredis client
const socketIo = require("socket.io");
const { spawn } = require("child_process");
const path = require("path");
require("dotenv").config({ path: "./config.env" });

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: ["http://localhost:3000", "http://127.0.0.1:3000"],
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true,
    allowedHeaders: ["Content-Type", "Authorization"],
  },
  transports: ['websocket', 'polling'],
  pingTimeout: 60000,
  pingInterval: 25000,
});

const PORT = process.env.PORT || 5001;

// Paths and helpers for SUMO configs located in Sumoconfigs directory
const ROOT_DIR = path.join(__dirname, "..");
const DEFAULT_SUMO_CONFIG_DIR = path.join(
  ROOT_DIR,
  "Sumoconfigs"
);
function resolveSumoConfigPath(nameOrPath) {
  if (!nameOrPath)
    return path.join(DEFAULT_SUMO_CONFIG_DIR, "AddisAbabaSimple.sumocfg");
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

// Redis Client Initialization
const redisClient = new Redis({
  port: process.env.REDIS_PORT || 6379, // Default Redis port
  host: process.env.REDIS_HOST || "127.0.0.1", // Default Redis host
  password: process.env.REDIS_PASSWORD || undefined, // If your Redis requires a password
  // Enable lazy connect to prevent app crash on startup if Redis is not available.
  // The client will attempt to connect when the first command is executed.
  lazyConnect: true,
});

redisClient.on("connect", () => {
  console.log("Connected to Redis!");
});
redisClient.on("error", (err) => console.error("Redis Client Error", err));

// MongoDB Connection
mongoose.connect(
  process.env.MONGODB_URI || "mongodb://localhost:27017/traffic_management",
  {}
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
    enum: ["super_admin", "operator", "analyst"],
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

// TLS mapping configuration
let tlsMapping = {};
function loadTlsMapping() {
  try {
    const fs = require('fs');
    const tlsMappingPath = path.join(__dirname, 'tls-mapping.json');
    if (fs.existsSync(tlsMappingPath)) {
      const data = fs.readFileSync(tlsMappingPath, 'utf8');
      tlsMapping = JSON.parse(data);
      console.log('TLS mapping loaded with', Object.keys(tlsMapping.mappings || {}).length, 'friendly names');
    } else {
      console.warn('TLS mapping file not found:', tlsMappingPath);
    }
  } catch (error) {
    console.error('Failed to load TLS mapping:', error.message);
  }
}

// Function to resolve TLS ID (friendly name -> actual SUMO ID)
function resolveTlsId(inputId) {
  if (tlsMapping.mappings && tlsMapping.mappings[inputId]) {
    return tlsMapping.mappings[inputId];
  }
  return inputId; // Return as-is if no mapping found
}

// Load TLS mapping on startup
loadTlsMapping();

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

// User creation endpoint for admin panel
app.post(
  "/api/users",
  authenticateToken,
  requireRole("super_admin"),
  async (req, res) => {
    try {
  const { username, password, role, region, email, firstName, lastName, phoneNumber } = req.body;

      // Check if user exists (normalize username to lowercase for consistency)
      const existingUser = await User.findOne({ username: username.toLowerCase() });
      if (existingUser) {
        return res.status(400).json({ message: "User already exists" });
      }

      // Create user (let model pre-save hook hash the password)
      const user = new User({
        username: username.toLowerCase(),
        email,
        password,
        firstName,
        lastName,
        phoneNumber,
        role,
        region,
      });

      await user.save();

      // Invalidate user list cache
      try {
        await redisClient.del("users_list");
        console.log("Cache invalidated for: users_list");
      } catch (e) {
        console.error(
          "Redis cache invalidation failed for users_list:",
          e.message
        );
      }

      await recordAudit(req, "create_user", username, { role, region });
      res.status(201).json({ message: "User created successfully" });
    } catch (error) {
      res.status(500).json({ message: "Server error", error: error.message });
    }
  }
);

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

// Health check endpoint
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    mongodb: mongoose.connection.readyState === 1 ? "connected" : "disconnected",
    realtime: "enabled"
  });
});

// Public registration endpoint (for initial user setup only)
app.post("/api/register", async (req, res) => {
  try {
    const { username, password, role, region } = req.body;

    // Check if user exists (normalize username to lowercase for consistency)
    const existingUser = await User.findOne({ username: username.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({ message: "User already exists" });
    }

    // Create user (let model pre-save hook hash the password)
    const user = new User({
      username: username.toLowerCase(),
      password,
      role,
      region,
    });

    await user.save();

    // This is a new user, so we must invalidate the user list cache.
    try {
      await redisClient.del("users_list");
      console.log("Cache invalidated for: users_list");
    } catch (e) {
      console.error(
        "Redis cache invalidation failed for users_list:",
        e.message
      );
    }

    res.status(201).json({ message: "User created successfully" });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

app.post("/api/login", rateLimitLogin, async (req, res) => {
  try {
    const { username, password } = req.body;

    // Find user (normalize username to lowercase for consistency)
    const user = await User.findOne({ username: username.toLowerCase() });
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
      const cacheKey = "users_list";
      try {
        const cachedUsers = await redisClient.get(cacheKey);
        if (cachedUsers) {
          console.log("Serving user list from Redis cache");
          return res.json(JSON.parse(cachedUsers));
        }
      } catch (e) {
        console.error("Redis GET failed for users_list:", e.message);
      }

      console.log("Fetching user list from database...");
      const users = await User.find().select("-password");
      try {
        await redisClient.set(cacheKey, JSON.stringify(users)); // Cache indefinitely until an update
      } catch (e) {
        console.error("Redis SET failed for users_list:", e.message);
      }
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

      // Invalidate cache on update
      try {
        await redisClient.del("users_list");
        console.log("Cache invalidated for: users_list");
      } catch (e) {
        console.error("Redis DEL failed for users_list:", e.message);
      }
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

      // Invalidate cache on delete
      try {
        await redisClient.del("users_list");
        console.log("Cache invalidated for: users_list");
      } catch (e) {
        console.error("Redis DEL failed for users_list:", e.message);
      }
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
      const cacheKey = "users_count";
      try {
        const cachedCount = await redisClient.get(cacheKey);
        if (cachedCount) {
          console.log("Serving user count from Redis cache");
          return res.json({ count: parseInt(cachedCount, 10) });
        }
      } catch (e) {
        console.error("Redis GET failed for users_count:", e.message);
      }
      const count = await User.countDocuments({});
      try {
        await redisClient.setex(cacheKey, 3600, count); // Cache for 1 hour
      } catch (e) {
        console.error("Redis SETEX failed for users_count:", e.message);
      }
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
  requireAnyRole(["super_admin"]),
  async (req, res) => {
    try {
      const cacheKey = "system_settings";
      try {
        const cachedSettings = await redisClient.get(cacheKey);
        if (cachedSettings) {
          console.log("Serving settings from Redis cache");
          return res.json(JSON.parse(cachedSettings));
        }
      } catch (e) {
        console.error("Redis GET failed for system_settings:", e.message);
      }

      console.log("Fetching settings from database...");
      let s = await Settings.findOne();
      if (!s) {
        s = await Settings.create({});
      }
      try {
        await redisClient.set(cacheKey, JSON.stringify(s)); // Cache indefinitely until an update
      } catch (e) {
        console.error("Redis SET failed for system_settings:", e.message);
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

      // Invalidate settings cache on update
      try {
        await redisClient.del("system_settings");
        console.log("Cache invalidated for: system_settings");
      } catch (e) {
        console.error("Redis DEL failed for system_settings:", e.message);
      }
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
      const { user, role, startDate, endDate, limit = 200 } = req.query; // Use let for query

      // Create a dynamic cache key based on query parameters
      const cacheKey = `audit_logs:${user || ""}:${role || ""}:${
        startDate || ""
      }:${endDate || ""}:${limit}`;
      try {
        const cachedLogs = await redisClient.get(cacheKey);
        if (cachedLogs) {
          console.log("Serving audit logs from Redis cache");
          return res.json(JSON.parse(cachedLogs));
        }
      } catch (e) {
        console.error(`Redis GET failed for ${cacheKey}:`, e.message);
      }

      console.log("Fetching audit logs from database...");
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

      try {
        await redisClient.setex(cacheKey, 30, JSON.stringify({ items })); // Cache for 30 seconds
      } catch (e) {
        console.error(`Redis SETEX failed for ${cacheKey}:`, e.message);
      }
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
    const { intersectionId, startDate, endDate, limit = 100 } = req.query; // Use let for query

    const cacheKey = `traffic_data:${intersectionId || "all"}:${
      startDate || ""
    }:${endDate || ""}:${limit}`;
    try {
      const cachedData = await redisClient.get(cacheKey);
      if (cachedData) {
        console.log("Serving traffic data from Redis cache");
        return res.json(JSON.parse(cachedData));
      }
    } catch (e) {
      console.error(`Redis GET failed for ${cacheKey}:`, e.message);
    }

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
    try {
      await redisClient.setex(cacheKey, 60, JSON.stringify(trafficData)); // Cache for 60 seconds
    } catch (e) {
      console.error(`Redis SETEX failed for ${cacheKey}:`, e.message);
    }
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
  requireAnyRole(["super_admin"]),
  async (req, res) => {
    try {
      const cacheKey = "reports_kpis";
      try {
        const cachedKpis = await redisClient.get(cacheKey);
        if (cachedKpis) {
          console.log("Serving KPIs from Redis cache");
          return res.json(JSON.parse(cachedKpis));
        }
      } catch (e) {
        console.error("Redis GET failed for reports_kpis:", e.message);
      }

      console.log("Fetching KPIs from database...");
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
      const kpis = {
        uptime: 99.9,
        congestionReduction: 15.2,
        avgResponse: 24,
        avgSpeed: Number(avgSpeed),
      };

      // Cache for 60 seconds
      try {
        await redisClient.setex(cacheKey, 60, JSON.stringify(kpis));
      } catch (e) {
        console.error("Redis SETEX failed for reports_kpis:", e.message);
      }
      res.json(kpis);
    } catch (error) {
      res.status(500).json({ message: "Server error", error: error.message });
    }
  }
);

app.get(
  "/api/reports/trends",
  authenticateToken,
  requireAnyRole(["super_admin"]),
  async (req, res) => {
    try {
      const cacheKey = "reports_trends";
      try {
        const cachedTrends = await redisClient.get(cacheKey);
        if (cachedTrends) {
          console.log("Serving trends from Redis cache");
          return res.json(JSON.parse(cachedTrends));
        }
      } catch (e) {
        console.error("Redis GET failed for reports_trends:", e.message);
      }

      console.log("Fetching trends from database...");
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
      const trends = { daily, weekly: [] };

      try {
        await redisClient.setex(cacheKey, 300, JSON.stringify(trends)); // Cache for 5 minutes
      } catch (e) {
        console.error("Redis SETEX failed for reports_trends:", e.message);
      }
      res.json(trends);
    } catch (error) {
      res.status(500).json({ message: "Server error", error: error.message });
    }
  }
);

// SUMO config endpoints
app.get("/api/sumo/configs", authenticateToken, async (req, res) => {
  try {
    const cacheKey = "sumo_configs_list";
    try {
      const cachedConfigs = await redisClient.get(cacheKey);
      if (cachedConfigs) {
        console.log("Serving SUMO configs from Redis cache");
        return res.json(JSON.parse(cachedConfigs));
      }
    } catch (e) {
      console.error("Redis GET failed for sumo_configs_list:", e.message);
    }

    const fs = require("fs");
    const dir = DEFAULT_SUMO_CONFIG_DIR;
    const files = fs
      .readdirSync(dir, { withFileTypes: true })
      .filter((d) => d.isFile() && d.name.toLowerCase().endsWith(".sumocfg"))
      .map((d) => d.name)
      .sort();
    const s = await Settings.findOne();
    const selected = s?.sumo?.selectedConfig || null;
    const responseData = { directory: dir, files, selected };
    try {
      // Cache for 10 minutes, invalidated on change.
      await redisClient.setex(cacheKey, 600, JSON.stringify(responseData));
    } catch (e) {
      console.error("Redis SETEX failed for sumo_configs_list:", e.message);
    }
    res.json(responseData);
  } catch (e) {
    res
      .status(500)
      .json({ message: "Failed to list SUMO configs", error: e.message });
  }
});

app.put(
  "/api/sumo/config",
  authenticateToken,
  requireAnyRole(["super_admin"]),
  async (req, res) => {
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
        {
          $set: {
            "sumo.selectedConfig": name,
            "sumo.configDir": DEFAULT_SUMO_CONFIG_DIR,
            updatedAt: new Date(),
          },
        },
        { new: true, upsert: true }
      );
      await recordAudit(req, "set_sumo_config", name);
      // Invalidate the configs list cache since the 'selected' value has changed.
      try {
        await redisClient.del("sumo_configs_list");
        console.log("Cache invalidated for: sumo_configs_list");
      } catch (e) {
        console.error("Redis DEL failed for sumo_configs_list:", e.message);
      }
      res.json({ ok: true, selected: s?.sumo?.selectedConfig || name });
    } catch (e) {
      res
        .status(500)
        .json({ message: "Failed to set SUMO config", error: e.message });
    }
  }
);

// Helper to send a command to the running SUMO bridge (stdin JSON line)
function sendBridgeCommand(obj) {
  try {
    console.log('🚦 SENDING TLS COMMAND:', obj);
    
    if (!sumoBridgeProcess) {
      console.error('❌ BRIDGE PROCESS NOT RUNNING!');
      return false;
    }
    
    if (!sumoBridgeProcess.stdin) {
      console.error('❌ BRIDGE STDIN NOT AVAILABLE!');
      return false;
    }
    
    if (sumoBridgeProcess.killed) {
      console.error('❌ BRIDGE PROCESS WAS KILLED!');
      return false;
    }
    
    const line = JSON.stringify(obj) + "\n";
    console.log('📤 Writing command:', line.trim());
    
    // Force immediate write
    const writeResult = sumoBridgeProcess.stdin.write(line, "utf8");
    console.log('📝 Write result:', writeResult);
    
    // Force flush immediately
    if (typeof sumoBridgeProcess.stdin.flush === 'function') {
      sumoBridgeProcess.stdin.flush();
    }
    
    console.log('✅ TLS COMMAND SENT SUCCESSFULLY!');
    return true;
  } catch (e) {
    console.error('💥 FAILED TO SEND TLS COMMAND:', e.message);
    console.error('Stack:', e.stack);
    return false;
  }
}

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
        const cfgPathEffective = resolveSumoConfigPath(
          selectedConfigName || envCfg
        );

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
              if (
                cmd.includes(":") ||
                cmd.includes("/") ||
                cmd.includes("\\")
              ) {
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
          // Ensure Python writes UTF-8 to stdout/stderr to avoid Windows cp1252 issues
          env.PYTHONIOENCODING = env.PYTHONIOENCODING || "utf-8";
          if (process.env.SUMO_HOME) {
            const pathMod = require("path");
            env.PYTHONPATH = [
              env.PYTHONPATH || "",
              pathMod.join(process.env.SUMO_HOME, "tools"),
            ]
              .filter(Boolean)
              .join(pathMod.delimiter);
            // Ensure SUMO bin is on PATH so "sumo" resolves if used
            const sumoBin = pathMod.join(process.env.SUMO_HOME, "bin");
            env.PATH = [sumoBin, env.PATH || process.env.PATH || ""]
              .filter(Boolean)
              .join(pathMod.delimiter);
          }

          // Decide whether to launch with GUI
          let startWithGuiFlag = false;
          if (typeof parameters.startWithGui === "boolean") {
            startWithGuiFlag = parameters.startWithGui;
          } else {
            try {
              const s = await Settings.findOne();
              startWithGuiFlag = !!(s && s.sumo && s.sumo.startWithGui);
            } catch (_) {}
          }

          function fileExists(p) {
            try {
              return !!p && require("fs").existsSync(p);
            } catch {
              return false;
            }
          }
          function resolveSumoBinary(sel, wantGui) {
            const fs = require("fs");
            const path = require("path");
            const isAbs =
              sel &&
              (sel.includes(":") || sel.includes("/") || sel.includes("\\"));
            if (isAbs && fileExists(sel)) return sel;
            // Try SUMO_HOME/bin
            if (process.env.SUMO_HOME) {
              const bin = path.join(
                process.env.SUMO_HOME,
                "bin",
                process.platform === "win32"
                  ? wantGui
                    ? "sumo-gui.exe"
                    : "sumo.exe"
                  : wantGui
                  ? "sumo-gui"
                  : "sumo"
              );
              if (fileExists(bin)) return bin;
            }
            // Fallback to name on PATH
            return wantGui
              ? process.platform === "win32"
                ? "sumo-gui.exe"
                : "sumo-gui"
              : process.platform === "win32"
              ? "sumo.exe"
              : "sumo";
          }

          const selectedBinary = resolveSumoBinary(
            startWithGuiFlag
              ? process.env.SUMO_BINARY_GUI_PATH
              : process.env.SUMO_BINARY_PATH,
            !!startWithGuiFlag
          );

          const fsCheck = require("fs");
          if (!fsCheck.existsSync(cfgPathEffective)) {
            io.emit("simulationLog", {
              level: "error",
              message: `SUMO config not found: ${cfgPathEffective}`,
              ts: Date.now(),
            });
            status.isRunning = false;
            status.lastUpdated = new Date();
            await status.save();
            io.emit("simulationStatus", status);
            return res.status(400).json({ message: "SUMO config not found" });
          }
          if (
            !(
              selectedBinary &&
              (selectedBinary.includes(":") ||
                selectedBinary.includes("/") ||
                selectedBinary.includes("\\"))
            )
          ) {
            // If using name on PATH, that's fine. Otherwise verify absolute path exists (handled above in resolve)
          } else if (!fsCheck.existsSync(selectedBinary)) {
            io.emit("simulationLog", {
              level: "error",
              message: `SUMO binary not found: ${selectedBinary}`,
              ts: Date.now(),
            });
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

          // Optional RL control
          const wantRL =
            parameters &&
            (parameters.useRL === true ||
              typeof parameters.rlModelPath === "string");
          if (wantRL) {
            const pathMod = require("path");
            const fs = require("fs");
            let rlModelPath = parameters.rlModelPath || "";
            if (!rlModelPath) {
              // Try a default model location under frontend/public/Sumoconfigs/logs/best_model.zip
              const defaultModel = pathMod.join(
                ROOT_DIR,
                "frontend",
                "public",
                "Sumoconfigs",
                "logs",
                "best_model.zip"
              );
              if (fs.existsSync(defaultModel)) rlModelPath = defaultModel;
            } else if (!pathMod.isAbsolute(rlModelPath)) {
              rlModelPath = pathMod.join(ROOT_DIR, rlModelPath);
            }
            if (rlModelPath && fs.existsSync(rlModelPath)) {
              args.push("--rl-model", rlModelPath);
              args.push("--rl-delta", String(parameters.rlDelta || 15));
              if (startWithGuiFlag) args.push("--rl-use-gui");
              io.emit("simulationLog", {
                level: "info",
                message: `RL control enabled with model ${rlModelPath}`,
                ts: Date.now(),
              });
            } else {
              io.emit("simulationLog", {
                level: "warn",
                message: `RL model not found; running SUMO default logic`,
                ts: Date.now(),
              });
            }
          }

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
            io.emit("simulationLog", {
              level: "error",
              message: `Bridge spawn error: ${msg}`,
              ts: Date.now(),
            });
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
                      // Only apply bbox if GPS is present; keep items with only XY
                      payload.vehicles = payload.vehicles.filter((v) => {
                        if (
                          typeof v.lat === "number" &&
                          typeof v.lon === "number"
                        ) {
                          return within(v.lat, v.lon);
                        }
                        return true; // keep when only XY available
                      });
                    }
                    if (Array.isArray(payload.tls)) {
                      // Only apply bbox if GPS is present; always keep TLS without lat/lon so frontend can join by ID
                      payload.tls = payload.tls.filter((t) => {
                        if (
                          typeof t.lat === "number" &&
                          typeof t.lon === "number"
                        ) {
                          return within(t.lat, t.lon);
                        }
                        return true;
                      });
                    }
                  }
                }
                // Forward log messages from bridge
                if (payload.type === "log") {
                  io.emit("simulationLog", {
                    level: payload.level || "info",
                    message: String(payload.message || ""),
                    ts: Date.now(),
                  });
                }

                // Broadcast visualization and also lightweight stats
                if (payload.type === "viz") {
                  io.emit("viz", payload);

                  // Periodic console-like log (every 50 steps)
                  if (typeof payload.step === "number") {
                    status.currentStep = payload.step;
                    if (payload.step >= lastStepLog + 50) {
                      const vCount = Array.isArray(payload.vehicles)
                        ? payload.vehicles.length
                        : 0;
                      const tlsCount = Array.isArray(payload.tls)
                        ? payload.tls.length
                        : 0;
                      let avgSpeed = 0;
                      if (vCount > 0) {
                        let sum = 0;
                        for (const v of payload.vehicles) {
                          if (typeof v.speed === "number") sum += v.speed;
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
                }
              } catch (e) {
                // ignore malformed line
              }
            }
          });

          sumoBridgeProcess.stderr.on("data", (chunk) => {
            const msg = chunk.toString();
            console.error("[SUMO BRIDGE]", msg);
            io.emit("simulationLog", {
              level: "warn",
              message: msg.trim(),
              ts: Date.now(),
            });
          });

          sumoBridgeProcess.on("exit", (code) => {
            sumoBridgeProcess = null;
            status.isRunning = false;
            status.endTime = new Date();
            status.lastUpdated = new Date();
            status.save().then(() => io.emit("simulationStatus", status));
            io.emit("simulationLog", {
              level: code === 0 ? "info" : "error",
              message: `SUMO bridge exited with code ${code}`,
              ts: Date.now(),
            });
            console.log(`SUMO bridge exited with code ${code}`);
          });
        } catch (err) {
          console.error("Failed to start SUMO bridge:", err);
          io.emit("simulationLog", {
            level: "error",
            message: `Failed to start SUMO bridge: ${err?.message || err}`,
            ts: Date.now(),
          });
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



      default:
        res.status(400).json({ message: "Invalid command" });
    }
  } catch (error) {
    res
      .status(500)
      .json({ message: "SUMO command error", error: error.message });
  }
});


// Save scenario configuration
app.put("/api/sumo/scenario-config", authenticateToken, requireAnyRole(["super_admin", "operator"]), async (req, res) => {
  try {
    const { scenario, config } = req.body;
    
    if (!scenario || !config) {
      return res.status(400).json({ 
        status: "error",
        message: "Scenario and config are required" 
      });
    }
    
    // Validate scenario
    const validScenarios = ["default", "rush_hour", "night", "accident"];
    if (!validScenarios.includes(scenario)) {
      return res.status(400).json({ 
        status: "error",
        message: "Invalid scenario name" 
      });
    }
    
    // Store configuration in database or file system
    // For now, we'll store in a simple JSON file
    const fs = require('fs');
    const path = require('path');
    const configPath = path.join(__dirname, 'scenario-configs.json');
    
    let scenarioConfigs = {};
    try {
      if (fs.existsSync(configPath)) {
        scenarioConfigs = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      }
    } catch (e) {
      console.warn('Could not read existing scenario configs:', e.message);
    }
    
    // Update the scenario configuration
    scenarioConfigs[scenario] = {
      ...config,
      updatedBy: req.user.username,
      updatedAt: new Date().toISOString()
    };
    
    // Save back to file
    fs.writeFileSync(configPath, JSON.stringify(scenarioConfigs, null, 2));
    
    await recordAudit(req, "save_scenario_config", scenario, { config });
    
    console.log(`Scenario configuration saved: ${scenario} by ${req.user.username}`);
    
    res.json({
      status: "success",
      message: `Configuration saved for ${scenario} scenario`,
      data: scenarioConfigs[scenario]
    });
    
  } catch (error) {
    console.error('Error saving scenario configuration:', error);
    res.status(500).json({ 
      status: "error",
      message: "Failed to save configuration", 
      error: error.message 
    });
  }
});

// Get scenario configuration
app.get("/api/sumo/scenario-config/:scenario", authenticateToken, async (req, res) => {
  try {
    const { scenario } = req.params;
    
    const fs = require('fs');
    const path = require('path');
    const configPath = path.join(__dirname, 'scenario-configs.json');
    
    let scenarioConfigs = {};
    try {
      if (fs.existsSync(configPath)) {
        scenarioConfigs = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      }
    } catch (e) {
      console.warn('Could not read scenario configs:', e.message);
    }
    
    res.json({
      status: "success",
      data: scenarioConfigs[scenario] || null
    });
    
  } catch (error) {
    console.error('Error loading scenario configuration:', error);
    res.status(500).json({ 
      status: "error",
      message: "Failed to load configuration", 
      error: error.message 
    });
  }
});

// Get available TLS IDs and mapping
app.get("/api/tls/available", authenticateToken, async (req, res) => {
  try {
    const friendlyNames = Object.keys(tlsMapping.mappings || {});
    const allTlsIds = tlsMapping.allTlsIds || [];
    const mappings = tlsMapping.mappings || {};
    const reverseMapping = tlsMapping.reverseMapping || {};
    
    res.json({
      friendlyNames,
      allTlsIds,
      mappings,
      reverseMapping,
      totalCount: allTlsIds.length,
      friendlyCount: friendlyNames.length
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to get TLS data", error: error.message });
  }
});

// Debug: forward arbitrary JSON to SUMO bridge stdin (super_admin only)
app.post(
  "/api/bridge/send",
  authenticateToken,
  requireRole("super_admin"),
  async (req, res) => {
    try {
      if (!sumoBridgeProcess) return res.status(409).json({ message: "SUMO bridge is not running" });
      const obj = req.body || {};
      if (!obj || typeof obj !== 'object') return res.status(400).json({ message: 'JSON body required' });
      const ok = sendBridgeCommand(obj);
      if (!ok) return res.status(500).json({ message: 'Failed to send to bridge' });
      return res.json({ ok: true, sent: obj });
    } catch (e) {
      return res.status(500).json({ message: 'Error sending to bridge', error: e.message });
    }
  }
);

// EMERGENCY START SIMULATION - NO AUTH (REMOVE AFTER TESTING)
app.post("/api/sumo/emergency-start", async (req, res) => {
  try {
    console.log('🚑 EMERGENCY START SIMULATION!');
    
    let status = await SimulationStatus.findOne().sort({ lastUpdated: -1 });
    if (!status) {
      status = new SimulationStatus();
    }
    
    if (status.isRunning) {
      return res.json({ message: "Simulation already running", isRunning: true });
    }
    
    // Start simulation immediately
    const cfgPath = resolveSumoConfigPath("AddisAbabaSimple.sumocfg");
    
    status.isRunning = true;
    status.startTime = new Date();
    status.configPath = cfgPath;
    status.currentStep = 0;
    status.totalSteps = 10800;
    status.lastUpdated = new Date();
    await status.save();
    
    // Start SUMO bridge
    const pythonExe = "python";
    const bridgePath = require("path").join(__dirname, "sumo_bridge.py");
    const env = { ...process.env };
    env.PYTHONIOENCODING = "utf-8";
    
    const args = [
      bridgePath,
      "--sumo-bin", "sumo-gui",
      "--sumo-cfg", cfgPath,
      "--step-length", "1.0"
    ];
    
    console.log('🚀 EMERGENCY: Starting SUMO bridge:', args);
    sumoBridgeProcess = spawn(pythonExe, args, { env });
    
    if (sumoBridgeProcess.pid) {
      console.log('✅ EMERGENCY: SUMO bridge started with PID:', sumoBridgeProcess.pid);
      
      setTimeout(() => {
        res.json({ success: true, message: "EMERGENCY SIMULATION STARTED!", pid: sumoBridgeProcess.pid });
      }, 3000); // Wait 3 seconds for SUMO to initialize
    } else {
      res.status(500).json({ success: false, message: "Failed to start SUMO bridge" });
    }
    
  } catch (error) {
    console.error('💥 EMERGENCY START FAILED:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// EMERGENCY TLS TEST - NO AUTH (REMOVE AFTER TESTING)
app.post("/api/tls/emergency-test", async (req, res) => {
  try {
    console.log('🆘 EMERGENCY TLS TEST ENDPOINT HIT!');
    
    if (!sumoBridgeProcess) {
      return res.status(409).json({ message: "SUMO bridge is not running" });
    }
    
    // Test with atlas -> GrGr
    const tls_id = "atlas";
    const phase = "GrGr";
    
    const actualTlsId = resolveTlsId(tls_id);
    console.log(`🗺 EMERGENCY TEST: "${tls_id}" -> "${actualTlsId}"`);
    
    const cmd = { type: "tls_state", id: actualTlsId, phase: phase };
    
    console.log('🚑 EMERGENCY: Sending TLS command:', cmd);
    const ok = sendBridgeCommand(cmd);
    
    if (ok) {
      res.json({ success: true, tls_id, phase, actualTlsId, message: "EMERGENCY TEST SENT!" });
    } else {
      res.status(500).json({ success: false, message: "Failed to send emergency test" });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Direct TLS state control (super_admin, operator)
app.post(
  "/api/tls/set-state",
  authenticateToken,
  async (req, res) => {
    try {
      console.log('TLS state control request:', {
        tls_id: req.body?.tls_id,
        phase: req.body?.phase,
        userRole: req.user?.role
      });
      
      if (!["super_admin", "operator"].includes(req.user.role)) {
        console.log('TLS state control denied: insufficient permissions');
        return res.status(403).json({ message: "Insufficient permissions" });
      }
      
      if (!sumoBridgeProcess) {
        console.log('TLS state control failed: SUMO bridge not running');
        return res.status(409).json({ message: "SUMO bridge is not running" });
      }
      
      const { tls_id, phase } = req.body || {};
      
      if (!tls_id || !phase) {
        console.log('TLS state control failed: missing tls_id or phase');
        return res.status(400).json({ message: "tls_id and phase are required" });
      }
      
      // Resolve friendly name to actual SUMO TLS ID if needed
      const actualTlsId = resolveTlsId(tls_id);
      console.log(`TLS state mapping: "${tls_id}" -> "${actualTlsId}"`);
      
      const cmd = { type: "tls_state", id: actualTlsId, phase: phase };
      
      console.log('Sending TLS state command to bridge:', cmd);
      const ok = sendBridgeCommand(cmd);
      
      if (!ok) {
        console.log('TLS state control failed: could not send command to bridge');
        return res.status(500).json({ message: "Failed to send command to bridge" });
      }
      
      console.log('TLS state command sent successfully');
      await recordAudit(req, "tls_state_control", tls_id, { phase, actualTlsId });
      return res.json({ ok: true, tls_id, phase, actualTlsId });
    } catch (error) {
      console.error('TLS state control error:', error);
      return res.status(500).json({ message: "Server error", error: error.message });
    }
  }
);

// New TLS phase control with TLS ID in body (handles long IDs)
app.post(
  "/api/tls/phase-control",
  authenticateToken,
  async (req, res) => {
    try {
      console.log('TLS phase control request:', {
        tls_id: req.body?.tls_id,
        action: req.body?.action,
        phaseIndex: req.body?.phaseIndex,
        userRole: req.user?.role
      });
      
      if (!["super_admin", "operator"].includes(req.user.role)) {
        console.log('TLS control denied: insufficient permissions');
        return res.status(403).json({ message: "Insufficient permissions" });
      }
      
      if (!sumoBridgeProcess) {
        console.log('TLS control failed: SUMO bridge not running');
        return res.status(409).json({ message: "SUMO bridge is not running" });
      }
      
      const { tls_id, action, phaseIndex } = req.body || {};
      
      if (!tls_id || !action || !["next", "prev", "set"].includes(action)) {
        console.log('TLS control failed: invalid parameters');
        return res.status(400).json({ message: "Invalid parameters" });
      }
      
      // Resolve friendly name to actual SUMO TLS ID
      const actualTlsId = resolveTlsId(tls_id);
      console.log(`🗺 TLS mapping: "${tls_id}" -> "${actualTlsId}"`);
      
      const cmd = { type: "tls", id: actualTlsId, cmd: action };
      if (action === "set") {
        if (typeof phaseIndex !== "number") {
          console.log('TLS control failed: phaseIndex required for set action');
          return res.status(400).json({ message: "phaseIndex required for set" });
        }
        cmd.phaseIndex = phaseIndex;
      }
      
      console.log('🚦 Sending TLS command to bridge:', cmd);
      const ok = sendBridgeCommand(cmd);
      
      if (!ok) {
        console.log('TLS control failed: could not send command to bridge');
        return res.status(500).json({ message: "Failed to send command to bridge" });
      }
      
      console.log('✅ TLS command sent successfully');
      await recordAudit(req, "tls_phase_control", tls_id, { action, phaseIndex, actualTlsId });
      return res.json({ ok: true, tls_id, actualTlsId, action, phaseIndex });
    } catch (error) {
      console.error('💥 TLS phase control error:', error);
      return res.status(500).json({ message: "Server error", error: error.message });
    }
  }
);

// OLD TLS phase control (super_admin, operator) - DEPRECATED
app.post(
  "/api/tls/:id/phase",
  authenticateToken,
  async (req, res) => {
    try {
      console.log('TLS phase control request:', {
        tlsId: req.params.id,
        action: req.body?.action,
        phaseIndex: req.body?.phaseIndex,
        userRole: req.user?.role
      });
      
      if (!["super_admin", "operator"].includes(req.user.role)) {
        console.log('TLS control denied: insufficient permissions');
        return res.status(403).json({ message: "Insufficient permissions" });
      }
      
      if (!sumoBridgeProcess) {
        console.log('TLS control failed: SUMO bridge not running');
        return res.status(409).json({ message: "SUMO bridge is not running" });
      }
      
      const friendlyTlsId = req.params.id;
      const { action, phaseIndex } = req.body || {};
      
      if (!friendlyTlsId || !action || !["next", "prev", "set"].includes(action)) {
        console.log('TLS control failed: invalid parameters');
        return res.status(400).json({ message: "Invalid action" });
      }
      
      // Resolve friendly name to actual SUMO TLS ID
      const actualTlsId = resolveTlsId(friendlyTlsId);
      console.log(`TLS mapping: "${friendlyTlsId}" -> "${actualTlsId}"`);
      
      const cmd = { type: "tls", id: actualTlsId, cmd: action };
      if (action === "set") {
        if (typeof phaseIndex !== "number") {
          console.log('TLS control failed: phaseIndex required for set action');
          return res.status(400).json({ message: "phaseIndex required for set" });
        }
        cmd.phaseIndex = phaseIndex;
      }
      
      console.log('Sending TLS command to bridge:', cmd);
      const ok = sendBridgeCommand(cmd);
      
      if (!ok) {
        console.log('TLS control failed: could not send command to bridge');
        return res.status(500).json({ message: "Failed to send command to bridge" });
      }
      
      console.log('TLS command sent successfully');
      await recordAudit(req, "tls_phase_control", friendlyTlsId, { action, phaseIndex, actualTlsId });
      return res.json({ ok: true });
    } catch (error) {
      console.error('TLS phase control error:', error);
      return res.status(500).json({ message: "Server error", error: error.message });
    }
  }
);

// Intersection manual override (super_admin)
app.post(
  "/api/intersections/:id/override",
  authenticateToken,
  async (req, res) => {
    try {
      if (!["super_admin"].includes(req.user.role)) {
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
    const cacheKey = "active_emergencies";
    try {
      const cachedEmergencies = await redisClient.get(cacheKey);
      if (cachedEmergencies) {
        console.log("Serving active emergencies from Redis cache");
        return res.json(JSON.parse(cachedEmergencies));
      }
    } catch (e) {
      console.error("Redis GET failed for active_emergencies:", e.message);
    }

    console.log("Fetching active emergencies from database...");
    const items = await Emergency.find({ active: true }).sort({
      createdAt: -1,
    });
    try {
      await redisClient.setex(cacheKey, 10, JSON.stringify({ items })); // Cache for 10 seconds
    } catch (e) {
      console.error("Redis SETEX failed for active_emergencies:", e.message);
    }
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
      if (!["super_admin"].includes(req.user.role)) {
        return res.status(403).json({ message: "Insufficient permissions" });
      }
      const doc = await Emergency.findByIdAndUpdate(
        req.params.id,
        { active: false },
        { new: true }
      );

      // Invalidate cache on update
      try {
        await redisClient.del("active_emergencies");
        console.log("Cache invalidated for: active_emergencies");
      } catch (e) {
        console.error("Redis DEL failed for active_emergencies:", e.message);
      }
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

      // Invalidate cache on creation
      try {
        await redisClient.del("active_emergencies");
        console.log("Cache invalidated for: active_emergencies");
      } catch (e) {
        console.error("Redis DEL failed for active_emergencies:", e.message);
      }
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
  requireAnyRole(["super_admin"]),
  async (req, res) => {
    try {
      const cacheKey = "stats_overview";
      try {
        const cachedStats = await redisClient.get(cacheKey);
        if (cachedStats) {
          console.log("Serving overview stats from Redis cache");
          return res.json(JSON.parse(cachedStats));
        }
      } catch (e) {
        console.error("Redis GET failed for stats_overview:", e.message);
      }

      console.log("Fetching overview stats from database...");

      const results = await Promise.allSettled([
        User.countDocuments({}),
        Emergency.countDocuments({ active: true }),
        SimulationStatus.findOne().sort({ lastUpdated: -1 }),
        Promise.resolve(mongoose.connection.readyState),
        TrafficData.countDocuments({
          timestamp: { $gte: new Date(Date.now() - 15 * 60 * 1000) },
        }),
      ]);

      const [uRes, eRes, sRes, mRes, tRes] = results;
      const userCount =
        uRes.status === "fulfilled" ? Number(uRes.value || 0) : 0;
      const activeEmergencies =
        eRes.status === "fulfilled" ? Number(eRes.value || 0) : 0;
      const latestStatus = sRes.status === "fulfilled" ? sRes.value : null;
      const mongoState =
        mRes.status === "fulfilled"
          ? mRes.value
          : mongoose.connection.readyState;
      const recentTrafficDocs =
        tRes.status === "fulfilled" ? Number(tRes.value || 0) : 0;

      // Log any failures for debugging without failing the endpoint
      if (uRes.status === "rejected")
        console.warn(
          "[overview] userCount failed:",
          uRes.reason?.message || uRes.reason
        );
      if (eRes.status === "rejected")
        console.warn(
          "[overview] emergencies failed:",
          eRes.reason?.message || eRes.reason
        );
      if (sRes.status === "rejected")
        console.warn(
          "[overview] sim status failed:",
          sRes.reason?.message || sRes.reason
        );
      if (tRes.status === "rejected")
        console.warn(
          "[overview] telemetry count failed:",
          tRes.reason?.message || tRes.reason
        );

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

      const overview = {
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
      };

      // Cache for 15 seconds
      try {
        await redisClient.setex(cacheKey, 15, JSON.stringify(overview));
      } catch (e) {
        console.error("Redis SETEX failed for stats_overview:", e.message);
      }
      res.json(overview);
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
        health: {
          mongoHealthy,
          simHealthy: false,
          telemetryHealthy: false,
          mongoState,
          recentTrafficDocs: 0,
        },
      });
    }
  }
);

// Stats: admin operations
app.get(
  "/api/stats/admin",
  authenticateToken,
  requireAnyRole(["super_admin"]),
  async (req, res) => {
    try {
      const cacheKey = "stats_admin";
      try {
        const cachedStats = await redisClient.get(cacheKey);
        if (cachedStats) {
          console.log("Serving admin stats from Redis cache");
          return res.json(JSON.parse(cachedStats));
        }
      } catch (e) {
        console.error("Redis GET failed for stats_admin:", e.message);
      }

      console.log("Fetching admin stats from database...");

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

      const adminStats = {
        activeVehicles: isNaN(activeVehicles) ? 0 : activeVehicles,
        avgSpeed,
        queueLength,
        emergencyOverrides,
      };

      // Cache for 15 seconds
      try {
        await redisClient.setex(cacheKey, 15, JSON.stringify(adminStats));
      } catch (e) {
        console.error("Redis SETEX failed for stats_admin:", e.message);
      }
      res.json(adminStats);
    } catch (e) {
      res
        .status(500)
        .json({ message: "Failed to load admin stats", error: e.message });
    }
  }
);

// Basic Socket.IO connection handling (always enabled)
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
  
  // Real-time data streaming events
  socket.on('authenticate', (data) => {
    console.log('Client authenticated:', data.user?.username);
    socket.emit('authenticated', { success: true, user: data.user });
  });
  
  socket.on('subscribe', (data) => {
    console.log('Client subscribed to:', data.streams);
    socket.emit('subscribed', { streams: data.streams, message: 'Successfully subscribed' });
    
    // Join rooms for subscribed streams
    if (data.streams) {
      data.streams.forEach(stream => socket.join(stream));
    }
  });
  
  socket.on('unsubscribe', (data) => {
    console.log('Client unsubscribed from:', data.streams);
    if (data.streams) {
      data.streams.forEach(stream => socket.leave(stream));
    }
    socket.emit('unsubscribed', { streams: data.streams });
  });
  
  socket.on('ping', () => {
    socket.emit('pong', { timestamp: Date.now() });
  });
  
  // Send initial connection confirmation
  socket.emit('connected', {
    clientId: socket.id,
    serverTime: new Date().toISOString(),
    availableStreams: ['dashboard', 'traffic', 'sumo', 'system', 'alerts']
  });
});

// Start real-time data broadcasting
const startRealTimeDataBroadcasting = () => {
  // Broadcast dashboard data every 5 seconds
  setInterval(() => {
    io.to('dashboard').emit('dashboard', {
      totalVehicles: Math.floor(Math.random() * 100) + 50,
      averageSpeed: Math.floor(Math.random() * 30) + 20,
      activeIntersections: 20,
      simulationStatus: 'running',
      timestamp: new Date().toISOString()
    });
  }, 5000);
  
  // Broadcast traffic data every 3 seconds
  setInterval(() => {
    io.to('traffic').emit('trafficData', {
      overview: {
        totalVehicles: Math.floor(Math.random() * 100) + 50,
        averageSpeed: Math.floor(Math.random() * 30) + 20,
        activeIntersections: 20
      },
      stats: [],
      timestamp: new Date().toISOString()
    });
  }, 3000);
  
  // Broadcast SUMO status every 2 seconds
  setInterval(async () => {
    try {
      const status = await SimulationStatus.findOne().sort({ lastUpdated: -1 });
      io.to('sumo').emit('sumoStatus', {
        isRunning: status?.isRunning || false,
        processInfo: status || null,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      io.to('sumo').emit('sumoStatus', {
        isRunning: false,
        processInfo: null,
        timestamp: new Date().toISOString()
      });
    }
  }, 2000);
  
  console.log('✅ Real-time data broadcasting started');
};

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
    
    // Start real-time data broadcasting after server is ready
    console.log('Starting real-time data broadcasting...');
    startRealTimeDataBroadcasting();
  });
});
