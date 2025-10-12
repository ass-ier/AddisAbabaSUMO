const trafficRepository = require('../repositories/traffic.repository');
const cacheService = require('./cache.service');
const logger = require('../utils/logger');

class TrafficService {
  /**
   * Create new traffic data entry
   */
  async createTrafficData(data) {
    try {
      const trafficData = await trafficRepository.create(data);
      logger.info('Traffic data created', { intersectionId: data.intersectionId });
      
      // Invalidate relevant caches
      await this.invalidateCache(data.intersectionId);
      
      return trafficData;
    } catch (error) {
      logger.error('Error creating traffic data', { error: error.message });
      throw error;
    }
  }

  /**
   * Get traffic data with caching
   */
  async getTrafficData(filters = {}) {
    try {
      const { intersectionId, startDate, endDate, limit = 100 } = filters;
      
      // Generate cache key based on filters
      const cacheKey = `traffic_data:${intersectionId || 'all'}:${startDate || ''}:${endDate || ''}:${limit}`;
      
      // Try to get from cache
      const cached = await cacheService.get(cacheKey);
      if (cached) {
        logger.info('Serving traffic data from cache', { cacheKey });
        return cached;
      }

      // Build query
      let trafficData;
      if (intersectionId && startDate && endDate) {
        trafficData = await trafficRepository.findByIntersectionAndDateRange(
          intersectionId,
          startDate,
          endDate,
          { limit }
        );
      } else if (intersectionId) {
        trafficData = await trafficRepository.findByIntersection(intersectionId, { limit });
      } else if (startDate && endDate) {
        trafficData = await trafficRepository.findByDateRange(startDate, endDate, { limit });
      } else {
        trafficData = await trafficRepository.getLatest(limit);
      }

      // Cache for 60 seconds
      await cacheService.set(cacheKey, trafficData, 60);
      
      logger.info('Traffic data fetched from database', { count: trafficData.length });
      return trafficData;
    } catch (error) {
      logger.error('Error getting traffic data', { error: error.message });
      throw error;
    }
  }

  /**
   * Export traffic data to CSV format
   */
  async exportToCSV(filters = {}) {
    try {
      const { intersectionId, startDate, endDate, limit = 1000 } = filters;
      
      let trafficData;
      if (intersectionId && startDate && endDate) {
        trafficData = await trafficRepository.findByIntersectionAndDateRange(
          intersectionId,
          startDate,
          endDate,
          { limit }
        );
      } else if (intersectionId) {
        trafficData = await trafficRepository.findByIntersection(intersectionId, { limit });
      } else if (startDate && endDate) {
        trafficData = await trafficRepository.findByDateRange(startDate, endDate, { limit });
      } else {
        trafficData = await trafficRepository.getLatest(limit);
      }

      // Generate CSV
      const headers = ['timestamp', 'intersectionId', 'trafficFlow', 'vehicleCount', 'averageSpeed', 'signalStatus'];
      const rows = trafficData.map(d => [
        d.timestamp ? new Date(d.timestamp).toISOString() : '',
        d.intersectionId || '',
        d.trafficFlow ?? '',
        d.vehicleCount ?? '',
        d.averageSpeed ?? '',
        d.signalStatus ?? ''
      ]);
      
      const csv = [
        headers.join(','),
        ...rows.map(r => r.join(','))
      ].join('\n');

      logger.info('Traffic data exported to CSV', { records: trafficData.length });
      return csv;
    } catch (error) {
      logger.error('Error exporting traffic data to CSV', { error: error.message });
      throw error;
    }
  }

  /**
   * Get traffic statistics
   */
  async getStatistics(filters = {}) {
    try {
      const trafficData = await this.getTrafficData(filters);
      
      if (trafficData.length === 0) {
        return {
          count: 0,
          avgSpeed: 0,
          avgFlow: 0,
          avgVehicleCount: 0
        };
      }

      const stats = trafficData.reduce((acc, d) => {
        acc.totalSpeed += d.averageSpeed || 0;
        acc.totalFlow += d.trafficFlow || 0;
        acc.totalVehicles += d.vehicleCount || 0;
        return acc;
      }, { totalSpeed: 0, totalFlow: 0, totalVehicles: 0 });

      return {
        count: trafficData.length,
        avgSpeed: Number((stats.totalSpeed / trafficData.length).toFixed(2)),
        avgFlow: Number((stats.totalFlow / trafficData.length).toFixed(2)),
        avgVehicleCount: Number((stats.totalVehicles / trafficData.length).toFixed(2))
      };
    } catch (error) {
      logger.error('Error calculating traffic statistics', { error: error.message });
      throw error;
    }
  }

  /**
   * Count recent traffic data
   */
  async countRecent(minutes = 15) {
    try {
      return await trafficRepository.countRecent(minutes);
    } catch (error) {
      logger.error('Error counting recent traffic data', { error: error.message });
      throw error;
    }
  }

  /**
   * Invalidate traffic data cache
   */
  async invalidateCache(intersectionId = null) {
    try {
      if (intersectionId) {
        // Invalidate specific intersection caches
        await cacheService.deletePattern(`traffic_data:${intersectionId}:*`);
      }
      // Always invalidate 'all' cache
      await cacheService.deletePattern('traffic_data:all:*');
    } catch (error) {
      logger.warn('Cache invalidation failed', { error: error.message });
    }
  }
}

module.exports = new TrafficService();
