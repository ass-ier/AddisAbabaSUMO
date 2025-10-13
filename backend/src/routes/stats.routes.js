const express = require('express');
const router = express.Router();
const statsController = require('../controllers/stats.controller');
const { authenticateToken, requireAnyRole } = require('../middleware/auth');

// GET /api/reports/kpis - Get KPIs (super_admin, analyst)
router.get('/reports/kpis', 
  authenticateToken, 
requireAnyRole(['super_admin', 'analyst', 'operator']),
  statsController.getKPIs.bind(statsController)
);

// GET /api/reports/trends - Get trends (super_admin, analyst)
router.get('/reports/trends', 
  authenticateToken, 
requireAnyRole(['super_admin', 'analyst', 'operator']),
  statsController.getTrends.bind(statsController)
);

// GET /api/stats/overview - Get system overview (super_admin, operator, analyst)
router.get('/stats/overview', 
  authenticateToken, 
  requireAnyRole(['super_admin', 'operator', 'analyst']), 
  statsController.getOverview.bind(statsController)
);

// GET /api/stats/admin - Get admin stats (super_admin only)
router.get('/stats/admin', 
  authenticateToken, 
  requireAnyRole(['super_admin']), 
  statsController.getAdminStats.bind(statsController)
);

module.exports = router;
