const User = require('../models/User');
const logger = require('../utils/logger');

/**
 * User Repository - Data Access Layer (Tier 3)
 * Handles all database operations for users
 * NO business logic - pure database operations only
 */
class UserRepository {
  /**
   * Find user by ID
   * @param {string} id - User ID
   * @returns {Promise<Object|null>} User object without password
   */
  async findById(id) {
    try {
      return await User.findById(id).select('-password');
    } catch (error) {
      logger.error('UserRepository.findById error:', error);
      throw error;
    }
  }

  /**
   * Find user by username
   * @param {string} username - Username
   * @param {boolean} includePassword - Whether to include password field
   * @returns {Promise<Object|null>} User object
   */
  async findByUsername(username, includePassword = false) {
    try {
      const query = User.findOne({ username: username.toLowerCase() });
      if (!includePassword) {
        query.select('-password');
      }
      return await query;
    } catch (error) {
      logger.error('UserRepository.findByUsername error:', error);
      throw error;
    }
  }

  /**
   * Create new user
   * @param {Object} userData - User data
   * @returns {Promise<Object>} Created user without password
   */
  async create(userData) {
    try {
      const user = new User(userData);
      const saved = await user.save();
      // Return without password
      return saved.toJSON();
    } catch (error) {
      logger.error('UserRepository.create error:', error);
      throw error;
    }
  }

  /**
   * Update user by ID
   * @param {string} id - User ID
   * @param {Object} updates - Fields to update
   * @returns {Promise<Object|null>} Updated user without password
   */
  async update(id, updates) {
    try {
      const user = await User.findByIdAndUpdate(
        id,
        { ...updates, updatedAt: Date.now() },
        { new: true, runValidators: true }
      ).select('-password');
      return user;
    } catch (error) {
      logger.error('UserRepository.update error:', error);
      throw error;
    }
  }

  /**
   * Delete user by ID
   * @param {string} id - User ID
   * @returns {Promise<Object|null>} Deleted user
   */
  async delete(id) {
    try {
      return await User.findByIdAndDelete(id);
    } catch (error) {
      logger.error('UserRepository.delete error:', error);
      throw error;
    }
  }

  /**
   * Find all users with optional filters
   * @param {Object} filters - Query filters
   * @param {Object} options - Query options (limit, skip, sort)
   * @returns {Promise<Array>} Array of users without passwords
   */
  async findAll(filters = {}, options = {}) {
    try {
      const {
        limit = 100,
        skip = 0,
        sort = { createdAt: -1 }
      } = options;

      return await User
        .find(filters)
        .select('-password')
        .sort(sort)
        .limit(limit)
        .skip(skip);
    } catch (error) {
      logger.error('UserRepository.findAll error:', error);
      throw error;
    }
  }

  /**
   * Count users matching filters
   * @param {Object} filters - Query filters
   * @returns {Promise<number>} Count of matching users
   */
  async count(filters = {}) {
    try {
      return await User.countDocuments(filters);
    } catch (error) {
      logger.error('UserRepository.count error:', error);
      throw error;
    }
  }

  /**
   * Find users by role
   * @param {string} role - User role
   * @returns {Promise<Array>} Array of users with that role
   */
  async findByRole(role) {
    try {
      return await User.find({ role, isActive: true }).select('-password');
    } catch (error) {
      logger.error('UserRepository.findByRole error:', error);
      throw error;
    }
  }

  /**
   * Update last login timestamp
   * @param {string} id - User ID
   * @returns {Promise<Object|null>} Updated user
   */
  async updateLastLogin(id) {
    try {
      return await User.findByIdAndUpdate(
        id,
        { lastLogin: Date.now() },
        { new: true }
      ).select('-password');
    } catch (error) {
      logger.error('UserRepository.updateLastLogin error:', error);
      throw error;
    }
  }

  /**
   * Check if user exists
   * @param {string} username - Username
   * @returns {Promise<boolean>} True if user exists
   */
  async exists(username) {
    try {
      const count = await User.countDocuments({ username: username.toLowerCase() });
      return count > 0;
    } catch (error) {
      logger.error('UserRepository.exists error:', error);
      throw error;
    }
  }

  /**
   * Soft delete user (set isActive to false)
   * @param {string} id - User ID
   * @returns {Promise<Object|null>} Updated user
   */
  async softDelete(id) {
    try {
      return await User.findByIdAndUpdate(
        id,
        { isActive: false, updatedAt: Date.now() },
        { new: true }
      ).select('-password');
    } catch (error) {
      logger.error('UserRepository.softDelete error:', error);
      throw error;
    }
  }

  /**
   * Find all system operators
   * @param {boolean} activeOnly - Whether to return only active operators
   * @returns {Promise<Array>} Array of system operators
   */
  async findOperators(activeOnly = true) {
    try {
      const filters = { role: 'system_operator' };
      if (activeOnly) {
        filters.isActive = true;
      }
      return await User.find(filters).select('-password').sort({ username: 1 });
    } catch (error) {
      logger.error('UserRepository.findOperators error:', error);
      throw error;
    }
  }

  /**
   * Find all admin users (admin and super_admin)
   * @param {boolean} activeOnly - Whether to return only active admins
   * @returns {Promise<Array>} Array of admin users
   */
  async findAdmins(activeOnly = true) {
    try {
      const filters = { role: { $in: ['admin', 'super_admin'] } };
      if (activeOnly) {
        filters.isActive = true;
      }
      return await User.find(filters).select('-password').sort({ role: 1, username: 1 });
    } catch (error) {
      logger.error('UserRepository.findAdmins error:', error);
      throw error;
    }
  }

  /**
   * Get user statistics by role
   * @returns {Promise<Object>} Statistics object with counts by role
   */
  async getRoleStatistics() {
    try {
      const stats = await User.aggregate([
        { $match: { isActive: true } },
        {
          $group: {
            _id: '$role',
            count: { $sum: 1 }
          }
        },
        { $sort: { _id: 1 } }
      ]);

      // Convert to object format
      const result = {
        total: 0,
        super_admin: 0,
        admin: 0,
        system_operator: 0,
        user: 0
      };

      stats.forEach(stat => {
        result[stat._id] = stat.count;
        result.total += stat.count;
      });

      return result;
    } catch (error) {
      logger.error('UserRepository.getRoleStatistics error:', error);
      throw error;
    }
  }

  /**
   * Update user role
   * @param {string} id - User ID
   * @param {string} role - New role
   * @returns {Promise<Object|null>} Updated user
   */
  async updateRole(id, role) {
    try {
      return await User.findByIdAndUpdate(
        id,
        { role, updatedAt: Date.now() },
        { new: true, runValidators: true }
      ).select('-password');
    } catch (error) {
      logger.error('UserRepository.updateRole error:', error);
      throw error;
    }
  }

  /**
   * Find users with elevated privileges (admin, super_admin, system_operator)
   * @param {boolean} activeOnly - Whether to return only active users
   * @returns {Promise<Array>} Array of privileged users
   */
  async findPrivilegedUsers(activeOnly = true) {
    try {
      const filters = { role: { $in: ['super_admin', 'admin', 'system_operator'] } };
      if (activeOnly) {
        filters.isActive = true;
      }
      return await User.find(filters)
        .select('-password')
        .sort({ role: 1, username: 1 });
    } catch (error) {
      logger.error('UserRepository.findPrivilegedUsers error:', error);
      throw error;
    }
  }
}

module.exports = new UserRepository();
