const TrafficData = require('../models/TrafficData');

class TrafficRepository {
  /**
   * Create new traffic data entry
   */
  async create(data) {
    return await TrafficData.create(data);
  }

  /**
   * Find traffic data with filters
   */
  async find(query = {}, options = {}) {
    const {
      limit = 100,
      sort = { timestamp: -1 }
    } = options;

    return await TrafficData.find(query)
      .sort(sort)
      .limit(parseInt(limit));
  }

  /**
   * Find traffic data by intersection
   */
  async findByIntersection(intersectionId, options = {}) {
    return await this.find({ intersectionId }, options);
  }

  /**
   * Find traffic data by date range
   */
  async findByDateRange(startDate, endDate, options = {}) {
    const query = {
      timestamp: {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      }
    };
    return await this.find(query, options);
  }

  /**
   * Find traffic data by intersection and date range
   */
  async findByIntersectionAndDateRange(intersectionId, startDate, endDate, options = {}) {
    const query = {
      intersectionId,
      timestamp: {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      }
    };
    return await this.find(query, options);
  }

  /**
   * Count documents
   */
  async count(query = {}) {
    return await TrafficData.countDocuments(query);
  }

  /**
   * Count recent traffic data (last N minutes)
   */
  async countRecent(minutes = 15) {
    return await this.count({
      timestamp: { $gte: new Date(Date.now() - minutes * 60 * 1000) }
    });
  }

  /**
   * Get latest traffic data entries
   */
  async getLatest(limit = 100) {
    return await this.find({}, { limit, sort: { timestamp: -1 } });
  }

  /**
   * Delete old traffic data (cleanup)
   */
  async deleteOlderThan(date) {
    return await TrafficData.deleteMany({
      timestamp: { $lt: new Date(date) }
    });
  }
}

module.exports = new TrafficRepository();
