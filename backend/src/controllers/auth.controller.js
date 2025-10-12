const authService = require('../services/auth.service');
const { asyncHandler } = require('../middleware/errorHandler');

/**
 * Auth Controller - Presentation Layer (Tier 1)
 * Handles HTTP requests/responses for authentication
 */
class AuthController {
  /**
   * Login user
   * POST /api/auth/login
   * Body: { username, password }
   */
  login = asyncHandler(async (req, res) => {
    const { username, password } = req.body;

    const result = await authService.login(username, password);

    // Set token in cookie (optional, for cookie-based auth)
    res.cookie('token', result.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 24 * 60 * 60 * 1000 // 24 hours
    });

    // Frontend expects {token, user} directly (not wrapped in data)
    res.json({
      token: result.token,
      user: result.user
    });
  });

  /**
   * Register new user
   * POST /api/auth/register
   * Body: { username, password, role?, region? }
   */
  register = asyncHandler(async (req, res) => {
    const { username, password, role, region } = req.body;

    const result = await authService.register({
      username,
      password,
      role,
      region
    });

    // Set token in cookie
    res.cookie('token', result.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 24 * 60 * 60 * 1000
    });

    res.status(201).json({
      success: true,
      message: 'Registration successful',
      data: {
        user: result.user,
        token: result.token
      }
    });
  });

  /**
   * Logout user
   * POST /api/auth/logout
   */
  logout = asyncHandler(async (req, res) => {
    // Clear cookie
    res.clearCookie('token');

    await authService.logout(req.user?._id);

    res.json({
      success: true,
      message: 'Logout successful'
    });
  });

  /**
   * Verify token
   * GET /api/auth/verify
   */
  verifyToken = asyncHandler(async (req, res) => {
    // If this route is reached, the token is already verified by middleware
    // Frontend expects {user} directly
    res.json({
      user: req.user
    });
  });
}

module.exports = new AuthController();
