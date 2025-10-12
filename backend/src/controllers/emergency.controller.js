const emergencyService = require('../services/emergency.service');
const logger = require('../utils/logger');

class EmergencyController {
  /**
   * Create new emergency
   * POST /api/emergencies
   */
  async createEmergency(req, res) {
    try {
      const emergency = await emergencyService.createEmergency(req.body || {});
      res.status(201).json({ ok: true, item: emergency });
    } catch (error) {
      logger.error('Error in createEmergency', { error: error.message });
      res.status(500).json({
        message: 'Server error',
        error: error.message
      });
    }
  }

  /**
   * Get active emergencies
   * GET /api/emergencies
   */
  async getActiveEmergencies(req, res) {
    try {
      const result = await emergencyService.getActiveEmergencies();
      res.json(result);
    } catch (error) {
      logger.error('Error in getActiveEmergencies', { error: error.message });
      res.status(500).json({
        message: 'Server error',
        error: error.message
      });
    }
  }

  /**
   * Force clear emergency (deactivate)
   * POST /api/emergencies/:id/force-clear
   */
  async forceClearEmergency(req, res) {
    try {
      const emergency = await emergencyService.forceClearEmergency(req.params.id);
      res.json({ ok: true, item: emergency });
    } catch (error) {
      logger.error('Error in forceClearEmergency', { error: error.message });
      res.status(500).json({
        message: 'Server error',
        error: error.message
      });
    }
  }
}

module.exports = new EmergencyController();
