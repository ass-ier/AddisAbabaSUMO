const systemMonitoringService = require('../services/system-monitoring.service');
const operatorAnalyticsService = require('../services/operator-analytics.service');
const trafficService = require('../services/traffic.service');
const auditService = require('../services/audit.service');
const logger = require('../utils/logger');

/**
 * Operator Controller
 * Handles all system operator-specific endpoints
 */
class OperatorController {
  /**
   * Get comprehensive dashboard data for operators
   * GET /api/operator/dashboard
   */
  async getDashboard(req, res) {
    try {
      const dashboardData = await operatorAnalyticsService.getDashboardMetrics();
      
      // Log dashboard access for audit
      await auditService.logAction({
        userId: req.user?.id,
        username: req.user?.username,
        action: 'dashboard_access',
        resource: 'operator_dashboard',
        details: { timestamp: new Date().toISOString() }
      });

      res.json({
        success: true,
        data: dashboardData
      });
    } catch (error) {
      logger.error('Error getting operator dashboard', { error: error.message });
      res.status(500).json({
        success: false,
        message: 'Failed to load dashboard data',
        error: error.message
      });
    }
  }

  /**
   * Get system health and monitoring data
   * GET /api/operator/system/health
   */
  async getSystemHealth(req, res) {
    try {
      const health = systemMonitoringService.getHealthSummary();
      const metrics = systemMonitoringService.getMetrics();
      
      res.json({
        success: true,
        data: {
          health,
          metrics,
          timestamp: new Date().toISOString()
        }
      });
    } catch (error) {
      logger.error('Error getting system health', { error: error.message });
      res.status(500).json({
        success: false,
        message: 'Failed to get system health',
        error: error.message
      });
    }
  }

  /**
   * Get detailed system metrics
   * GET /api/operator/system/metrics
   */
  async getSystemMetrics(req, res) {
    try {
      const { period } = req.query;
      const periodHours = parseInt(period) || 24;
      
      const [currentMetrics, performanceStats] = await Promise.all([
        systemMonitoringService.getMetrics(),
        systemMonitoringService.getPerformanceStats(periodHours)
      ]);

      res.json({
        success: true,
        data: {
          current: currentMetrics,
          performance: performanceStats,
          period: `${periodHours}h`
        }
      });
    } catch (error) {
      logger.error('Error getting system metrics', { error: error.message });
      res.status(500).json({
        success: false,
        message: 'Failed to get system metrics',
        error: error.message
      });
    }
  }

  /**
   * Export system metrics to CSV
   * GET /api/operator/system/metrics/export
   */
  async exportSystemMetrics(req, res) {
    try {
      const { startDate, endDate } = req.query;
      
      const csv = await systemMonitoringService.exportMetricsCSV(startDate, endDate);
      
      // Log export action
      await auditService.logAction({
        userId: req.user?.id,
        username: req.user?.username,
        action: 'metrics_export',
        resource: 'system_metrics',
        details: { startDate, endDate, format: 'csv' }
      });

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename=system-metrics.csv');
      res.send(csv);
    } catch (error) {
      logger.error('Error exporting system metrics', { error: error.message });
      res.status(500).json({
        success: false,
        message: 'Failed to export system metrics',
        error: error.message
      });
    }
  }

  /**
   * Get traffic analytics and insights
   * GET /api/operator/traffic/analytics
   */
  async getTrafficAnalytics(req, res) {
    try {
      const { timeRange = '1h' } = req.query;
      
      const analytics = await Promise.all([
        operatorAnalyticsService.getTrafficOverview(),
        operatorAnalyticsService.getPerformanceMetrics(),
        operatorAnalyticsService.getCongestionAnalysis(),
        operatorAnalyticsService.getAlerts()
      ]);

      res.json({
        success: true,
        data: {
          overview: analytics[0],
          performance: analytics[1],
          congestion: analytics[2],
          alerts: analytics[3],
          timeRange,
          timestamp: new Date().toISOString()
        }
      });
    } catch (error) {
      logger.error('Error getting traffic analytics', { error: error.message });
      res.status(500).json({
        success: false,
        message: 'Failed to get traffic analytics',
        error: error.message
      });
    }
  }

