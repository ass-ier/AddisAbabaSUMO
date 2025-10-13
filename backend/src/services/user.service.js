const bcrypt = require('bcryptjs');
const userRepository = require('../repositories/user.repository');
const cacheService = require('./cache.service');
const { AppError } = require('../middleware/errorHandler');
const logger = require('../utils/logger');

/**
 * User Service - Business Logic Layer (Tier 2)
 * Handles all user-related business logic
 * NO HTTP handling - pure business logic only
 */
class UserService {
  /**
   * Create a new user
   * @param {Object} userData - User data (username, password, role, region)
   * @returns {Promise<Object>} Created user
   */
  async createUser(userData) {
    try {
      // Business validation: check if user already exists
      const existingUser = await userRepository.findByUsername(userData.username);
      if (existingUser) {
        throw new AppError('Username already exists', 400);
      }

      // Business logic: validate password strength
      if (userData.password.length < 6) {
        throw new AppError('Password must be at least 6 characters long', 400);
      }

      // Business logic: hash password
      const hashedPassword = await bcrypt.hash(userData.password, 10);

      // Create user with hashed password
      const user = await userRepository.create({
        ...userData,
        password: hashedPassword
      });

      // Invalidate users cache
      await cacheService.del('users:list');

      logger.info(`User created: ${user.username} (${user.role})`);
      return user;
    } catch (error) {
      logger.error('UserService.createUser error:', error);
      throw error;
    }
  }

  /**
   * Get user by ID
   * @param {string} id - User ID
   * @returns {Promise<Object>} User object
   */
  async getUserById(id) {
    try {
      // Try cache first
      const cacheKey = `user:${id}`;
      const cached = await cacheService.get(cacheKey);
      if (cached) {
        logger.debug(`User retrieved from cache: ${id}`);
        return cached;
      }

      // Get from database
      const user = await userRepository.findById(id);
      if (!user) {
        throw new AppError('User not found', 404);
      }

      // Cache result (5 minutes)
      await cacheService.set(cacheKey, user, 300);

      return user;
    } catch (error) {
      logger.error('UserService.getUserById error:', error);
      throw error;
    }
  }

  /**
   * Get user by username
   * @param {string} username - Username
   * @returns {Promise<Object>} User object
   */
  async getUserByUsername(username) {
    try {
      const user = await userRepository.findByUsername(username);
      if (!user) {
        throw new AppError('User not found', 404);
      }
      return user;
    } catch (error) {
      logger.error('UserService.getUserByUsername error:', error);
      throw error;
    }
  }

  /**
   * Get all users with optional filters
   * @param {Object} filters - Query filters (role, isActive, etc.)
   * @param {Object} options - Query options (limit, skip, sort)
   * @returns {Promise<Object>} Users array and metadata
   */
  async getAllUsers(filters = {}, options = {}) {
    try {
      // Try cache first (only for default query)
      if (Object.keys(filters).length === 0 && Object.keys(options).length === 0) {
        const cached = await cacheService.get('users:list');
        if (cached) {
          logger.debug('Users list retrieved from cache');
          return cached;
        }
      }

      // Get from database
      const users = await userRepository.findAll(filters, options);
      const total = await userRepository.count(filters);

      const result = {
        users,
        total,
        page: Math.floor((options.skip || 0) / (options.limit || 100)) + 1,
        limit: options.limit || 100
      };

      // Cache default query result (2 minutes)
      if (Object.keys(filters).length === 0 && Object.keys(options).length === 0) {
        await cacheService.set('users:list', result, 120);
      }

      return result;
    } catch (error) {
      logger.error('UserService.getAllUsers error:', error);
      throw error;
    }
  }

  /**
   * Get users by role
   * @param {string} role - User role
   * @returns {Promise<Array>} Array of users
   */
  async getUsersByRole(role) {
    try {
      // Validate role
      const validRoles = ['operator', 'analyst', 'super_admin'];
      if (!validRoles.includes(role)) {
        throw new AppError('Invalid role', 400);
      }

      const users = await userRepository.findByRole(role);
      return users;
    } catch (error) {
      logger.error('UserService.getUsersByRole error:', error);
      throw error;
    }
  }

