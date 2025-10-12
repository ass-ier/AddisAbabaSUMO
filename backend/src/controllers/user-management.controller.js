const userRepository = require('../repositories/user.repository');
const auditService = require('../services/audit.service');
const logger = require('../utils/logger');

/**
 * User Management Controller
 * Enhanced controller for operator-level user management
 */
class UserManagementController {
  /**
   * Get user statistics and overview
   * GET /api/operator/users/statistics
   */
  async getUserStatistics(req, res) {
    try {
      const stats = await userRepository.getRoleStatistics();
      
      // Additional statistics
      const totalUsers = await userRepository.count();
      const activeUsers = await userRepository.count({ isActive: true });
      const inactiveUsers = totalUsers - activeUsers;
      
      const response = {
        ...stats,
        active: activeUsers,
        inactive: inactiveUsers,
        timestamp: new Date().toISOString()
      };

      res.json({
        success: true,
        data: response
      });
    } catch (error) {
      logger.error('Error getting user statistics', { error: error.message });
      res.status(500).json({
        success: false,
        message: 'Failed to get user statistics',
        error: error.message
      });
    }
  }

  /**
   * Get all system operators
   * GET /api/operator/users/operators
   */
  async getOperators(req, res) {
    try {
      const { includeInactive = false } = req.query;
      const operators = await userRepository.findOperators(!includeInactive);

      res.json({
        success: true,
        data: {
          operators,
          count: operators.length
        }
      });
    } catch (error) {
      logger.error('Error getting operators', { error: error.message });
      res.status(500).json({
        success: false,
        message: 'Failed to get operators',
        error: error.message
      });
    }
  }

  /**
   * Get all admin users
   * GET /api/operator/users/admins
   */
  async getAdmins(req, res) {
    try {
      const { includeInactive = false } = req.query;
      const admins = await userRepository.findAdmins(!includeInactive);

      res.json({
        success: true,
        data: {
          admins,
          count: admins.length
        }
      });
    } catch (error) {
      logger.error('Error getting admins', { error: error.message });
      res.status(500).json({
        success: false,
        message: 'Failed to get admins',
        error: error.message
      });
    }
  }

  /**
   * Get all privileged users (admins and operators)
   * GET /api/operator/users/privileged
   */
  async getPrivilegedUsers(req, res) {
    try {
      const { includeInactive = false } = req.query;
      const users = await userRepository.findPrivilegedUsers(!includeInactive);

      // Group by role for easier frontend handling
      const grouped = users.reduce((acc, user) => {
        if (!acc[user.role]) {
          acc[user.role] = [];
        }
        acc[user.role].push(user);
        return acc;
      }, {});

      res.json({
        success: true,
        data: {
          users,
          grouped,
          totalCount: users.length,
          counts: {
            super_admin: (grouped.super_admin || []).length,
            admin: (grouped.admin || []).length,
            system_operator: (grouped.system_operator || []).length
          }
        }
      });
    } catch (error) {
      logger.error('Error getting privileged users', { error: error.message });
      res.status(500).json({
        success: false,
        message: 'Failed to get privileged users',
        error: error.message
      });
    }
  }

  /**
   * Update user role (operators can manage regular users)
   * PUT /api/operator/users/:userId/role
   */
  async updateUserRole(req, res) {
    try {
      const { userId } = req.params;
      const { role } = req.body;
      const operator = req.user;

      // Validate role
      const validRoles = ['user', 'system_operator'];
      
      // Super admins can assign any role except super_admin
      if (operator.role === 'super_admin') {
        validRoles.push('admin');
      }
      
      // System operators cannot promote users to admin or super_admin
      if (!validRoles.includes(role)) {
        return res.status(403).json({
          success: false,
          message: `You cannot assign the role: ${role}`
        });
      }

      // Get the target user to check current role
      const targetUser = await userRepository.findById(userId);
      if (!targetUser) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      // Prevent operators from modifying admin/super_admin accounts
      if (['admin', 'super_admin'].includes(targetUser.role) && operator.role !== 'super_admin') {
        return res.status(403).json({
          success: false,
          message: 'You cannot modify admin accounts'
        });
      }

      // Prevent users from changing their own role
      if (userId === operator._id.toString()) {
        return res.status(403).json({
          success: false,
          message: 'You cannot change your own role'
        });
      }

      const updatedUser = await userRepository.updateRole(userId, role);

      // Log the role change
      await auditService.logAction({
        userId: operator._id,
        username: operator.username,
        action: 'user_role_change',
        resource: 'user_management',
        details: {
          targetUserId: userId,
          targetUsername: targetUser.username,
          oldRole: targetUser.role,
          newRole: role
        }
      });

      res.json({
        success: true,
        message: `User role updated to ${role}`,
        data: updatedUser
      });
    } catch (error) {
      logger.error('Error updating user role', { error: error.message });
      res.status(500).json({
        success: false,
        message: 'Failed to update user role',
        error: error.message
      });
    }
  }

