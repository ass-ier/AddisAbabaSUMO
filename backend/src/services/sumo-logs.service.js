const SumoLog = require('../models/SumoLog');
const logger = require('../utils/logger');

class SumoLogsService {
  /**
   * Create a new SUMO log entry
   */
  async createLog(logData, userContext = {}) {
    try {
      const entry = await SumoLog.createEntry({
        message: logData.message,
        type: logData.type || 'info',
        action: logData.action,
        category: this._categorizeAction(logData.action, logData.message),
        details: logData.details || {}
      }, userContext);

      logger.debug('SUMO log entry created', { 
        id: entry._id, 
        user: userContext.username,
        type: logData.type 
      });

      return entry;
    } catch (error) {
      logger.error('Failed to create SUMO log entry', { error: error.message });
      throw error;
    }
  }

  /**
   * Get logs for the current user or all users (admin only)
   */
  async getLogs(options = {}, requestingUser = {}) {
    try {
      const {
        type = null,
        category = null,
        limit = 100,
        since = new Date(Date.now() - 24 * 60 * 60 * 1000) // 24 hours ago
      } = options;

      // Determine if user can see all logs or just their own
      const canViewAllLogs = ['super_admin', 'admin', 'system_operator'].includes(requestingUser.role);
      const username = canViewAllLogs ? null : requestingUser.username;

      const logs = await SumoLog.getRecentLogs({
        username,
        type,
        category,
        limit,
        since
      });

      // Add user-friendly timestamps and formatting
      const formattedLogs = logs.map(log => ({
        ...log,
        id: log._id.toString(),
        timestamp: log.timestamp.toISOString(),
        timeAgo: this._getTimeAgo(log.timestamp),
        userDisplay: log.userFullName || log.username,
        isImportant: this._isImportantLog(log)
      }));

      logger.debug('SUMO logs retrieved', { 
        count: formattedLogs.length, 
        requestedBy: requestingUser.username,
        canViewAll: canViewAllLogs
      });

      return {
        logs: formattedLogs,
        total: formattedLogs.length,
        canViewAllLogs,
        retentionHours: 24
      };
    } catch (error) {
      logger.error('Failed to retrieve SUMO logs', { error: error.message });
      throw error;
    }
  }

  /**
   * Clear all logs for the current user (or all if admin)
   */
  async clearLogs(requestingUser = {}) {
    try {
      const canClearAllLogs = ['super_admin', 'admin'].includes(requestingUser.role);
      
      let query = {};
      if (!canClearAllLogs) {
        query.username = requestingUser.username;
      }

      const result = await SumoLog.deleteMany(query);

      logger.info('SUMO logs cleared', { 
        deletedCount: result.deletedCount,
        clearedBy: requestingUser.username,
        allLogs: canClearAllLogs
      });

      return {
        deletedCount: result.deletedCount,
        clearedBy: requestingUser.username,
        scope: canClearAllLogs ? 'all' : 'user'
      };
    } catch (error) {
      logger.error('Failed to clear SUMO logs', { error: error.message });
      throw error;
    }
  }

  /**
   * Get log statistics
   */
  async getLogStats(requestingUser = {}) {
    try {
      const canViewAllLogs = ['super_admin', 'admin', 'system_operator'].includes(requestingUser.role);
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

      let matchQuery = { timestamp: { $gte: since } };
      if (!canViewAllLogs) {
        matchQuery.username = requestingUser.username;
      }

      const stats = await SumoLog.aggregate([
        { $match: matchQuery },
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            info: { $sum: { $cond: [{ $eq: ['$type', 'info'] }, 1, 0] } },
            success: { $sum: { $cond: [{ $eq: ['$type', 'success'] }, 1, 0] } },
            warning: { $sum: { $cond: [{ $eq: ['$type', 'warning'] }, 1, 0] } },
            error: { $sum: { $cond: [{ $eq: ['$type', 'error'] }, 1, 0] } },
            byCategory: { $push: '$category' },
            byUser: { $push: '$username' },
            latestTimestamp: { $max: '$timestamp' }
          }
        }
      ]);

      const result = stats[0] || {
        total: 0, info: 0, success: 0, warning: 0, error: 0,
        byCategory: [], byUser: [], latestTimestamp: null
      };

      // Count unique categories and users
      result.uniqueCategories = [...new Set(result.byCategory)].length;
      result.uniqueUsers = [...new Set(result.byUser)].length;

      return {
        ...result,
        retentionHours: 24,
        scope: canViewAllLogs ? 'all' : 'user'
      };
    } catch (error) {
      logger.error('Failed to get SUMO log stats', { error: error.message });
      throw error;
    }
  }

  /**
   * Categorize action based on message content
   * @private
   */
  _categorizeAction(action, message) {
    if (!action && !message) return 'other';
    
    const text = (action + ' ' + message).toLowerCase();
    
    if (text.includes('simulation') || text.includes('start') || text.includes('stop')) {
      return 'simulation_control';
    }
    if (text.includes('config') || text.includes('setting') || text.includes('parameter')) {
      return 'configuration';
    }
    if (text.includes('scenario') || text.includes('changed to')) {
      return 'scenario_change';
    }
    if (text.includes('status') || text.includes('connected') || text.includes('disconnected')) {
      return 'system_status';
    }
    if (text.includes('connection') || text.includes('test') || text.includes('diagnostic')) {
      return 'connection';
    }
    
    return 'other';
  }

  /**
   * Calculate time ago string
   * @private
   */
  _getTimeAgo(timestamp) {
    const now = new Date();
    const diff = now - new Date(timestamp);
    
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return `${seconds}s ago`;
  }

  /**
   * Determine if log is important
   * @private
   */
  _isImportantLog(log) {
    return log.type === 'error' || 
           (log.type === 'warning' && log.category === 'simulation_control') ||
           (log.category === 'system_status' && log.type !== 'info');
  }

  /**
   * Bulk create multiple log entries (for migration or batch operations)
   */
  async bulkCreateLogs(logEntries, userContext = {}) {
    try {
      const entries = logEntries.map(log => ({
        timestamp: log.timestamp || new Date(),
        message: log.message,
        type: log.type || 'info',
        action: log.action,
        category: this._categorizeAction(log.action, log.message),
        details: log.details || {},
        userId: userContext._id,
        username: userContext.username || 'anonymous',
        userRole: userContext.role || 'user',
        userFullName: userContext.fullName || userContext.name,
        sessionId: userContext.sessionId
      }));

      const result = await SumoLog.insertMany(entries);
      
      logger.info('Bulk SUMO logs created', { 
        count: result.length,
        user: userContext.username
      });

      return result;
    } catch (error) {
      logger.error('Failed to bulk create SUMO logs', { error: error.message });
      throw error;
    }
  }
}

module.exports = new SumoLogsService();