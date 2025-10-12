const express = require('express');
const router = express.Router();
const trafficController = require('../controllers/traffic.controller');
const { authenticateToken } = require('../middleware/auth');

// All routes require authentication
router.use(authenticateToken);

// POST /api/traffic-data - Create new traffic data entry
router.post('/', trafficController.createTrafficData.bind(trafficController));

// GET /api/traffic-data - Get traffic data with optional filters
router.get('/', trafficController.getTrafficData.bind(trafficController));

// GET /api/traffic-data/export.csv - Export traffic data to CSV
router.get('/export.csv', trafficController.exportTrafficDataCSV.bind(trafficController));

// GET /api/traffic-data/stats - Get traffic statistics
router.get('/stats', trafficController.getStatistics.bind(trafficController));

module.exports = router;
