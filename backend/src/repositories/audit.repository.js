const AuditLog = require('../models/AuditLog');

class AuditRepository {
  /**
   * Create new audit log
   */
  async create(data) {
    return await AuditLog.create(data);
  }

  /**
   * Find audit logs with filters
   */
  async find(query = {}, options = {}) {
    const {
      limit = 200,
      sort = { time: -1 }
    } = options;

    return await AuditLog.find(query)
      .sort(sort)
      .limit(parseInt(limit));
  }

  /**
   * Find audit logs by user
   */
  async findByUser(username, options = {}) {
    return await this.find({ user: username }, options);
  }

  /**
   * Find audit logs by role
   */
  async findByRole(role, options = {}) {
    return await this.find({ role }, options);
  }

  /**
   * Find audit logs by date range
   */
  async findByDateRange(startDate, endDate, options = {}) {
    const query = {
      time: {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      }
    };
    return await this.find(query, options);
  }

  /**
   * Count audit logs
   */
  async count(query = {}) {
    return await AuditLog.countDocuments(query);
  }
}

module.exports = new AuditRepository();
