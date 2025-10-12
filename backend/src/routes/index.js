const express = require('express');

/**
 * API Route Aggregator
 * Centralizes all API routes with proper prefixes
 * 
 * All routes are prefixed with /api (configured in server-new.js)
 * 
 * Exports a function that accepts dependencies for SUMO/TLS routes
 */

// Import route modules
const authRoutes = require('./auth.routes');
const userRoutes = require('./user.routes');
const trafficRoutes = require('./traffic.routes');
const settingsRoutes = require('./settings.routes');
const emergencyRoutes = require('./emergency.routes');
const auditRoutes = require('./audit.routes');
const statsRoutes = require('./stats.routes');
const operatorRoutes = require('./operator.routes');
const createSumoTlsRoutes = require('./sumo-tls.routes'); // SUMO/TLS routes with subprocess management

module.exports = function createRoutes(dependencies = {}) {
  const router = express.Router();

// ===== BACKWARD COMPATIBILITY ROUTES =====
// Frontend uses /api/login and /api/logout (not /api/auth/login)
const authController = require('../controllers/auth.controller');
const { authenticateToken } = require('../middleware/auth');
const { validate, schemas } = require('../middleware/validation');

router.post('/login', validate(schemas.login), authController.login);
router.post('/logout', authenticateToken, authController.logout);
router.post('/register', validate(schemas.register), authController.register);

// Mount routes
router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/traffic-data', trafficRoutes);
router.use('/settings', settingsRoutes);
router.use('/emergencies', emergencyRoutes);
router.use('/audit', auditRoutes);
router.use('/operator', operatorRoutes); // Operator-specific routes for system monitoring and control
router.use('/', statsRoutes); // Stats routes include /reports/* and /stats/*

// Mount SUMO/TLS routes if dependencies are provided
if (dependencies.sumoBridgeProcessRef) {
  const sumoTlsRoutes = createSumoTlsRoutes(dependencies);
  router.use('/', sumoTlsRoutes); // Mounts /api/sumo/*, /api/tls/*, /api/map/settings
}

// Health check endpoint
router.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// API info endpoint
router.get('/', (req, res) => {
  const hasSumoTls = !!dependencies.sumoBridgeProcessRef;
  res.json({
    name: 'AddisAbaba SUMO Traffic Management API',
    version: '2.0.0',
    description: 'Three-tier architecture API for traffic management system',
    status: hasSumoTls ? 'Fully Migrated ✅' : 'Hybrid Architecture - Partially Migrated',
    endpoints: {
      auth: '/api/auth (✅ Login, Register, Logout, Validate)',
      users: '/api/users (✅ CRUD, Count)',
      trafficData: '/api/traffic-data (✅ Create, Read, Export, Stats)',
      settings: '/api/settings (✅ Get, Update)',
      emergencies: '/api/emergencies (✅ List, Create, Clear)',
      audit: '/api/audit (✅ List, Export CSV)',
      reports: '/api/reports/kpis & /api/reports/trends (✅)',
      stats: '/api/stats/overview & /api/stats/admin (✅)',
      operator: '/api/operator/* (✅ System monitoring, analytics, reports, alerts)',
      health: '/api/health',
      sumo: hasSumoTls ? '/api/sumo/* (✅ SUMO simulation control)' : '❌ Not mounted',
      tls: hasSumoTls ? '/api/tls/* (✅ Traffic light control)' : '❌ Not mounted',
      mapSettings: hasSumoTls ? '/api/map/settings (✅)' : '❌ Not mounted'
    },
    architecture: 'Three-tier architecture with integrated SUMO/TLS control'
  });
});

  return router;
};