  /**
   * Deactivate user account
   * PUT /api/operator/users/:userId/deactivate
   */
  async deactivateUser(req, res) {
    try {
      const { userId } = req.params;
      const operator = req.user;

      // Get the target user
      const targetUser = await userRepository.findById(userId);
      if (!targetUser) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      // Prevent operators from deactivating admin/super_admin accounts
      if (['admin', 'super_admin'].includes(targetUser.role) && operator.role !== 'super_admin') {
        return res.status(403).json({
          success: false,
          message: 'You cannot deactivate admin accounts'
        });
      }

      // Prevent users from deactivating themselves
      if (userId === operator._id.toString()) {
        return res.status(403).json({
          success: false,
          message: 'You cannot deactivate your own account'
        });
      }

      // Check if user is already inactive
      if (!targetUser.isActive) {
        return res.status(400).json({
          success: false,
          message: 'User is already deactivated'
        });
      }

      const updatedUser = await userRepository.softDelete(userId);

      // Log the deactivation
      await auditService.logAction({
        userId: operator._id,
        username: operator.username,
        action: 'user_deactivate',
        resource: 'user_management',
        details: {
          targetUserId: userId,
          targetUsername: targetUser.username,
          targetRole: targetUser.role
        }
      });

      res.json({
        success: true,
        message: 'User account deactivated successfully',
        data: updatedUser
      });
    } catch (error) {
      logger.error('Error deactivating user', { error: error.message });
      res.status(500).json({
        success: false,
        message: 'Failed to deactivate user',
        error: error.message
      });
    }
  }

  /**
   * Reactivate user account
   * PUT /api/operator/users/:userId/activate
   */
  async activateUser(req, res) {
    try {
      const { userId } = req.params;
      const operator = req.user;

      // Get the target user
      const targetUser = await userRepository.findById(userId);
      if (!targetUser) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      // Check if user is already active
      if (targetUser.isActive) {
        return res.status(400).json({
          success: false,
          message: 'User is already active'
        });
      }

      const updatedUser = await userRepository.update(userId, { isActive: true });

      // Log the reactivation
      await auditService.logAction({
        userId: operator._id,
        username: operator.username,
        action: 'user_activate',
        resource: 'user_management',
        details: {
          targetUserId: userId,
          targetUsername: targetUser.username,
          targetRole: targetUser.role
        }
      });

      res.json({
        success: true,
        message: 'User account activated successfully',
        data: updatedUser
      });
    } catch (error) {
      logger.error('Error activating user', { error: error.message });
      res.status(500).json({
        success: false,
        message: 'Failed to activate user',
        error: error.message
      });
    }
  }

  /**
   * Get user audit trail
   * GET /api/operator/users/:userId/audit
   */
  async getUserAuditTrail(req, res) {
    try {
      const { userId } = req.params;
      const { limit = 50, skip = 0 } = req.query;

      // Get user info first
      const user = await userRepository.findById(userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      // Get audit logs for this user
      const auditLogs = await auditService.findByUser(userId, {
        limit: parseInt(limit),
        skip: parseInt(skip)
      });

      res.json({
        success: true,
        data: {
          user: {
            _id: user._id,
            username: user.username,
            role: user.role,
            isActive: user.isActive
          },
          auditLogs,
          pagination: {
            limit: parseInt(limit),
            skip: parseInt(skip),
            hasMore: auditLogs.length === parseInt(limit)
          }
        }
      });
    } catch (error) {
      logger.error('Error getting user audit trail', { error: error.message });
      res.status(500).json({
        success: false,
        message: 'Failed to get user audit trail',
        error: error.message
      });
    }
  }

  /**
   * Create system operator account
   * POST /api/operator/users/create-operator
   */
  async createOperator(req, res) {
    try {
      const { username, password, region } = req.body;
      const creator = req.user;

      // Only super admins can create operators
      if (creator.role !== 'super_admin') {
        return res.status(403).json({
          success: false,
          message: 'Only super administrators can create operator accounts'
        });
      }

      // Check if username already exists
      const existingUser = await userRepository.findByUsername(username);
      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: 'Username already exists'
        });
      }

