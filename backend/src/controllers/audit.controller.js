const auditService = require('../services/audit.service');
const logger = require('../utils/logger');

class AuditController {
  /**
   * Get audit logs
   * GET /api/audit
   */
  async getAuditLogs(req, res) {
    try {
      const { user, role, startDate, endDate, limit } = req.query;

      const result = await auditService.getAuditLogs({
        user,
        role,
        startDate,
        endDate,
        limit: limit ? parseInt(limit) : 200
      });

      res.json(result);
    } catch (error) {
      logger.error('Error in getAuditLogs', { error: error.message });
      res.status(500).json({
        message: 'Server error',
        error: error.message
      });
    }
  }

  /**
   * Export audit logs to CSV
   * GET /api/audit/export.csv
   */
  async exportAuditLogsCSV(req, res) {
    try {
      const { user, role, startDate, endDate, limit } = req.query;

      const csv = await auditService.exportToCSV({
        user,
        role,
        startDate,
        endDate,
        limit: limit ? parseInt(limit) : 1000
      });

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename=audits.csv');
      res.send(csv);
    } catch (error) {
      logger.error('Error in exportAuditLogsCSV', { error: error.message });
      res.status(500).json({
        message: 'Server error',
        error: error.message
      });
    }
  }
}

module.exports = new AuditController();
