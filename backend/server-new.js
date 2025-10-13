const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const http = require('http');
const Redis = require('ioredis');
const socketIo = require('socket.io');
const cookieParser = require('cookie-parser');
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: './config.env' });

// Import new three-tier architecture modules
const logger = require('./src/utils/logger');
const { errorHandler, notFound } = require('./src/middleware/errorHandler');
const cacheService = require('./src/services/cache.service');
const sumoSubprocess = require('./src/services/sumo-subprocess.service');
const createRoutes = require('./src/routes');

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 5001;

// ===== SUMO Configuration Paths =====
const ROOT_DIR = path.join(__dirname, '..');
const DEFAULT_SUMO_CONFIG_DIR = path.join(
  ROOT_DIR,
  'Sumoconfigs'
);

// Helper function to resolve SUMO config path
function resolveSumoConfigPath(nameOrPath) {
  if (!nameOrPath)
    return path.join(DEFAULT_SUMO_CONFIG_DIR, 'AddisAbabaSimple.sumocfg');
  // If absolute or contains drive letter on Windows, return as-is
  if (path.isAbsolute(nameOrPath)) return nameOrPath;
  return path.join(DEFAULT_SUMO_CONFIG_DIR, nameOrPath);
}

// ===== TLS Mapping =====
let tlsMapping = {};
function loadTlsMapping() {
  try {
    const tlsMappingPath = path.join(__dirname, 'tls-mapping.json');
    if (fs.existsSync(tlsMappingPath)) {
      const data = fs.readFileSync(tlsMappingPath, 'utf8');
      tlsMapping = JSON.parse(data);
      logger.info(`TLS mapping loaded with ${Object.keys(tlsMapping.mappings || {}).length} friendly names`);
    } else {
      logger.warn('TLS mapping file not found:', tlsMappingPath);
      tlsMapping = { mappings: {}, allTlsIds: [], reverseMapping: {} };
    }
  } catch (error) {
    logger.error('Failed to load TLS mapping:', error.message);
    tlsMapping = { mappings: {}, allTlsIds: [], reverseMapping: {} };
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

// ===== Map Settings (In-Memory State) =====
// bbox: { minLat, minLon, maxLat, maxLon } for Addis Ababa by default
const mapSettings = {
  mode: 'simulation', // or 'real'
  bbox: {
    minLat: 8.85,
    minLon: 38.6,
    maxLat: 9.15,
    maxLon: 38.9,
  },
};

// ===== SUMO Bridge Process Reference =====
// This object wraps the subprocess reference so it can be shared
const sumoBridgeProcessRef = {
  process: null
};

// Socket.IO for real-time data
const io = socketIo(server, {
  cors: {
    origin: ['http://localhost:3000', 'http://127.0.0.1:3000'],
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization'],
  },
  transports: ['websocket', 'polling'],
  pingTimeout: 60000,
  pingInterval: 25000,
});

// ===== Middleware =====
app.use(cors({
  origin: ['http://localhost:3000', 'http://127.0.0.1:3000'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
  credentials: true,
  optionsSuccessStatus: 200
}));
app.use(express.json());
app.use(cookieParser());

// ===== Redis Connection =====
const redisClient = new Redis({
  port: process.env.REDIS_PORT || 6379,
  host: process.env.REDIS_HOST || '127.0.0.1',
  password: process.env.REDIS_PASSWORD || undefined,
  lazyConnect: true,
  retryStrategy: (times) => {
    if (times > 3) {
      logger.warn('Redis connection failed after 3 retries, using memory cache');
      return null; // Stop retrying
    }
    return Math.min(times * 100, 3000);
  }
});

redisClient.on('connect', () => {
  logger.info('Connected to Redis');
});

redisClient.on('error', (err) => {
  logger.error('Redis Client Error:', err.message);
});

// Initialize cache service with Redis
cacheService.init(redisClient);

// ===== MongoDB Connection =====
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/traffic_management';

mongoose.connect(MONGODB_URI, {})
  .then(() => {
    logger.info('Connected to MongoDB');
  })
  .catch((error) => {
    logger.error('MongoDB connection error:', error);
    process.exit(1);
  });

// ===== Routes =====
// Health check (before API routes)
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    redis: redisClient.status === 'ready' ? 'connected' : 'disconnected',
    cache: cacheService.getStats()
  });
});

// API routes (three-tier architecture with SUMO/TLS integration)
const routes = createRoutes({
  sumoBridgeProcessRef,
  io,
  tlsMapping,
  resolveTlsId,
  resolveSumoConfigPath,
  DEFAULT_SUMO_CONFIG_DIR,
  ROOT_DIR,
  mapSettings
});
app.use('/api', routes);

// Initialize SUMO subprocess service with the shared reference
sumoSubprocess.init(sumoBridgeProcessRef, io);

// ===== Error Handling =====
app.use(notFound);
app.use(errorHandler);

// ===== Real-Time WebSocket Handling =====
io.on('connection', (socket) => {
  logger.info(`Client connected: ${socket.id}`);

  socket.on('disconnect', () => {
    logger.info(`Client disconnected: ${socket.id}`);
  });

  // Authentication
  socket.on('authenticate', (data) => {
    logger.info(`Client authenticated: ${data.user?.username}`);
    socket.emit('authenticated', { success: true, user: data.user });
  });

  // Subscription management
  socket.on('subscribe', (data) => {
    logger.info(`Client subscribed to: ${data.streams}`);
    socket.emit('subscribed', { streams: data.streams, message: 'Successfully subscribed' });
    
    if (data.streams) {
      data.streams.forEach(stream => socket.join(stream));
    }
  });

  socket.on('unsubscribe', (data) => {
    logger.info(`Client unsubscribed from: ${data.streams}`);
    if (data.streams) {
      data.streams.forEach(stream => socket.leave(stream));
    }
    socket.emit('unsubscribed', { streams: data.streams });
  });

  socket.on('ping', () => {
    socket.emit('pong', { timestamp: Date.now() });
  });

  // Send connection confirmation
  socket.emit('connected', {
    clientId: socket.id,
    serverTime: new Date().toISOString(),
    availableStreams: ['dashboard', 'traffic', 'sumo', 'system', 'alerts']
  });
});

// Real-time data broadcasting
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
      const SimulationStatus = mongoose.model('SimulationStatus');
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

  logger.info('✅ Real-time data broadcasting started');
};

// ===== Start Server =====
server.listen(PORT, () => {
  logger.info(`🚀 Three-Tier Architecture Server running on port ${PORT}`);
  logger.info(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
  logger.info(`🔗 API Base URL: http://localhost:${PORT}/api`);
  logger.info(`💚 Health Check: http://localhost:${PORT}/health`);
  logger.info(`📖 API Info: http://localhost:${PORT}/api`);
  logger.info('🔌 WebSocket: Real-time data streaming enabled');
  
  // Start real-time broadcasting
  startRealTimeDataBroadcasting();
});

// ===== Graceful Shutdown =====
process.on('SIGTERM', async () => {
  logger.info('SIGTERM signal received: closing HTTP server');
  server.close(async () => {
    logger.info('HTTP server closed');
    await mongoose.connection.close();
    await redisClient.quit();
    logger.info('Database connections closed');
    process.exit(0);
  });
});

process.on('unhandledRejection', (err) => {
  logger.error('Unhandled Rejection:', err);
  process.exit(1);
});

module.exports = app;
