const userService = require('../services/user.service');
const { asyncHandler } = require('../middleware/errorHandler');

/**
 * User Controller - Presentation Layer (Tier 1)
 * Handles HTTP requests/responses for user management
 * NO business logic - call service methods only
 */
class UserController {
  /**
   * Get all users
   * GET /api/users
   * Query params: role, isActive, limit, page
   */
  getAllUsers = asyncHandler(async (req, res) => {
    const { role, isActive, limit = 100, page = 1 } = req.query;

    // Build filters
    const filters = {};
    if (role) filters.role = role;
    if (isActive !== undefined) filters.isActive = isActive === 'true';

    // Build options
    const options = {
      limit: parseInt(limit),
      skip: (parseInt(page) - 1) * parseInt(limit),
      sort: { createdAt: -1 }
    };

    const result = await userService.getAllUsers(filters, options);

    res.json({
      success: true,
      data: result.users,
      pagination: {
        total: result.total,
        page: result.page,
        limit: result.limit,
        pages: Math.ceil(result.total / result.limit)
      }
    });
  });

  /**
   * Get user by ID
   * GET /api/users/:id
   */
  getUserById = asyncHandler(async (req, res) => {
    const user = await userService.getUserById(req.params.id);

    res.json({
      success: true,
      data: user
    });
  });

  /**
   * Get current user's profile
   * GET /api/users/me
   */
  getCurrentUser = asyncHandler(async (req, res) => {
    const user = await userService.getUserById(req.user._id);

    res.json({
      success: true,
      data: user
    });
  });

  /**
   * Get users by role
   * GET /api/users/role/:role
   */
  getUsersByRole = asyncHandler(async (req, res) => {
    const users = await userService.getUsersByRole(req.params.role);

    res.json({
      success: true,
      data: users,
      count: users.length
    });
  });

  /**
   * Create new user
   * POST /api/users
   * Body: { username, password, role, region }
   */
  createUser = asyncHandler(async (req, res) => {
    const { username, password, role, region, email, firstName, lastName, phoneNumber } = req.body;

    const user = await userService.createUser({
      username,
      password,
      role,
      region,
      email,
      firstName,
      lastName,
      phoneNumber
    });

    res.status(201).json({
      success: true,
      message: 'User created successfully',
      data: user
    });
  });

  /**
   * Update user
   * PUT /api/users/:id
   * Body: { username?, password?, role?, region? }
   */
  updateUser = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const updates = req.body;

    const user = await userService.updateUser(id, updates, req.user);

    res.json({
      success: true,
      message: 'User updated successfully',
      data: user
    });
  });

  /**
   * Update current user's profile
   * PUT /api/users/me
   * Body: { username?, password?, region? }
   */
  updateCurrentUser = asyncHandler(async (req, res) => {
    const updates = req.body;

    // Users can't change their own role via this endpoint
    delete updates.role;

    const user = await userService.updateUser(req.user._id, updates, req.user);

    res.json({
      success: true,
      message: 'Profile updated successfully',
      data: user
    });
  });

  /**
   * Delete user
   * DELETE /api/users/:id
   */
  deleteUser = asyncHandler(async (req, res) => {
    await userService.deleteUser(req.params.id, req.user);

    res.json({
      success: true,
      message: 'User deleted successfully'
    });
  });

  /**
   * Get total user count
   * GET /api/users/count
   */
  getUserCount = asyncHandler(async (req, res) => {
    const count = await userService.getUserCount();

    res.json({
      success: true,
      count
    });
  });

  /**
   * Get user statistics
   * GET /api/users/stats/overview
   */
  getUserStats = asyncHandler(async (req, res) => {
    const stats = await userService.getUserStats();

    res.json({
      success: true,
      data: stats
    });
  });
}

module.exports = new UserController();
