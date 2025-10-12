const auditRepository = require('../repositories/audit.repository');
const cacheService = require('./cache.service');
const logger = require('../utils/logger');

class AuditService {
  /**
   * Record audit log
   */
  async record(user, action, target, meta = {}) {
    try {
      await auditRepository.create({
        user: user?.username || 'anonymous',
        role: user?.role || '',
        action,
        target,
        meta
      });
    } catch (error) {
      logger.error('Audit record failed', { error: error.message });
    }
  }

  /**
   * Get audit logs with caching
   */
  async getAuditLogs(filters = {}) {
    try {
      const { user, role, startDate, endDate, limit = 200 } = filters;
      
      // Generate cache key
      const cacheKey = `audit_logs:${user || ''}:${role || ''}:${startDate || ''}:${endDate || ''}:${limit}`;
      
      // Try to get from cache
      const cached = await cacheService.get(cacheKey);
      if (cached) {
        logger.info('Serving audit logs from cache');
        return cached;
      }

      // Build query
      const query = {};
      if (user) query.user = user;
      if (role) query.role = role;
      if (startDate || endDate) {
        query.time = {};
        if (startDate) query.time.$gte = new Date(startDate);
        if (endDate) query.time.$lte = new Date(endDate);
      }

      const items = await auditRepository.find(query, { limit, sort: { time: -1 } });
      const result = { items };
      
      // Cache for 30 seconds
      await cacheService.set(cacheKey, result, 30);
      
      logger.info('Audit logs fetched from database', { count: items.length });
      return result;
    } catch (error) {
      logger.error('Error getting audit logs', { error: error.message });
      throw error;
    }
  }

  /**
   * Export audit logs to CSV
   */
  async exportToCSV(filters = {}) {
    try {
      const { user, role, startDate, endDate, limit = 1000 } = filters;
      
      const query = {};
      if (user) query.user = user;
      if (role) query.role = role;
      if (startDate || endDate) {
        query.time = {};
        if (startDate) query.time.$gte = new Date(startDate);
        if (endDate) query.time.$lte = new Date(endDate);
      }

      const items = await auditRepository.find(query, { limit, sort: { time: -1 } });

      // Generate CSV
      const headers = ['time', 'user', 'role', 'action', 'target'];
      const rows = items.map(l => [
        l.time ? new Date(l.time).toISOString() : '',
        l.user || '',
        l.role || '',
        l.action || '',
        l.target || ''
      ]);

      const csv = [
        headers.join(','),
        ...rows.map(r => r.join(','))
      ].join('\n');

      logger.info('Audit logs exported to CSV', { records: items.length });
      return csv;
    } catch (error) {
      logger.error('Error exporting audit logs to CSV', { error: error.message });
      throw error;
    }
  }
}

module.exports = new AuditService();