      // Create the operator
      const operatorData = {
        username,
        password, // Will be hashed by the User model
        role: 'system_operator',
        region: region || 'default',
        isActive: true
      };

      const newOperator = await userRepository.create(operatorData);

      // Log the creation
      await auditService.logAction({
        userId: creator._id,
        username: creator.username,
        action: 'operator_create',
        resource: 'user_management',
        details: {
          newOperatorId: newOperator._id,
          newOperatorUsername: username,
          region
        }
      });

      res.status(201).json({
        success: true,
        message: 'System operator created successfully',
        data: newOperator
      });
    } catch (error) {
      logger.error('Error creating operator', { error: error.message });
      res.status(500).json({
        success: false,
        message: 'Failed to create operator',
        error: error.message
      });
    }
  }

  /**
   * Get session information for current operator
   * GET /api/operator/users/session
   */
  async getSession(req, res) {
    try {
      const operator = req.user;
      
      // Get fresh user data from database
      const currentUser = await userRepository.findById(operator._id);
      if (!currentUser) {
        return res.status(404).json({
          success: false,
          message: 'Session user not found'
        });
      }

      const sessionInfo = {
        user: currentUser,
        session: {
          loginTime: new Date().toISOString(), // This would come from session store in production
          permissions: this.getUserPermissions(currentUser.role),
          capabilities: this.getUserCapabilities(currentUser.role)
        }
      };

      res.json({
        success: true,
        data: sessionInfo
      });
    } catch (error) {
      logger.error('Error getting session info', { error: error.message });
      res.status(500).json({
        success: false,
        message: 'Failed to get session information',
        error: error.message
      });
    }
  }

  /**
   * Get user permissions based on role
   * @param {string} role - User role
   * @returns {Array} Array of permissions
   */
  getUserPermissions(role) {
    const permissions = {
      user: ['view_own_data'],
      system_operator: [
        'view_system_metrics',
        'view_traffic_data',
        'manage_simulation',
        'view_alerts',
        'generate_reports',
        'view_users',
        'manage_regular_users'
      ],
      admin: [
        'view_system_metrics',
        'view_traffic_data',
        'manage_simulation',
        'view_alerts',
        'generate_reports',
        'manage_users',
        'manage_settings',
        'view_audit_logs'
      ],
      super_admin: [
        'all_permissions',
        'manage_operators',
        'manage_admins',
        'system_configuration',
        'emergency_controls'
      ]
    };

    return permissions[role] || [];
  }

  /**
   * Get user capabilities based on role
   * @param {string} role - User role
   * @returns {Object} Capabilities object
   */
  getUserCapabilities(role) {
    const capabilities = {
      user: {
        canViewDashboard: false,
        canControlSUMO: false,
        canManageUsers: false,
        canViewSystemMetrics: false,
        canGenerateReports: false
      },
      system_operator: {
        canViewDashboard: true,
        canControlSUMO: true,
        canManageUsers: true, // Limited to regular users
        canViewSystemMetrics: true,
        canGenerateReports: true,
        canViewAuditLogs: false,
        canManageOperators: false
      },
      admin: {
        canViewDashboard: true,
        canControlSUMO: true,
        canManageUsers: true,
        canViewSystemMetrics: true,
        canGenerateReports: true,
        canViewAuditLogs: true,
        canManageOperators: false,
        canManageSettings: true
      },
      super_admin: {
        canViewDashboard: true,
        canControlSUMO: true,
        canManageUsers: true,
        canViewSystemMetrics: true,
        canGenerateReports: true,
        canViewAuditLogs: true,
        canManageOperators: true,
        canManageSettings: true,
        canAccessEmergencyControls: true
      }
    };

    return capabilities[role] || capabilities.user;
  }
}

module.exports = new UserManagementController();