const express = require('express');
const router = express.Router();
const userController = require('../controllers/user.controller');
const { authenticateToken, requireRole, requireAnyRole } = require('../middleware/auth');
const { validate, schemas } = require('../middleware/validation');

/**
 * User Routes - Presentation Layer (Tier 1)
 * Defines API endpoints for user management
 * 
 * All routes are prefixed with /api/users (configured in route aggregator)
 */

// ===== Public Routes (no authentication required) =====
// None - all user routes require authentication

// ===== Protected Routes (authentication required) =====
router.use(authenticateToken);

/**
 * @route   GET /api/users/me
 * @desc    Get current user's profile
 * @access  All authenticated users
 */
router.get('/me', userController.getCurrentUser);

/**
 * @route   PUT /api/users/me
 * @desc    Update current user's profile
 * @access  All authenticated users
 */
router.put('/me', validate(schemas.updateProfile), userController.updateCurrentUser);

/**
 * @route   GET /api/users/team
 * @desc    Get team members (operators and analysts only, no admins)
 * @access  All authenticated users (operators, analysts, admins)
 */
router.get('/team', userController.getTeamMembers);

/**
 * @route   GET /api/users/count
 * @desc    Get total user count
 * @access  Super Admin, Operator, Analyst
 */
router.get(
  '/count',
  requireAnyRole(['super_admin', 'operator', 'analyst']),
  userController.getUserCount
);

/**
 * @route   GET /api/users/stats/overview
 * @desc    Get user statistics (total, active, by role, etc.)
 * @access  Super Admin, Analyst
 */
router.get(
  '/stats/overview',
  requireRole('super_admin', 'analyst'),
  userController.getUserStats
);

/**
 * @route   GET /api/users/role/:role
 * @desc    Get all users with specified role
 * @access  Super Admin
 */
router.get(
  '/role/:role',
  requireRole('super_admin'),
  userController.getUsersByRole
);

/**
 * @route   GET /api/users
 * @desc    Get all users (with optional filters)
 * @query   ?role=operator&isActive=true&limit=50&page=1
 * @access  Super Admin
 */
router.get(
  '/',
  requireRole('super_admin'),
  userController.getAllUsers
);

/**
 * @route   POST /api/users
 * @desc    Create a new user
 * @body    { username, email, password, firstName, lastName, role, region }
 * @access  Super Admin
 */
router.post(
  '/',
  requireRole('super_admin'),
  validate(schemas.createUser),
  userController.createUser
);

/**
 * @route   GET /api/users/:id
 * @desc    Get user by ID
 * @access  Super Admin (or own profile)
 */
router.get('/:id', userController.getUserById);

/**
 * @route   PUT /api/users/:id
 * @desc    Update user by ID
 * @body    { username?, password?, role?, region? }
 * @access  Super Admin (or own profile with restrictions)
 */
router.put(
  '/:id',
  validate(schemas.updateUser),
  userController.updateUser
);

/**
 * @route   DELETE /api/users/:id
 * @desc    Delete user by ID (soft delete)
 * @access  Super Admin
 */
router.delete(
  '/:id',
  requireRole('super_admin'),
  userController.deleteUser
);

module.exports = router;
