const trafficService = require('./traffic.service');
const cacheService = require('./cache.service');
const logger = require('../utils/logger');

/**
 * Operator Analytics Service
 * Provides advanced analytics and insights for system operators
 */
class OperatorAnalyticsService {
  constructor() {
    this.analyticsCache = new Map();
    this.realTimeMetrics = {
      totalVehicles: 0,
      averageSpeed: 0,
      activeIntersections: 0,
      congestionLevel: 'low',
      lastUpdated: null
    };
  }

  /**
   * Get comprehensive dashboard metrics for operators
   */
  async getDashboardMetrics() {
    try {
      const cacheKey = 'operator_dashboard_metrics';
      
      // Try cache but don't fail if cache service is unavailable
      let cached = null;
      try {
        cached = await cacheService.get(cacheKey);
        if (cached) {
          return cached;
        }
      } catch (cacheError) {
        logger.debug('Cache read failed, continuing without cache', { error: cacheError.message });
      }

      // Use Promise.allSettled to prevent one failure from breaking everything
      const results = await Promise.allSettled([
        this.getTrafficOverview(),
        this.getPerformanceMetrics(),
        this.getSystemStatus(),
        this.getAlerts(),
        this.getCongestionAnalysis()
      ]);

      const dashboardData = {
        timestamp: new Date().toISOString(),
        traffic: results[0].status === 'fulfilled' ? results[0].value : this.getDefaultTrafficOverview(),
        performance: results[1].status === 'fulfilled' ? results[1].value : this.getDefaultPerformanceMetrics(),
        system: results[2].status === 'fulfilled' ? results[2].value : this.getDefaultSystemStatus(),
        alerts: results[3].status === 'fulfilled' ? results[3].value : [],
        congestion: results[4].status === 'fulfilled' ? results[4].value : this.getDefaultCongestionAnalysis()
      };

      // Try to cache but don't fail if cache service is unavailable
      try {
        await cacheService.set(cacheKey, dashboardData, 30);
      } catch (cacheError) {
        logger.debug('Cache write failed, continuing without cache', { error: cacheError.message });
      }
      
      return dashboardData;
    } catch (error) {
      logger.error('Error getting dashboard metrics', { error: error.message, stack: error.stack });
      // Return default dashboard data instead of throwing
      return this.getDefaultDashboardData();
    }
  }

  getDefaultDashboardData() {
    return {
      timestamp: new Date().toISOString(),
      traffic: this.getDefaultTrafficOverview(),
      performance: this.getDefaultPerformanceMetrics(),
      system: this.getDefaultSystemStatus(),
      alerts: [],
      congestion: this.getDefaultCongestionAnalysis()
    };
  }

  getDefaultTrafficOverview() {
    return {
      totalVehicles: 0,
      averageSpeed: 0,
      activeIntersections: 0,
      throughput: 0,
      efficiency: 0
    };
  }

  getDefaultPerformanceMetrics() {
    return {
      averageWaitTime: 0,
      queueLength: 0,
      signalEfficiency: 0,
      fuelConsumption: 0,
      emissions: { co2: 0, nox: 0, pm: 0 }
    };
  }

  getDefaultSystemStatus() {
    return {
      overallHealth: 'unknown',
      healthScore: 0,
      cpuUsage: 0,
      memoryUsage: 0,
      uptime: process.uptime(),
      databaseStatus: 'unknown',
      sumoStatus: 'unknown',
      activeConnections: 0
    };
  }

  getDefaultCongestionAnalysis() {
    return {
      level: 'low',
      hotspots: [],
      predictions: []
    };
  }

