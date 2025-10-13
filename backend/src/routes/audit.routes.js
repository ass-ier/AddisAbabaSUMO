const express = require('express');
const router = express.Router();
const auditController = require('../controllers/audit.controller');
const { authenticateToken, requireRole, requireAnyRole } = require('../middleware/auth');

// GET /api/audit - Get audit logs (super_admin, operator, analyst)
router.get('/', 
  authenticateToken, 
  requireAnyRole(['super_admin', 'operator', 'analyst']), 
  auditController.getAuditLogs.bind(auditController)
);

// GET /api/audit/export.csv - Export audit logs to CSV (super_admin only)
router.get('/export.csv', 
  authenticateToken, 
  requireRole('super_admin'), 
  auditController.exportAuditLogsCSV.bind(auditController)
);

module.exports = router;
