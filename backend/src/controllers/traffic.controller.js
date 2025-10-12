const trafficService = require('../services/traffic.service');
const logger = require('../utils/logger');

class TrafficController {
  /**
   * Create new traffic data entry
   * POST /api/traffic-data
   */
  async createTrafficData(req, res) {
    try {
      const {
        intersectionId,
        trafficFlow,
        signalStatus,
        vehicleCount,
        averageSpeed
      } = req.body;

      // Validate required fields
      if (!intersectionId || trafficFlow === undefined || !signalStatus) {
        return res.status(400).json({
          message: 'intersectionId, trafficFlow, and signalStatus are required'
        });
      }

      const trafficData = await trafficService.createTrafficData({
        intersectionId,
        trafficFlow,
        signalStatus,
        vehicleCount,
        averageSpeed
      });

      // Emit real-time data via socket.io if available
      if (req.app.io) {
        req.app.io.emit('trafficData', trafficData);
      }

      res.status(201).json({
        message: 'Traffic data saved successfully',
        data: trafficData
      });
    } catch (error) {
      logger.error('Error in createTrafficData', { error: error.message });
      res.status(500).json({
        message: 'Server error',
        error: error.message
      });
    }
  }

  /**
   * Get traffic data with optional filters
   * GET /api/traffic-data
   */
  async getTrafficData(req, res) {
    try {
      const { intersectionId, startDate, endDate, limit } = req.query;

      const trafficData = await trafficService.getTrafficData({
        intersectionId,
        startDate,
        endDate,
        limit: limit ? parseInt(limit) : 100
      });

      res.json(trafficData);
    } catch (error) {
      logger.error('Error in getTrafficData', { error: error.message });
      res.status(500).json({
        message: 'Server error',
        error: error.message
      });
    }
  }

  /**
   * Export traffic data to CSV
   * GET /api/traffic-data/export.csv
   */
  async exportTrafficDataCSV(req, res) {
    try {
      const { intersectionId, startDate, endDate, limit } = req.query;

      const csv = await trafficService.exportToCSV({
        intersectionId,
        startDate,
        endDate,
        limit: limit ? parseInt(limit) : 1000
      });

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename=traffic-data.csv');
      res.send(csv);
    } catch (error) {
      logger.error('Error in exportTrafficDataCSV', { error: error.message });
      res.status(500).json({
        message: 'Server error',
        error: error.message
      });
    }
  }

  /**
   * Get traffic statistics
   * GET /api/traffic-data/stats
   */
  async getStatistics(req, res) {
    try {
      const { intersectionId, startDate, endDate, limit } = req.query;

      const stats = await trafficService.getStatistics({
        intersectionId,
        startDate,
        endDate,
        limit: limit ? parseInt(limit) : 100
      });

      res.json(stats);
    } catch (error) {
      logger.error('Error in getStatistics', { error: error.message });
      res.status(500).json({
        message: 'Server error',
        error: error.message
      });
    }
  }
}

module.exports = new TrafficController();
