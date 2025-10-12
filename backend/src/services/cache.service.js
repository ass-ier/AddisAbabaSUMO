const logger = require('../utils/logger');

/**
 * Cache Service - Business Logic Layer
 * Handles caching with Redis fallback to memory
 */
class CacheService {
  constructor() {
    this.memoryCache = new Map();
    this.redisClient = null;
  }

  /**
   * Initialize Redis client
   * @param {Object} client - Redis client instance
   */
  init(client) {
    this.redisClient = client;
    logger.info('Cache service initialized');
  }

  /**
   * Get value from cache
   * @param {string} key - Cache key
   * @returns {Promise<any>} Cached value or null
   */
  async get(key) {
    try {
      // Try Redis first
      if (this.redisClient) {
        const value = await this.redisClient.get(key);
        if (value) {
          logger.debug(`Cache HIT (Redis): ${key}`);
          return JSON.parse(value);
        }
      }

      // Fallback to memory cache
      if (this.memoryCache.has(key)) {
        const cached = this.memoryCache.get(key);
        if (cached.expiresAt > Date.now()) {
          logger.debug(`Cache HIT (Memory): ${key}`);
          return cached.value;
        } else {
          this.memoryCache.delete(key);
        }
      }

      logger.debug(`Cache MISS: ${key}`);
      return null;
    } catch (error) {
      logger.error(`Cache GET error for ${key}:`, error);
      return null;
    }
  }

  /**
   * Set value in cache
   * @param {string} key - Cache key
   * @param {any} value - Value to cache
   * @param {number} ttl - Time to live in seconds (0 = no expiration)
   * @returns {Promise<boolean>} Success status
   */
  async set(key, value, ttl = 300) {
    try {
      const serialized = JSON.stringify(value);

      // Try Redis first
      if (this.redisClient) {
        if (ttl > 0) {
          await this.redisClient.setex(key, ttl, serialized);
        } else {
          await this.redisClient.set(key, serialized);
        }
        logger.debug(`Cache SET (Redis): ${key} (TTL: ${ttl}s)`);
        return true;
      }

      // Fallback to memory cache
      this.memoryCache.set(key, {
        value,
        expiresAt: ttl > 0 ? Date.now() + (ttl * 1000) : Infinity
      });
      logger.debug(`Cache SET (Memory): ${key} (TTL: ${ttl}s)`);
      return true;
    } catch (error) {
      logger.error(`Cache SET error for ${key}:`, error);
      return false;
    }
  }

  /**
   * Delete value from cache
   * @param {string} key - Cache key
   * @returns {Promise<boolean>} Success status
   */
  async del(key) {
    try {
      // Try Redis first
      if (this.redisClient) {
        await this.redisClient.del(key);
        logger.debug(`Cache DEL (Redis): ${key}`);
      }

      // Also delete from memory cache
      this.memoryCache.delete(key);
      logger.debug(`Cache DEL (Memory): ${key}`);
      return true;
    } catch (error) {
      logger.error(`Cache DEL error for ${key}:`, error);
      return false;
    }
  }

  /**
   * Delete multiple keys matching pattern
   * @param {string} pattern - Key pattern (e.g., 'users:*')
   * @returns {Promise<number>} Number of keys deleted
   */
  async delPattern(pattern) {
    try {
      let count = 0;

      // Redis pattern deletion
      if (this.redisClient) {
        const keys = await this.redisClient.keys(pattern);
        if (keys.length > 0) {
          count += await this.redisClient.del(...keys);
          logger.debug(`Cache DEL Pattern (Redis): ${pattern} (${count} keys)`);
        }
      }

      // Memory cache pattern deletion
      const regex = new RegExp('^' + pattern.replace('*', '.*') + '$');
      for (const key of this.memoryCache.keys()) {
        if (regex.test(key)) {
          this.memoryCache.delete(key);
          count++;
        }
      }

      logger.debug(`Cache DEL Pattern: ${pattern} (${count} keys)`);
      return count;
    } catch (error) {
      logger.error(`Cache DEL Pattern error for ${pattern}:`, error);
      return 0;
    }
  }

  /**
   * Clear all cache
   * @returns {Promise<void>}
   */
  async clear() {
    try {
      if (this.redisClient) {
        await this.redisClient.flushdb();
        logger.info('Cache cleared (Redis)');
      }
      this.memoryCache.clear();
      logger.info('Cache cleared (Memory)');
    } catch (error) {
      logger.error('Cache CLEAR error:', error);
    }
  }

  /**
   * Get cache statistics
   * @returns {Object} Cache stats
   */
  getStats() {
    return {
      memoryKeys: this.memoryCache.size,
      redisConnected: !!this.redisClient
    };
  }
}

module.exports = new CacheService();