  /**
   * Get traffic overview metrics
   */
  async getTrafficOverview() {
    try {
      const recentTrafficData = await trafficService.getTrafficData({ limit: 100 });
      
      if (recentTrafficData.length === 0) {
        return {
          totalVehicles: 0,
          averageSpeed: 0,
          activeIntersections: 0,
          throughput: 0,
          efficiency: 0
        };
      }

      const totalVehicles = recentTrafficData.reduce((sum, data) => sum + (data.vehicleCount || 0), 0);
      const avgSpeed = recentTrafficData.reduce((sum, data) => sum + (data.averageSpeed || 0), 0) / recentTrafficData.length;
      const activeIntersections = new Set(recentTrafficData.map(data => data.intersectionId)).size;
      
      // Calculate throughput (vehicles per minute)
      const timeSpan = this.getTimeSpanMinutes(recentTrafficData);
      const throughput = timeSpan > 0 ? Math.round(totalVehicles / timeSpan) : 0;
      
      // Calculate efficiency (0-100 scale based on average speed vs optimal speed)
      const optimalSpeed = 30; // km/h
      const efficiency = Math.min(100, Math.round((avgSpeed / optimalSpeed) * 100));

      return {
        totalVehicles,
        averageSpeed: Math.round(avgSpeed * 100) / 100,
        activeIntersections,
        throughput,
        efficiency
      };
    } catch (error) {
      logger.error('Error getting traffic overview', { error: error.message });
      return {
        totalVehicles: 0,
        averageSpeed: 0,
        activeIntersections: 0,
        throughput: 0,
        efficiency: 0
      };
    }
  }

  /**
   * Get performance metrics
   */
  async getPerformanceMetrics() {
    try {
      const stats = await trafficService.getStatistics({ limit: 200 });
      
      return {
        averageWaitTime: this.calculateAverageWaitTime(stats),
        queueLength: this.calculateAverageQueueLength(stats),
        signalEfficiency: this.calculateSignalEfficiency(stats),
        fuelConsumption: this.estimateFuelConsumption(stats),
        emissions: this.estimateEmissions(stats)
      };
    } catch (error) {
      logger.error('Error getting performance metrics', { error: error.message });
      return {
        averageWaitTime: 0,
        queueLength: 0,
        signalEfficiency: 0,
        fuelConsumption: 0,
        emissions: { co2: 0, nox: 0, pm: 0 }
      };
    }
  }

  /**
   * Get system status overview
   */
  async getSystemStatus() {
    try {
      const systemMonitoring = require('./system-monitoring.service');
      const health = systemMonitoring.getHealthSummary();
      const metrics = systemMonitoring.getMetrics();
      
      return {
        overallHealth: health.status,
        healthScore: health.score,
        cpuUsage: metrics.system.cpu.usage,
        memoryUsage: metrics.system.memory.usage,
        uptime: metrics.application.uptime,
        databaseStatus: metrics.application.database.status,
        sumoStatus: metrics.application.sumo.status,
        activeConnections: metrics.application.websockets.connections
      };
    } catch (error) {
      logger.error('Error getting system status', { error: error.message });
      return {
        overallHealth: 'unknown',
        healthScore: 0,
        cpuUsage: 0,
        memoryUsage: 0,
        uptime: 0,
        databaseStatus: 'unknown',
        sumoStatus: 'unknown',
        activeConnections: 0
      };
    }
  }

  /**
   * Get current alerts and notifications
   */
  async getAlerts() {
    try {
      const alerts = [];
      
      // Get system health alerts
      const systemMonitoring = require('./system-monitoring.service');
      const health = systemMonitoring.getHealthSummary();
      
      health.issues.forEach(issue => {
        alerts.push({
          id: `system_${issue.type}`,
          type: issue.type === 'database_down' ? 'critical' : 'warning',
          message: issue.message,
          timestamp: new Date().toISOString(),
          source: 'system'
        });
      });

      // Get traffic alerts
      const trafficAlerts = await this.getTrafficAlerts();
      alerts.push(...trafficAlerts);

      // Sort by severity and timestamp
      alerts.sort((a, b) => {
        const severityOrder = { critical: 0, warning: 1, info: 2 };
        const severityDiff = severityOrder[a.type] - severityOrder[b.type];
        if (severityDiff !== 0) return severityDiff;
        return new Date(b.timestamp) - new Date(a.timestamp);
      });

      return alerts.slice(0, 10); // Return top 10 alerts
    } catch (error) {
      logger.error('Error getting alerts', { error: error.message });
      return [];
    }
  }

