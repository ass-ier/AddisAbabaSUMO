const emergencyRepository = require('../repositories/emergency.repository');
const cacheService = require('./cache.service');
const logger = require('../utils/logger');

class EmergencyService {
  /**
   * Create new emergency
   */
  async createEmergency(data) {
    try {
      const emergency = await emergencyRepository.create(data);
      
      // Invalidate active emergencies cache
      await this.invalidateCache();
      
      logger.info('Emergency created', { vehicleId: data.vehicleId });
      return emergency;
    } catch (error) {
      logger.error('Error creating emergency', { error: error.message });
      throw error;
    }
  }

  /**
   * Get active emergencies with caching
   */
  async getActiveEmergencies() {
    try {
      const cacheKey = 'active_emergencies';
      
      // Try to get from cache
      const cached = await cacheService.get(cacheKey);
      if (cached) {
        logger.info('Serving active emergencies from cache');
        return cached;
      }

      // Fetch from database
      const emergencies = await emergencyRepository.findActive();
      const result = { items: emergencies };
      
      // Cache for 10 seconds
      await cacheService.set(cacheKey, result, 10);
      
      logger.info('Active emergencies fetched from database', { count: emergencies.length });
      return result;
    } catch (error) {
      logger.error('Error getting active emergencies', { error: error.message });
      throw error;
    }
  }

  /**
   * Get all emergencies
   */
  async getAllEmergencies(options = {}) {
    try {
      return await emergencyRepository.findAll(options);
    } catch (error) {
      logger.error('Error getting all emergencies', { error: error.message });
      throw error;
    }
  }

  /**
   * Get emergency by ID
   */
  async getEmergencyById(id) {
    try {
      const emergency = await emergencyRepository.findById(id);
      if (!emergency) {
        throw new Error('Emergency not found');
      }
      return emergency;
    } catch (error) {
      logger.error('Error getting emergency by ID', { error: error.message, id });
      throw error;
    }
  }

  /**
   * Update emergency
   */
  async updateEmergency(id, data) {
    try {
      const emergency = await emergencyRepository.update(id, data);
      
      // Invalidate cache
      await this.invalidateCache();
      
      logger.info('Emergency updated', { id });
      return emergency;
    } catch (error) {
      logger.error('Error updating emergency', { error: error.message, id });
      throw error;
    }
  }

  /**
   * Force clear emergency (deactivate)
   */
  async forceClearEmergency(id) {
    try {
      const emergency = await emergencyRepository.deactivate(id);
      
      // Invalidate cache
      await this.invalidateCache();
      
      logger.info('Emergency force cleared', { id });
      return emergency;
    } catch (error) {
      logger.error('Error force clearing emergency', { error: error.message, id });
      throw error;
    }
  }

  /**
   * Delete emergency
   */
  async deleteEmergency(id) {
    try {
      await emergencyRepository.delete(id);
      
      // Invalidate cache
      await this.invalidateCache();
      
      logger.info('Emergency deleted', { id });
      return { ok: true };
    } catch (error) {
      logger.error('Error deleting emergency', { error: error.message, id });
      throw error;
    }
  }

  /**
   * Count active emergencies
   */
  async countActive() {
    try {
      return await emergencyRepository.countActive();
    } catch (error) {
      logger.error('Error counting active emergencies', { error: error.message });
      throw error;
    }
  }

  /**
   * Invalidate emergency cache
   */
  async invalidateCache() {
    try {
      await cacheService.delete('active_emergencies');
    } catch (error) {
      logger.warn('Cache invalidation failed', { error: error.message });
    }
  }
}

module.exports = new EmergencyService();
