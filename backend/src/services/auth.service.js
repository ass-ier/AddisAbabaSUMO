const userService = require('./user.service');
const { generateToken } = require('../middleware/auth');
const { AppError } = require('../middleware/errorHandler');
const logger = require('../utils/logger');

/**
 * Auth Service - Business Logic Layer (Tier 2)
 * Handles authentication and authorization logic
 */
class AuthService {
  /**
   * Login user
   * @param {string} username - Username
   * @param {string} password - Password
   * @returns {Promise<Object>} User and token
   */
  async login(username, password) {
    try {
      // Verify credentials using user service
      const user = await userService.verifyCredentials(username, password);

      // Generate JWT token
      const token = generateToken(user._id);

      logger.info(`User logged in: ${username} (${user.role})`);

      return {
        user,
        token
      };
    } catch (error) {
      logger.error('AuthService.login error:', error);
      throw error;
    }
  }

  /**
   * Register new user (public registration)
   * @param {Object} userData - User data
   * @returns {Promise<Object>} Created user and token
   */
  async register(userData) {
    try {
      // Default role for public registration
      const userWithRole = {
        ...userData,
        role: userData.role || 'analyst' // Default to analyst for safety
      };

      // Create user via user service
      const user = await userService.createUser(userWithRole);

      // Generate token
      const token = generateToken(user._id);

      logger.info(`New user registered: ${user.username} (${user.role})`);

      return {
        user,
        token
      };
    } catch (error) {
      logger.error('AuthService.register error:', error);
      throw error;
    }
  }

  /**
   * Logout user (optional - for token blacklisting if needed)
   * @param {string} userId - User ID
   * @returns {Promise<boolean>}
   */
  async logout(userId) {
    try {
      // In a stateless JWT system, logout is handled client-side
      // This method is here for future enhancements (token blacklist, etc.)
      logger.info(`User logged out: ${userId}`);
      return true;
    } catch (error) {
      logger.error('AuthService.logout error:', error);
      throw error;
    }
  }

  /**
   * Verify if a token is valid
   * @param {string} token - JWT token
   * @returns {Promise<Object>} Decoded token data
   */
  async verifyToken(token) {
    try {
      const jwt = require('jsonwebtoken');
      const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET || 'your-secret-key');
      return decoded;
    } catch (error) {
      throw new AppError('Invalid or expired token', 401);
    }
  }
}

module.exports = new AuthService();