  /**
   * Get traffic-specific alerts
   */
  async getTrafficAlerts() {
    try {
      const alerts = [];
      const recentData = await trafficService.getTrafficData({ limit: 50 });
      
      if (recentData.length === 0) {
        return alerts;
      }

      // Check for high congestion
      const highCongestionIntersections = recentData.filter(data => 
        data.averageSpeed < 10 && data.vehicleCount > 20
      );
      
      highCongestionIntersections.forEach(data => {
        alerts.push({
          id: `congestion_${data.intersectionId}`,
          type: 'warning',
          message: `High congestion detected at intersection ${data.intersectionId}`,
          timestamp: data.timestamp || new Date().toISOString(),
          source: 'traffic',
          intersectionId: data.intersectionId
        });
      });

      // Check for unusual traffic patterns
      const avgSpeed = recentData.reduce((sum, data) => sum + (data.averageSpeed || 0), 0) / recentData.length;
      if (avgSpeed < 5) {
        alerts.push({
          id: 'system_congestion',
          type: 'critical',
          message: 'System-wide severe congestion detected',
          timestamp: new Date().toISOString(),
          source: 'traffic'
        });
      }

      return alerts;
    } catch (error) {
      logger.error('Error getting traffic alerts', { error: error.message });
      return [];
    }
  }

  /**
   * Get congestion analysis
   */
  async getCongestionAnalysis() {
    try {
      const recentData = await trafficService.getTrafficData({ limit: 100 });
      
      if (recentData.length === 0) {
        return {
          overallLevel: 'unknown',
          hotspots: [],
          trend: 'stable',
          recommendations: []
        };
      }

      // Calculate overall congestion level
      const avgSpeed = recentData.reduce((sum, data) => sum + (data.averageSpeed || 0), 0) / recentData.length;
      const overallLevel = this.calculateCongestionLevel(avgSpeed);

      // Identify hotspots
      const intersectionStats = this.groupByIntersection(recentData);
      const hotspots = Object.entries(intersectionStats)
        .map(([intersectionId, stats]) => ({
          intersectionId,
          averageSpeed: stats.avgSpeed,
          vehicleCount: stats.avgVehicleCount,
          congestionLevel: this.calculateCongestionLevel(stats.avgSpeed)
        }))
        .filter(spot => spot.congestionLevel === 'high' || spot.congestionLevel === 'severe')
        .sort((a, b) => a.averageSpeed - b.averageSpeed);

      // Generate recommendations
      const recommendations = this.generateCongestionRecommendations(overallLevel, hotspots);

      return {
        overallLevel,
        hotspots: hotspots.slice(0, 5), // Top 5 hotspots
        trend: this.calculateCongestionTrend(recentData),
        recommendations
      };
    } catch (error) {
      logger.error('Error getting congestion analysis', { error: error.message });
      return {
        overallLevel: 'unknown',
        hotspots: [],
        trend: 'stable',
        recommendations: []
      };
    }
  }

  /**
   * Get detailed intersection analysis
   */
  async getIntersectionAnalysis(intersectionId, timeRange = '1h') {
    try {
      const endDate = new Date();
      const startDate = new Date();
      
      // Set start date based on time range
      switch (timeRange) {
        case '1h':
          startDate.setHours(startDate.getHours() - 1);
          break;
        case '24h':
          startDate.setDate(startDate.getDate() - 1);
          break;
        case '7d':
          startDate.setDate(startDate.getDate() - 7);
          break;
        default:
          startDate.setHours(startDate.getHours() - 1);
      }

      const data = await trafficService.getTrafficData({
        intersectionId,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        limit: 1000
      });

      return {
        intersectionId,
        timeRange,
        dataPoints: data.length,
        averageSpeed: data.length > 0 ? data.reduce((sum, d) => sum + (d.averageSpeed || 0), 0) / data.length : 0,
        averageVehicleCount: data.length > 0 ? data.reduce((sum, d) => sum + (d.vehicleCount || 0), 0) / data.length : 0,
        peakTrafficTime: this.findPeakTrafficTime(data),
        efficiency: this.calculateIntersectionEfficiency(data),
        recommendations: this.generateIntersectionRecommendations(data)
      };
    } catch (error) {
      logger.error('Error getting intersection analysis', { error: error.message });
      throw error;
    }
  }

