const express = require('express');
const router = express.Router();
const auditController = require('../controllers/audit.controller');
const { authenticateToken, requireRole } = require('../middleware/auth');

// GET /api/audit - Get audit logs (super_admin only)
router.get('/', 
  authenticateToken, 
  requireRole('super_admin'), 
  auditController.getAuditLogs.bind(auditController)
);

// GET /api/audit/export.csv - Export audit logs to CSV (super_admin only)
router.get('/export.csv', 
  authenticateToken, 
  requireRole('super_admin'), 
  auditController.exportAuditLogsCSV.bind(auditController)
);

module.exports = router;
