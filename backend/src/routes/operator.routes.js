const express = require('express');
const operatorController = require('../controllers/operator.controller');
const userManagementController = require('../controllers/user-management.controller');
const auth = require('../middleware/auth');
const validation = require('../middleware/validation');
const { body, param, query } = require('express-validator');

const router = express.Router();

// Apply authentication and operator role check to all routes
router.use(auth.authenticate);
router.use(auth.requireOperatorRole); // New middleware for operator-only access

/**
 * Dashboard and Overview Routes
 */

// Get comprehensive operator dashboard
router.get('/dashboard', operatorController.getDashboard);

// Get traffic overview for operators
router.get('/traffic/overview', operatorController.getTrafficOverview);

// Get activity summary
router.get('/activity/summary', [
  query('period').optional().isIn(['1h', '24h', '7d', '30d']),
  validation.handleValidationErrors
], operatorController.getActivitySummary);

/**
 * System Health and Monitoring Routes
 */

// Get system health summary
router.get('/system/health', operatorController.getSystemHealth);

// Get detailed system metrics
router.get('/system/metrics', [
  query('period').optional().isInt({ min: 1, max: 168 }), // 1 hour to 1 week
  validation.handleValidationErrors
], operatorController.getSystemMetrics);

// Export system metrics to CSV
router.get('/system/metrics/export', [
  query('startDate').optional().isISO8601(),
  query('endDate').optional().isISO8601(),
  validation.handleValidationErrors
], operatorController.exportSystemMetrics);

// Get system configuration
router.get('/system/config', operatorController.getSystemConfig);

// Start/stop system monitoring
router.post('/system/monitoring/:action', [
  param('action').isIn(['start', 'stop']),
  body('interval').optional().isInt({ min: 5000, max: 300000 }), // 5 seconds to 5 minutes
  validation.handleValidationErrors
], operatorController.controlSystemMonitoring);

/**
 * Performance and Statistics Routes
 */

// Get performance statistics
router.get('/performance/stats', [
  query('period').optional().isInt({ min: 1, max: 168 }), // 1 hour to 1 week
  validation.handleValidationErrors
], operatorController.getPerformanceStats);

/**
 * Traffic Analytics Routes
 */

// Get comprehensive traffic analytics
router.get('/traffic/analytics', [
  query('timeRange').optional().isIn(['1h', '24h', '7d', '30d']),
  validation.handleValidationErrors
], operatorController.getTrafficAnalytics);

// Get intersection-specific analysis
router.get('/traffic/intersection/:intersectionId', [
  param('intersectionId').notEmpty().isString(),
  query('timeRange').optional().isIn(['1h', '24h', '7d', '30d']),
  validation.handleValidationErrors
], operatorController.getIntersectionAnalysis);

/**
 * Alerts and Notifications Routes
 */

// Get alerts with filtering options
router.get('/alerts', [
  query('severity').optional().isIn(['critical', 'warning', 'info']),
  query('source').optional().isIn(['system', 'traffic', 'sumo']),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  validation.handleValidationErrors
], operatorController.getAlerts);

/**
 * Reports and Analytics Routes
 */

// Generate operator reports
router.post('/reports/generate', [
  body('type').isIn(['daily', 'performance', 'system']),
  body('options').optional().isObject(),
  validation.handleValidationErrors
], operatorController.generateReport);

/**
 * Advanced Operations Routes
 */

// Execute operator commands
router.post('/commands/execute', [
  body('command').isIn(['refresh_metrics', 'clear_cache', 'generate_diagnostics']),
  body('parameters').optional().isObject(),
  validation.handleValidationErrors
], operatorController.executeCommand);

/**
 * User Management Routes (Operator Level)
 */

// Get user statistics
router.get('/users/statistics', userManagementController.getUserStatistics);

// Get session information
router.get('/users/session', userManagementController.getSession);

// Get system operators
router.get('/users/operators', [
  query('includeInactive').optional().isBoolean(),
  validation.handleValidationErrors
], userManagementController.getOperators);

// Get admin users
router.get('/users/admins', [
  query('includeInactive').optional().isBoolean(),
  validation.handleValidationErrors
], userManagementController.getAdmins);

// Get privileged users
router.get('/users/privileged', [
  query('includeInactive').optional().isBoolean(),
  validation.handleValidationErrors
], userManagementController.getPrivilegedUsers);

// Update user role
router.put('/users/:userId/role', [
  param('userId').isMongoId(),
  body('role').isIn(['user', 'system_operator', 'admin']),
  validation.handleValidationErrors
], userManagementController.updateUserRole);

// Deactivate user
router.put('/users/:userId/deactivate', [
  param('userId').isMongoId(),
  validation.handleValidationErrors
], userManagementController.deactivateUser);

// Activate user
router.put('/users/:userId/activate', [
  param('userId').isMongoId(),
  validation.handleValidationErrors
], userManagementController.activateUser);

// Get user audit trail
router.get('/users/:userId/audit', [
  param('userId').isMongoId(),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('skip').optional().isInt({ min: 0 }),
  validation.handleValidationErrors
], userManagementController.getUserAuditTrail);

// Create operator account (super admin only)
router.post('/users/create-operator', [
  body('username').isString().isLength({ min: 3, max: 50 }),
  body('password').isString().isLength({ min: 6, max: 100 }),
  body('region').optional().isString().isLength({ min: 1, max: 100 }),
  validation.handleValidationErrors
], userManagementController.createOperator);

/**
 * Real-time Data Routes (WebSocket endpoints would be handled separately)
 */

// These routes provide REST API access to real-time data
// WebSocket connections for live updates would be handled in the main server file

module.exports = router;