  /**
   * Generate comprehensive reports for operators
   */
  async generateOperatorReport(type = 'daily', options = {}) {
    try {
      const report = {
        type,
        generatedAt: new Date().toISOString(),
        summary: {},
        details: {},
        recommendations: [],
        charts: []
      };

      switch (type) {
        case 'daily':
          report.summary = await this.getDailySummary();
          report.details = await this.getDailyDetails();
          break;
        case 'performance':
          report.summary = await this.getPerformanceSummary();
          report.details = await this.getPerformanceDetails();
          break;
        case 'system':
          report.summary = await this.getSystemSummary();
          report.details = await this.getSystemDetails();
          break;
        default:
          throw new Error(`Unknown report type: ${type}`);
      }

      report.recommendations = await this.generateRecommendations(report.summary, report.details);
      
      return report;
    } catch (error) {
      logger.error('Error generating operator report', { error: error.message });
      throw error;
    }
  }

  // Helper methods

  /**
   * Calculate time span in minutes between first and last data points
   */
  getTimeSpanMinutes(data) {
    if (data.length < 2) return 0;
    
    const timestamps = data
      .map(d => new Date(d.timestamp))
      .filter(t => !isNaN(t.getTime()))
      .sort();
    
    if (timestamps.length < 2) return 0;
    
    return (timestamps[timestamps.length - 1] - timestamps[0]) / (1000 * 60);
  }

  /**
   * Calculate congestion level based on average speed
   */
  calculateCongestionLevel(avgSpeed) {
    if (avgSpeed >= 25) return 'low';
    if (avgSpeed >= 15) return 'moderate';
    if (avgSpeed >= 8) return 'high';
    return 'severe';
  }

  /**
   * Group traffic data by intersection
   */
  groupByIntersection(data) {
    const groups = {};
    
    data.forEach(item => {
      if (!groups[item.intersectionId]) {
        groups[item.intersectionId] = {
          speeds: [],
          vehicleCounts: []
        };
      }
      
      if (item.averageSpeed !== undefined) {
        groups[item.intersectionId].speeds.push(item.averageSpeed);
      }
      if (item.vehicleCount !== undefined) {
        groups[item.intersectionId].vehicleCounts.push(item.vehicleCount);
      }
    });

    // Calculate averages
    Object.keys(groups).forEach(intersectionId => {
      const group = groups[intersectionId];
      group.avgSpeed = group.speeds.length > 0 
        ? group.speeds.reduce((sum, speed) => sum + speed, 0) / group.speeds.length 
        : 0;
      group.avgVehicleCount = group.vehicleCounts.length > 0 
        ? group.vehicleCounts.reduce((sum, count) => sum + count, 0) / group.vehicleCounts.length 
        : 0;
    });

    return groups;
  }

  /**
   * Generate congestion recommendations
   */
  generateCongestionRecommendations(overallLevel, hotspots) {
    const recommendations = [];

    if (overallLevel === 'severe') {
      recommendations.push({
        priority: 'high',
        type: 'system',
        message: 'Consider activating emergency traffic management protocols',
        action: 'Enable dynamic signal timing adjustments'
      });
    }

    if (hotspots.length > 0) {
      recommendations.push({
        priority: 'medium',
        type: 'intersection',
        message: `${hotspots.length} intersection(s) require immediate attention`,
        action: 'Optimize signal timing for identified hotspots'
      });
    }

    if (overallLevel === 'moderate' || overallLevel === 'high') {
      recommendations.push({
        priority: 'low',
        type: 'optimization',
        message: 'Traffic flow can be improved with minor adjustments',
        action: 'Review and adjust traffic light phases'
      });
    }

    return recommendations;
  }

  /**
   * Calculate average wait time (placeholder implementation)
   */
  calculateAverageWaitTime(stats) {
    // This would be calculated based on actual traffic light timing and queue data
    return Math.random() * 30 + 10; // Placeholder: 10-40 seconds
  }

  /**
   * Calculate average queue length (placeholder implementation)
   */
  calculateAverageQueueLength(stats) {
    // This would be calculated based on actual vehicle queue data
    return Math.random() * 10 + 2; // Placeholder: 2-12 vehicles
  }

