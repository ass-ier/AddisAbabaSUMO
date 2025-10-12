const sumoLogsService = require('../services/sumo-logs.service');
const logger = require('../utils/logger');

class SumoLogsController {
  /**
   * Create a new SUMO log entry
   * POST /api/sumo/logs
   */
  async createLog(req, res) {
    try {
      const { message, type, action, details } = req.body;

      if (!message) {
        return res.status(400).json({
          status: 'error',
          message: 'Log message is required'
        });
      }

      // Get user context from authenticated user
      const userContext = {
        _id: req.user.id,
        username: req.user.username,
        role: req.user.role,
        fullName: req.user.fullName || req.user.name,
        sessionId: req.sessionID
      };

      const entry = await sumoLogsService.createLog({
        message,
        type: type || 'info',
        action,
        details
      }, userContext);

      res.status(201).json({
        status: 'success',
        data: {
          id: entry._id,
          message: entry.message,
          type: entry.type,
          timestamp: entry.timestamp,
          user: entry.username
        }
      });
    } catch (error) {
      logger.error('Error creating SUMO log', { error: error.message });
      res.status(500).json({
        status: 'error',
        message: 'Failed to create log entry',
        error: error.message
      });
    }
  }

  /**
   * Get SUMO logs for the current user (or all users if admin)
   * GET /api/sumo/logs
   */
  async getLogs(req, res) {
    try {
      const { type, category, limit } = req.query;

      const options = {
        type: type || null,
        category: category || null,
        limit: limit ? parseInt(limit) : 100
      };

      const result = await sumoLogsService.getLogs(options, req.user);

      res.json({
        status: 'success',
        data: result
      });
    } catch (error) {
      logger.error('Error retrieving SUMO logs', { error: error.message });
      res.status(500).json({
        status: 'error',
        message: 'Failed to retrieve logs',
        error: error.message
      });
    }
  }

  /**
   * Clear SUMO logs for the current user (or all users if admin)
   * DELETE /api/sumo/logs
   */
  async clearLogs(req, res) {
    try {
      const result = await sumoLogsService.clearLogs(req.user);

      res.json({
        status: 'success',
        message: `Cleared ${result.deletedCount} log entries`,
        data: result
      });
    } catch (error) {
      logger.error('Error clearing SUMO logs', { error: error.message });
      res.status(500).json({
        status: 'error',
        message: 'Failed to clear logs',
        error: error.message
      });
    }
  }

  /**
   * Get SUMO log statistics
   * GET /api/sumo/logs/stats
   */
  async getLogStats(req, res) {
    try {
      const stats = await sumoLogsService.getLogStats(req.user);

      res.json({
        status: 'success',
        data: stats
      });
    } catch (error) {
      logger.error('Error retrieving SUMO log stats', { error: error.message });
      res.status(500).json({
        status: 'error',
        message: 'Failed to retrieve log statistics',
        error: error.message
      });
    }
  }

  /**
   * Bulk create SUMO log entries (for migration or batch operations)
   * POST /api/sumo/logs/bulk
   */
  async bulkCreateLogs(req, res) {
    try {
      const { logs } = req.body;

      if (!logs || !Array.isArray(logs)) {
        return res.status(400).json({
          status: 'error',
          message: 'Logs array is required'
        });
      }

      // Get user context from authenticated user
      const userContext = {
        _id: req.user.id,
        username: req.user.username,
        role: req.user.role,
        fullName: req.user.fullName || req.user.name,
        sessionId: req.sessionID
      };

      const result = await sumoLogsService.bulkCreateLogs(logs, userContext);

      res.status(201).json({
        status: 'success',
        message: `Created ${result.length} log entries`,
        data: {
          createdCount: result.length,
          createdBy: req.user.username
        }
      });
    } catch (error) {
      logger.error('Error bulk creating SUMO logs', { error: error.message });
      res.status(500).json({
        status: 'error',
        message: 'Failed to bulk create logs',
        error: error.message
      });
    }
  }
}

module.exports = new SumoLogsController();