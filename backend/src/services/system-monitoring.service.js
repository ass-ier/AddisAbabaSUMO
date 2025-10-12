const os = require('os');
const fs = require('fs').promises;
const path = require('path');
const logger = require('../utils/logger');
const cacheService = require('./cache.service');

/**
 * System Monitoring Service
 * Provides comprehensive system health monitoring for operators
 */
class SystemMonitoringService {
  constructor() {
    this.startTime = Date.now();
    this.monitoringInterval = null;
    this.systemMetrics = {
      cpu: { usage: 0, loadAverage: [] },
      memory: { usage: 0, total: 0, free: 0 },
      disk: { usage: 0, total: 0, free: 0 },
      network: { bytesReceived: 0, bytesSent: 0 },
      processes: { total: 0, running: 0 }
    };
    this.applicationMetrics = {
      uptime: 0,
      requests: { total: 0, active: 0, errorsPerMinute: 0 },
      database: { connected: false, responseTime: 0 },
      sumo: { status: 'disconnected', processId: null },
      websockets: { connections: 0, messagesPerMinute: 0 }
    };
  }

  /**
   * Start system monitoring
   * @param {number} interval - Monitoring interval in milliseconds (default: 30000)
   */
  startMonitoring(interval = 30000) {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }

    this.monitoringInterval = setInterval(() => {
      this.collectMetrics();
    }, interval);

