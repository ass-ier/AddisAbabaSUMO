const settingsRepository = require('../repositories/settings.repository');
const cacheService = require('./cache.service');
const logger = require('../utils/logger');

class SettingsService {
  /**
   * Get settings with caching
   */
  async getSettings() {
    try {
      const cacheKey = 'system_settings';
      
      // Try to get from cache
      const cached = await cacheService.get(cacheKey);
      if (cached) {
        logger.info('Serving settings from cache');
        return cached;
      }

      // Fetch from database
      const settings = await settingsRepository.get();
      
      // Cache indefinitely until update
      await cacheService.set(cacheKey, settings);
      
      logger.info('Settings fetched from database');
      return settings;
    } catch (error) {
      logger.error('Error getting settings', { error: error.message });
      throw error;
    }
  }

  /**
   * Update settings
   */
  async updateSettings(data) {
    try {
      const settings = await settingsRepository.update(data);
      
      // Invalidate cache
      await cacheService.delete('system_settings');
      
      logger.info('Settings updated');
      return settings;
    } catch (error) {
      logger.error('Error updating settings', { error: error.message });
      throw error;
    }
  }

  /**
   * Update specific setting field
   */
  async updateField(field, value) {
    try {
      const settings = await settingsRepository.updateField(field, value);
      
      // Invalidate cache
      await cacheService.delete('system_settings');
      
      logger.info('Settings field updated', { field });
      return settings;
    } catch (error) {
      logger.error('Error updating settings field', { error: error.message, field });
      throw error;
    }
  }
}

module.exports = new SettingsService();