  /**
   * Get intersection-specific analysis
   * GET /api/operator/traffic/intersection/:intersectionId
   */
  async getIntersectionAnalysis(req, res) {
    try {
      const { intersectionId } = req.params;
      const { timeRange = '1h' } = req.query;
      
      if (!intersectionId) {
        return res.status(400).json({
          success: false,
          message: 'Intersection ID is required'
        });
      }

      const analysis = await operatorAnalyticsService.getIntersectionAnalysis(
        intersectionId, 
        timeRange
      );

      res.json({
        success: true,
        data: analysis
      });
    } catch (error) {
      logger.error('Error getting intersection analysis', { 
        error: error.message,
        intersectionId: req.params.intersectionId 
      });
      res.status(500).json({
        success: false,
        message: 'Failed to get intersection analysis',
        error: error.message
      });
    }
  }

  /**
   * Get real-time alerts and notifications
   * GET /api/operator/alerts
   */
  async getAlerts(req, res) {
    try {
      const { severity, source, limit = 50 } = req.query;
      
      let alerts = await operatorAnalyticsService.getAlerts();
      
      // Filter by severity if specified
      if (severity) {
        alerts = alerts.filter(alert => alert.type === severity);
      }
      
      // Filter by source if specified
      if (source) {
        alerts = alerts.filter(alert => alert.source === source);
      }
      
      // Limit results
      alerts = alerts.slice(0, parseInt(limit));

      res.json({
        success: true,
        data: {
          alerts,
          total: alerts.length,
          filters: { severity, source, limit }
        }
      });
    } catch (error) {
      logger.error('Error getting alerts', { error: error.message });
      res.status(500).json({
        success: false,
        message: 'Failed to get alerts',
        error: error.message
      });
    }
  }

  /**
   * Generate operator reports
   * POST /api/operator/reports/generate
   */
  async generateReport(req, res) {
    try {
      const { type = 'daily', options = {} } = req.body;
      
      const validTypes = ['daily', 'performance', 'system'];
      if (!validTypes.includes(type)) {
        return res.status(400).json({
          success: false,
          message: `Invalid report type. Must be one of: ${validTypes.join(', ')}`
        });
      }

      const report = await operatorAnalyticsService.generateOperatorReport(type, options);
      
      // Log report generation
      await auditService.logAction({
        userId: req.user?.id,
        username: req.user?.username,
        action: 'report_generate',
        resource: 'operator_report',
        details: { type, options }
      });

      res.json({
        success: true,
        data: report
      });
    } catch (error) {
      logger.error('Error generating report', { error: error.message });
      res.status(500).json({
        success: false,
        message: 'Failed to generate report',
        error: error.message
      });
    }
  }

  /**
   * Get system performance statistics
   * GET /api/operator/performance/stats
   */
  async getPerformanceStats(req, res) {
    try {
      const { period = 24 } = req.query;
      const periodHours = parseInt(period);
      
      const stats = await systemMonitoringService.getPerformanceStats(periodHours);
      
      res.json({
        success: true,
        data: {
          ...stats,
          period: `${periodHours}h`,
          timestamp: new Date().toISOString()
        }
      });
    } catch (error) {
      logger.error('Error getting performance stats', { error: error.message });
      res.status(500).json({
        success: false,
        message: 'Failed to get performance statistics',
        error: error.message
      });
    }
  }

  /**
   * Get traffic overview for operators
   * GET /api/operator/traffic/overview
   */
  async getTrafficOverview(req, res) {
    try {
      const overview = await operatorAnalyticsService.getTrafficOverview();
      
      res.json({
        success: true,
        data: overview
      });
    } catch (error) {
      logger.error('Error getting traffic overview', { error: error.message });
      res.status(500).json({
        success: false,
        message: 'Failed to get traffic overview',
        error: error.message
      });
    }
  }