    logger.info('System monitoring started', { interval });
  }

  /**
   * Stop system monitoring
   */
  stopMonitoring() {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
      logger.info('System monitoring stopped');
    }
  }

  /**
   * Collect all system metrics
   */
  async collectMetrics() {
    try {
      await Promise.all([
        this.collectSystemMetrics(),
        this.collectApplicationMetrics()
      ]);

      // Cache metrics for quick access
      await cacheService.set('system_metrics', this.getMetrics(), 60);
      
      // Log critical alerts
      this.checkAlerts();
      
    } catch (error) {
      logger.error('Error collecting system metrics', { error: error.message });
    }
  }

  /**
   * Collect system-level metrics
   */
  async collectSystemMetrics() {
    try {
      // CPU metrics
      const cpus = os.cpus();
      this.systemMetrics.cpu.loadAverage = os.loadavg();
      
      // Calculate CPU usage percentage
      let totalIdle = 0;
      let totalTick = 0;
      
      cpus.forEach(cpu => {
        for (const type in cpu.times) {
          totalTick += cpu.times[type];
        }
        totalIdle += cpu.times.idle;
      });
      
      this.systemMetrics.cpu.usage = Math.round(100 - ~~(100 * totalIdle / totalTick));

      // Memory metrics
      const totalMemory = os.totalmem();
      const freeMemory = os.freemem();
      const usedMemory = totalMemory - freeMemory;
      
      this.systemMetrics.memory = {
        usage: Math.round((usedMemory / totalMemory) * 100),
        total: Math.round(totalMemory / (1024 * 1024 * 1024)), // GB
        free: Math.round(freeMemory / (1024 * 1024 * 1024)), // GB
        used: Math.round(usedMemory / (1024 * 1024 * 1024)) // GB
      };

      // Disk metrics (for current working directory)
      await this.collectDiskMetrics();

      // Network metrics would require additional libraries like 'systeminformation'
      // For now, we'll use placeholder values
      this.systemMetrics.network = {
        bytesReceived: 0,
        bytesSent: 0
      };

    } catch (error) {
      logger.error('Error collecting system metrics', { error: error.message });
    }
  }

  /**
   * Collect disk usage metrics
   */
  async collectDiskMetrics() {
    try {
      const stats = await fs.stat(process.cwd());
      // This is a simplified disk usage calculation
      // In production, you might want to use a library like 'diskusage'
      this.systemMetrics.disk = {
        usage: 0, // Placeholder
        total: 0, // Placeholder
        free: 0   // Placeholder
      };
    } catch (error) {
      logger.warn('Could not collect disk metrics', { error: error.message });
    }
  }

  /**
   * Collect application-specific metrics
   */
  async collectApplicationMetrics() {
    try {
      // Application uptime
      this.applicationMetrics.uptime = Math.floor((Date.now() - this.startTime) / 1000);

      // Database connection status (MongoDB)
      this.applicationMetrics.database = await this.checkDatabaseHealth();

      // SUMO process status
      this.applicationMetrics.sumo = await this.checkSumoStatus();

      // WebSocket connections (if available)
      this.applicationMetrics.websockets = {
        connections: global.wsConnections || 0,
        messagesPerMinute: global.wsMessagesPerMinute || 0
      };

    } catch (error) {
      logger.error('Error collecting application metrics', { error: error.message });
    }
  }

  /**
   * Check database health
   */
  async checkDatabaseHealth() {
    try {
      const startTime = Date.now();
      
      // This would typically use your MongoDB connection
      // For now, we'll return a placeholder
      const responseTime = Date.now() - startTime;
      
      return {
        connected: true,
        responseTime,
        status: 'healthy'
      };
    } catch (error) {
      logger.warn('Database health check failed', { error: error.message });
      return {
        connected: false,
        responseTime: -1,
        status: 'disconnected'
      };
    }
  }

  /**
   * Check SUMO process status
   */
  async checkSumoStatus() {
    try {
      const sumoService = require('./sumo-subprocess.service');
      const isRunning = sumoService.getIsRunning();
      const processInfo = sumoService.getProcessInfo();

      return {
        status: isRunning ? 'running' : 'stopped',
        processId: processInfo ? processInfo.pid : null,
        uptime: isRunning ? this.applicationMetrics.uptime : 0
      };
    } catch (error) {
      logger.warn('SUMO status check failed', { error: error.message });
      return {
        status: 'unknown',
        processId: null,
        uptime: 0
      };
    }
  }

  /**
   * Get current metrics
   */
  getMetrics() {
    return {
      timestamp: new Date().toISOString(),
      system: { ...this.systemMetrics },
      application: { ...this.applicationMetrics }
    };
  }

  /**
   * Get system health summary
   */
  getHealthSummary() {
    const metrics = this.getMetrics();
    const health = {
      status: 'healthy',
      score: 100,
      issues: [],
      timestamp: metrics.timestamp
    };

    // Check CPU usage
    if (metrics.system.cpu.usage > 80) {
      health.issues.push({ type: 'high_cpu', message: `High CPU usage: ${metrics.system.cpu.usage}%` });
      health.score -= 20;
    }

    // Check memory usage
    if (metrics.system.memory.usage > 85) {
      health.issues.push({ type: 'high_memory', message: `High memory usage: ${metrics.system.memory.usage}%` });
      health.score -= 20;
    }

    // Check database connection
    if (!metrics.application.database.connected) {
      health.issues.push({ type: 'database_down', message: 'Database connection lost' });
      health.score -= 30;
    }

    // Determine overall status
    if (health.score < 60) {
      health.status = 'critical';
    } else if (health.score < 80) {
      health.status = 'warning';
    }

    return health;
  }

  /**
   * Check for alerts and log critical issues
   */
  checkAlerts() {
    const health = this.getHealthSummary();
    
    if (health.status === 'critical') {
      logger.error('System health critical', { health });
    } else if (health.status === 'warning') {
      logger.warn('System health warning', { health });
    }

    health.issues.forEach(issue => {
      if (issue.type === 'database_down') {
        logger.error('Critical: Database connection lost');
      }
    });
  }

  /**
   * Get performance statistics for a time period
   */
  async getPerformanceStats(periodHours = 24) {
    try {
      const stats = {
        avgCpuUsage: 0,
        avgMemoryUsage: 0,
        peakCpuUsage: 0,
        peakMemoryUsage: 0,
        systemUptime: this.applicationMetrics.uptime,
        alertsCount: 0
      };

      // In a real implementation, you would fetch historical data
      // For now, return current metrics as averages
      const currentMetrics = this.getMetrics();
      stats.avgCpuUsage = currentMetrics.system.cpu.usage;
      stats.avgMemoryUsage = currentMetrics.system.memory.usage;
      stats.peakCpuUsage = currentMetrics.system.cpu.usage;
      stats.peakMemoryUsage = currentMetrics.system.memory.usage;

      return stats;
    } catch (error) {
      logger.error('Error getting performance stats', { error: error.message });
      throw error;
    }
  }

  /**
   * Export system metrics to CSV
   */
  async exportMetricsCSV(startDate, endDate) {
    try {
      const headers = [
        'timestamp',
        'cpu_usage',
        'memory_usage',
        'memory_total',
        'memory_free',
        'app_uptime',
        'database_connected',
        'database_response_time',
        'sumo_status',
        'websocket_connections'
      ];

      // In a real implementation, you would fetch historical data
      // For now, return current metrics
      const metrics = this.getMetrics();
      const rows = [[
        metrics.timestamp,
        metrics.system.cpu.usage,
        metrics.system.memory.usage,
        metrics.system.memory.total,
        metrics.system.memory.free,
        metrics.application.uptime,
        metrics.application.database.connected,
        metrics.application.database.responseTime,
        metrics.application.sumo.status,
        metrics.application.websockets.connections
      ]];

      const csv = [
        headers.join(','),
        ...rows.map(row => row.join(','))
      ].join('\n');

      return csv;
    } catch (error) {
      logger.error('Error exporting metrics to CSV', { error: error.message });
      throw error;
    }
  }
}

module.exports = new SystemMonitoringService();