  /**
   * Calculate signal efficiency (placeholder implementation)
   */
  calculateSignalEfficiency(stats) {
    // This would be calculated based on green time utilization
    return Math.random() * 20 + 70; // Placeholder: 70-90%
  }

  /**
   * Estimate fuel consumption (placeholder implementation)
   */
  estimateFuelConsumption(stats) {
    // This would be calculated based on vehicle count and traffic patterns
    return {
      total: Math.random() * 100 + 50, // liters
      perVehicle: Math.random() * 2 + 5 // liters per 100km
    };
  }

  /**
   * Estimate emissions (placeholder implementation)
   */
  estimateEmissions(stats) {
    return {
      co2: Math.random() * 200 + 100, // kg
      nox: Math.random() * 10 + 5,    // kg
      pm: Math.random() * 2 + 1       // kg
    };
  }

  /**
   * Calculate congestion trend (placeholder implementation)
   */
  calculateCongestionTrend(data) {
    // This would analyze speed changes over time
    return ['improving', 'stable', 'worsening'][Math.floor(Math.random() * 3)];
  }

  /**
   * Find peak traffic time (placeholder implementation)
   */
  findPeakTrafficTime(data) {
    if (data.length === 0) return null;
    
    // Find the time with highest vehicle count
    const peak = data.reduce((max, current) => 
      (current.vehicleCount || 0) > (max.vehicleCount || 0) ? current : max
    );
    
    return peak.timestamp ? new Date(peak.timestamp).toLocaleTimeString() : null;
  }

  /**
   * Calculate intersection efficiency (placeholder implementation)
   */
  calculateIntersectionEfficiency(data) {
    if (data.length === 0) return 0;
    
    const avgSpeed = data.reduce((sum, d) => sum + (d.averageSpeed || 0), 0) / data.length;
    return Math.min(100, Math.round((avgSpeed / 30) * 100)); // Assuming 30 km/h as optimal
  }

  /**
   * Generate intersection recommendations (placeholder implementation)
   */
  generateIntersectionRecommendations(data) {
    if (data.length === 0) return [];
    
    const avgSpeed = data.reduce((sum, d) => sum + (d.averageSpeed || 0), 0) / data.length;
    const recommendations = [];

    if (avgSpeed < 10) {
      recommendations.push('Consider extending green light duration');
      recommendations.push('Review pedestrian crossing timing');
    } else if (avgSpeed > 40) {
      recommendations.push('Consider adding speed control measures');
    }

    return recommendations;
  }

  /**
   * Get daily summary (placeholder implementation)
   */
  async getDailySummary() {
    return {
      totalVehicles: Math.floor(Math.random() * 10000) + 5000,
      averageSpeed: Math.random() * 20 + 20,
      peakHour: '08:00-09:00',
      incidents: Math.floor(Math.random() * 5)
    };
  }

  /**
   * Get daily details (placeholder implementation)
   */
  async getDailyDetails() {
    return {
      hourlyBreakdown: [],
      intersectionPerformance: [],
      alerts: []
    };
  }

  /**
   * Get performance summary (placeholder implementation)
   */
  async getPerformanceSummary() {
    return {
      systemEfficiency: Math.random() * 20 + 75,
      responseTime: Math.random() * 100 + 200,
      uptime: 99.5
    };
  }

  /**
   * Get performance details (placeholder implementation)
   */
  async getPerformanceDetails() {
    return {
      metrics: [],
      trends: [],
      comparisons: []
    };
  }

  /**
   * Get system summary (placeholder implementation)
   */
  async getSystemSummary() {
    const systemMonitoring = require('./system-monitoring.service');
    return systemMonitoring.getHealthSummary();
  }

  /**
   * Get system details (placeholder implementation)
   */
  async getSystemDetails() {
    const systemMonitoring = require('./system-monitoring.service');
    return systemMonitoring.getMetrics();
  }

  /**
   * Generate recommendations based on summary and details
   */
  async generateRecommendations(summary, details) {
    const recommendations = [];
    
    // Add logic to generate recommendations based on the data
    recommendations.push({
      priority: 'medium',
      category: 'optimization',
      message: 'System performance is within normal parameters',
      action: 'Continue monitoring for trends'
    });

    return recommendations;
  }
}

module.exports = new OperatorAnalyticsService();