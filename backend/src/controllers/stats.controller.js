const statsService = require('../services/stats.service');
const logger = require('../utils/logger');

class StatsController {
  /**
   * Get KPIs
   * GET /api/reports/kpis
   */
  async getKPIs(req, res) {
    try {
      const { startDate, endDate } = req.query || {};
      const end = endDate ? new Date(endDate) : new Date();
      const start = startDate ? new Date(startDate) : new Date(end.getTime() - 24 * 60 * 60 * 1000);
      const kpis = await statsService.getKPIs({ start, end });
      res.json(kpis);
    } catch (error) {
      logger.error('Error in getKPIs', { error: error.message });
      res.status(500).json({
        message: 'Server error',
        error: error.message
      });
    }
  }

  /**
   * Get trends
   * GET /api/reports/trends
   */
  async getTrends(req, res) {
    try {
      const { startDate, endDate } = req.query || {};
      const end = endDate ? new Date(endDate) : new Date();
      const start = startDate ? new Date(startDate) : new Date(end.getTime() - 24 * 60 * 60 * 1000);
      const trends = await statsService.getTrends({ start, end });
      res.json(trends);
    } catch (error) {
      logger.error('Error in getTrends', { error: error.message });
      res.status(500).json({
        message: 'Server error',
        error: error.message
      });
    }
  }

  /**
   * Get system overview
   * GET /api/stats/overview
   */
  async getOverview(req, res) {
    try {
      const overview = await statsService.getOverview();
      res.json(overview);
    } catch (error) {
      logger.error('Error in getOverview', { error: error.message });
      res.status(500).json({
        message: 'Server error',
        error: error.message
      });
    }
  }

  /**
   * Get admin stats
   * GET /api/stats/admin
   */
  async getAdminStats(req, res) {
    try {
      const stats = await statsService.getAdminStats();
      res.json(stats);
    } catch (error) {
      logger.error('Error in getAdminStats', { error: error.message });
      res.status(500).json({
        message: 'Server error',
        error: error.message
      });
    }
  }
}

module.exports = new StatsController();