  /**
   * Start/stop system monitoring
   * POST /api/operator/system/monitoring/:action
   */
  async controlSystemMonitoring(req, res) {
    try {
      const { action } = req.params;
      const { interval } = req.body;
      
      if (action === 'start') {
        systemMonitoringService.startMonitoring(interval);
        await auditService.logAction({
          userId: req.user?.id,
          username: req.user?.username,
          action: 'monitoring_start',
          resource: 'system_monitoring',
          details: { interval }
        });
      } else if (action === 'stop') {
        systemMonitoringService.stopMonitoring();
        await auditService.logAction({
          userId: req.user?.id,
          username: req.user?.username,
          action: 'monitoring_stop',
          resource: 'system_monitoring'
        });
      } else {
        return res.status(400).json({
          success: false,
          message: 'Invalid action. Use "start" or "stop"'
        });
      }

      res.json({
        success: true,
        message: `System monitoring ${action}ed successfully`
      });
    } catch (error) {
      logger.error('Error controlling system monitoring', { error: error.message });
      res.status(500).json({
        success: false,
        message: 'Failed to control system monitoring',
        error: error.message
      });
    }
  }

  /**
   * Get system configuration status
   * GET /api/operator/system/config
   */
  async getSystemConfig(req, res) {
    try {
      const config = {
        monitoring: {
          isActive: systemMonitoringService.monitoringInterval !== null,
          interval: 30000 // default interval
        },
        sumo: {
          status: 'unknown', // Will be updated by monitoring service
          processId: null
        },
        database: {
          status: 'unknown' // Will be updated by monitoring service
        },
        environment: {
          nodeVersion: process.version,
          platform: process.platform,
          uptime: process.uptime(),
          memoryUsage: process.memoryUsage()
        }
      };

      // Get current metrics if monitoring is active
      if (config.monitoring.isActive) {
        const metrics = systemMonitoringService.getMetrics();
        config.sumo.status = metrics.application.sumo.status;
        config.sumo.processId = metrics.application.sumo.processId;
        config.database.status = metrics.application.database.status;
      }

      res.json({
        success: true,
        data: config
      });
    } catch (error) {
      logger.error('Error getting system config', { error: error.message });
      res.status(500).json({
        success: false,
        message: 'Failed to get system configuration',
        error: error.message
      });
    }
  }

  /**
   * Get operator activity summary
   * GET /api/operator/activity/summary
   */
  async getActivitySummary(req, res) {
    try {
      const { period = '24h' } = req.query;
      
      // This would typically fetch from audit logs
      const summary = {
        period,
        totalActions: Math.floor(Math.random() * 100) + 50,
        reportsGenerated: Math.floor(Math.random() * 10) + 5,
        alertsHandled: Math.floor(Math.random() * 20) + 10,
        systemChanges: Math.floor(Math.random() * 5) + 2,
        mostActiveHour: '14:00-15:00',
        lastActivity: new Date().toISOString()
      };

      res.json({
        success: true,
        data: summary
      });
    } catch (error) {
      logger.error('Error getting activity summary', { error: error.message });
      res.status(500).json({
        success: false,
        message: 'Failed to get activity summary',
        error: error.message
      });
    }
  }

  /**
   * Execute operator commands (advanced operations)
   * POST /api/operator/commands/execute
   */
  async executeCommand(req, res) {
    try {
      const { command, parameters = {} } = req.body;
      
      if (!command) {
        return res.status(400).json({
          success: false,
          message: 'Command is required'
        });
      }

      let result = {};
      
      switch (command) {
        case 'refresh_metrics':
          await systemMonitoringService.collectMetrics();
          result = { message: 'Metrics refreshed successfully' };
          break;
          
        case 'clear_cache':
          const cacheService = require('../services/cache.service');
          await cacheService.clear();
          result = { message: 'Cache cleared successfully' };
          break;
          
        case 'generate_diagnostics':
          result = {
            system: systemMonitoringService.getMetrics(),
            health: systemMonitoringService.getHealthSummary()
          };
          break;
          
        default:
          return res.status(400).json({
            success: false,
            message: `Unknown command: ${command}`
          });
      }

      // Log command execution
      await auditService.logAction({
        userId: req.user?.id,
        username: req.user?.username,
        action: 'command_execute',
        resource: 'operator_command',
        details: { command, parameters }
      });

      res.json({
        success: true,
        message: `Command '${command}' executed successfully`,
        data: result
      });
    } catch (error) {
      logger.error('Error executing operator command', { 
        error: error.message,
        command: req.body.command 
      });
      res.status(500).json({
        success: false,
        message: 'Failed to execute command',
        error: error.message
      });
    }
  }
}

module.exports = new OperatorController();