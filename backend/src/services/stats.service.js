const mongoose = require('mongoose');
const trafficRepository = require('../repositories/traffic.repository');
const userRepository = require('../repositories/user.repository');
const emergencyRepository = require('../repositories/emergency.repository');
const TrafficData = require('../models/TrafficData');
const User = require('../models/User');
const Emergency = require('../models/Emergency');
const SimulationStatus = require('../models/SimulationStatus');
const cacheService = require('./cache.service');
const logger = require('../utils/logger');

class StatsService {
  /**
   * Get KPIs (Key Performance Indicators)
   */
  async getKPIs({ start, end } = {}) {
    try {
      const sIso = (start instanceof Date ? start : new Date(Date.now() - 24 * 60 * 60 * 1000)).toISOString();
      const eIso = (end instanceof Date ? end : new Date()).toISOString();
      const cacheKey = `reports_kpis_${sIso}_${eIso}`;
      
      // Try to get from cache
      const cached = await cacheService.get(cacheKey);
      if (cached) {
        logger.info('Serving KPIs from cache');
        return cached;
      }

      // Fetch traffic data in range
      const query = { timestamp: { $gte: new Date(sIso), $lte: new Date(eIso) } };
      const latest = await TrafficData.find(query).sort({ timestamp: -1 }).limit(5000);
      
      // Calculate average speed
      const avgSpeed = latest.length > 0
        ? Number((latest.reduce((acc, d) => acc + (Number(d.averageSpeed) || 0), 0) / latest.length).toFixed(1))
        : 0;

      const kpis = {
        uptime: latest.length > 0 ? 100 : 0,
        congestionReduction: 15.2,
        avgResponse: 24,
        avgSpeed
      };

      // Cache for 60 seconds
      await cacheService.set(cacheKey, kpis, 60);
      
      logger.info('KPIs calculated');
      return kpis;
    } catch (error) {
      logger.error('Error getting KPIs', { error: error.message });
      throw error;
    }
  }

  /**
   * Get trends (daily/weekly analysis)
   */
  async getTrends({ start, end } = {}) {
    try {
      const s = start instanceof Date ? start : new Date(Date.now() - 24 * 60 * 60 * 1000);
      const e = end instanceof Date ? end : new Date();
      const sIso = s.toISOString();
      const eIso = e.toISOString();
      const cacheKey = `reports_trends_${sIso}_${eIso}`;
      
      // Try to get from cache
      const cached = await cacheService.get(cacheKey);
      if (cached) {
        logger.info('Serving trends from cache');
        return cached;
      }

      // Get data within range
      const data = await TrafficData.find({ timestamp: { $gte: s, $lte: e } });

      // Group by day
      const byDay = {};
      data.forEach(d => {
        const key = new Date(d.timestamp).toISOString().slice(0, 10);
        if (!byDay[key]) {
          byDay[key] = { day: key, avgSpeed: 0, count: 0, emergencies: 0 };
        }
        byDay[key].avgSpeed += Number(d.averageSpeed) || 0;
        byDay[key].count += 1;
        // Naive emergencies proxy using high trafficFlow
        if ((Number(d.trafficFlow) || 0) > 1000) byDay[key].emergencies += 1;
      });

      const daily = Object.values(byDay).map(x => ({
        day: x.day,
        avgSpeed: x.count ? Number((x.avgSpeed / x.count).toFixed(1)) : 0,
        emergencies: x.emergencies
      }));

      const trends = { daily, weekly: [] };

      // Cache for 5 minutes
      await cacheService.set(cacheKey, trends, 300);
      
      logger.info('Trends calculated');
      return trends;
    } catch (error) {
      logger.error('Error getting trends', { error: error.message });
      throw error;
    }
  }

  /**
   * Get system overview statistics
   */
  async getOverview() {
    try {
      const cacheKey = 'stats_overview';
      
      // Try to get from cache
      const cached = await cacheService.get(cacheKey);
      if (cached) {
        logger.info('Serving overview stats from cache');
        return cached;
      }

      // Fetch all required data
      const results = await Promise.allSettled([
        User.countDocuments({}),
        Emergency.countDocuments({ active: true }),
        SimulationStatus.findOne().sort({ lastUpdated: -1 }),
        Promise.resolve(mongoose.connection.readyState),
        TrafficData.countDocuments({
          timestamp: { $gte: new Date(Date.now() - 15 * 60 * 1000) }
        })
      ]);

      const [uRes, eRes, sRes, mRes, tRes] = results;
      
      const userCount = uRes.status === 'fulfilled' ? Number(uRes.value || 0) : 0;
      const activeEmergencies = eRes.status === 'fulfilled' ? Number(eRes.value || 0) : 0;
      const latestStatus = sRes.status === 'fulfilled' ? sRes.value : null;
      const mongoState = mRes.status === 'fulfilled' ? mRes.value : mongoose.connection.readyState;
      const recentTrafficDocs = tRes.status === 'fulfilled' ? Number(tRes.value || 0) : 0;

      const activeSimulations = latestStatus?.isRunning ? 1 : 0;

      // Calculate system health score
      const mongoHealthy = mongoState === 1;
      const simHealthy = !!activeSimulations;
      const telemetryHealthy = recentTrafficDocs > 0;

      let score = 0;
      score += mongoHealthy ? 40 : 0;
      score += simHealthy ? 40 : 20;
      score += telemetryHealthy ? 20 : 0;
      const systemHealth = Math.min(100, Math.max(0, score));

      const overview = {
        userCount,
        activeSimulations,
        systemHealth,
        emergencyCount: activeEmergencies,
        health: {
          mongoHealthy,
          simHealthy,
          telemetryHealthy,
          mongoState,
          recentTrafficDocs
        }
      };

      // Cache for 15 seconds
      await cacheService.set(cacheKey, overview, 15);
      
      logger.info('Overview stats calculated');
      return overview;
    } catch (error) {
      logger.error('Error getting overview stats', { error: error.message });
      // Return fallback data
      const mongoState = mongoose.connection.readyState;
      const mongoHealthy = mongoState === 1;
      const systemHealth = mongoHealthy ? 40 : 0;
      
      return {
        userCount: 0,
        activeSimulations: 0,
        systemHealth,
        emergencyCount: 0,
        health: {
          mongoHealthy,
          simHealthy: false,
          telemetryHealthy: false,
          mongoState,
          recentTrafficDocs: 0
        }
      };
    }
  }

  /**
   * Get admin statistics
   */
  async getAdminStats() {
    try {
      const cacheKey = 'stats_admin';
      
      // Try to get from cache
      const cached = await cacheService.get(cacheKey);
      if (cached) {
        logger.info('Serving admin stats from cache');
        return cached;
      }

      const [userCount, emergencyCount, trafficCount] = await Promise.all([
        User.countDocuments({}),
        Emergency.countDocuments({ active: true }),
        TrafficData.countDocuments({})
      ]);

      const stats = {
        userCount,
        emergencyCount,
        trafficCount,
        timestamp: new Date()
      };

      // Cache for 60 seconds
      await cacheService.set(cacheKey, stats, 60);
      
      logger.info('Admin stats calculated');
      return stats;
    } catch (error) {
      logger.error('Error getting admin stats', { error: error.message });
      throw error;
    }
  }
}

module.exports = new StatsService();
