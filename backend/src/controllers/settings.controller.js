const settingsService = require('../services/settings.service');
const logger = require('../utils/logger');

class SettingsController {
  /**
   * Get settings
   * GET /api/settings
   */
  async getSettings(req, res) {
    try {
      const settings = await settingsService.getSettings();
      res.json(settings);
    } catch (error) {
      logger.error('Error in getSettings', { error: error.message });
      res.status(500).json({
        message: 'Server error',
        error: error.message
      });
    }
  }

  /**
   * Update settings
   * PUT /api/settings
   */
  async updateSettings(req, res) {
    try {
      const settings = await settingsService.updateSettings(req.body || {});
      res.json(settings);
    } catch (error) {
      logger.error('Error in updateSettings', { error: error.message });
      res.status(500).json({
        message: 'Server error',
        error: error.message
      });
    }
  }
}

module.exports = new SettingsController();