  /**
   * Update user
   * @param {string} id - User ID
   * @param {Object} updates - Fields to update
   * @param {Object} currentUser - Current authenticated user
   * @returns {Promise<Object>} Updated user
   */
  async updateUser(id, updates, currentUser) {
    try {
      // Business validation: check if user exists
      const existingUser = await userRepository.findById(id);
      if (!existingUser) {
        throw new AppError('User not found', 404);
      }

      // Business rule: Only super_admin can change roles
      if (updates.role && currentUser.role !== 'super_admin') {
        throw new AppError('Only super admins can change user roles', 403);
      }

      // Business rule: Users can only update their own data (except super_admin)
      if (currentUser.role !== 'super_admin' && currentUser._id.toString() !== id) {
        throw new AppError('You can only update your own profile', 403);
      }

      // Business logic: hash password if being updated
      if (updates.password) {
        if (updates.password.length < 6) {
          throw new AppError('Password must be at least 6 characters long', 400);
        }
        updates.password = await bcrypt.hash(updates.password, 10);
      }

      // Business validation: check username uniqueness if changing
      if (updates.username && updates.username !== existingUser.username) {
        const usernameTaken = await userRepository.exists(updates.username);
        if (usernameTaken) {
          throw new AppError('Username already exists', 400);
        }
      }

      // Update user
      const user = await userRepository.update(id, updates);

      // Invalidate caches
      await cacheService.del(`user:${id}`);
      await cacheService.del('users:list');

      logger.info(`User updated: ${user.username} by ${currentUser.username}`);
      return user;
    } catch (error) {
      logger.error('UserService.updateUser error:', error);
      throw error;
    }
  }

  /**
   * Delete user
   * @param {string} id - User ID
   * @param {Object} currentUser - Current authenticated user
   * @returns {Promise<Object>} Deleted user
   */
  async deleteUser(id, currentUser) {
    try {
      // Business validation: check if user exists
      const user = await userRepository.findById(id);
      if (!user) {
        throw new AppError('User not found', 404);
      }

      // Business rule: Cannot delete yourself
      if (currentUser._id.toString() === id) {
        throw new AppError('You cannot delete your own account', 400);
      }

      // Business rule: Only super_admin can delete users
      if (currentUser.role !== 'super_admin') {
        throw new AppError('Only super admins can delete users', 403);
      }

      // Soft delete (preserve data but deactivate)
      const deleted = await userRepository.softDelete(id);

      // Invalidate caches
      await cacheService.del(`user:${id}`);
      await cacheService.del('users:list');

      logger.warn(`User deleted: ${user.username} by ${currentUser.username}`);
      return deleted;
    } catch (error) {
      logger.error('UserService.deleteUser error:', error);
      throw error;
    }
  }

  /**
   * Update user's last login timestamp
   * @param {string} id - User ID
   * @returns {Promise<Object>} Updated user
   */
  async updateLastLogin(id) {
    try {
      const user = await userRepository.updateLastLogin(id);
      if (!user) {
        throw new AppError('User not found', 404);
      }

      // Invalidate user cache
      await cacheService.del(`user:${id}`);

      return user;
    } catch (error) {
      logger.error('UserService.updateLastLogin error:', error);
      throw error;
    }
  }

  /**
   * Verify user credentials (for authentication)
   * @param {string} username - Username
   * @param {string} password - Plain text password
   * @returns {Promise<Object>} User object if credentials are valid
   */
  async verifyCredentials(username, password) {
    try {
      // Get user with password included
      const user = await userRepository.findByUsername(username, true);
      if (!user) {
        throw new AppError('Invalid credentials', 401);
      }

      // Business validation: check if user is active
      if (!user.isActive) {
        throw new AppError('Account is deactivated', 403);
      }

      // Business logic: verify password
      const isPasswordValid = await bcrypt.compare(password, user.password);
      if (!isPasswordValid) {
        throw new AppError('Invalid credentials', 401);
      }

      // Update last login
      await this.updateLastLogin(user._id);

      // Remove password from returned object
      const { password: _, ...userWithoutPassword } = user.toObject();
      return userWithoutPassword;
    } catch (error) {
      logger.error('UserService.verifyCredentials error:', error);
      throw error;
    }
  }

  /**
   * Get total user count
   * @returns {Promise<number>} Total user count
   */
  async getUserCount() {
    try {
      // Try cache first
      const cached = await cacheService.get('users:count');
      if (cached) {
        return cached;
      }

      const count = await userRepository.count();

      // Cache for 1 hour
      await cacheService.set('users:count', count, 3600);

      return count;
    } catch (error) {
      logger.error('UserService.getUserCount error:', error);
      throw error;
    }
  }

  /**
   * Get user statistics
   * @returns {Promise<Object>} User statistics
   */
  async getUserStats() {
    try {
      // Try cache first
      const cached = await cacheService.get('users:stats');
      if (cached) {
        return cached;
      }

      const total = await userRepository.count();
      const active = await userRepository.count({ isActive: true });
      const byRole = {
        operator: await userRepository.count({ role: 'operator' }),
        analyst: await userRepository.count({ role: 'analyst' }),
        super_admin: await userRepository.count({ role: 'super_admin' })
      };

      const stats = {
        total,
        active,
        inactive: total - active,
        byRole
      };

      // Cache for 5 minutes
      await cacheService.set('users:stats', stats, 300);

      return stats;
    } catch (error) {
      logger.error('UserService.getUserStats error:', error);
      throw error;
    }
  }
}

module.exports = new UserService();
