const authService = require('../services/auth.service');
const { asyncHandler, AppError } = require('../middleware/errorHandler');

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
   * Body: { username, password, firstName, lastName, email?, phone?, role?, region?, identifier, otpVerified }
   */
  register = asyncHandler(async (req, res) => {
    console.log('\n🔔 REGISTRATION REQUEST RECEIVED');
    console.log('Request body:', req.body);
    const { username, password, firstName, lastName, email, phone, role, region, identifier, otpVerified } = req.body;

    // Check if OTP was verified (required for registration)
    if (!otpVerified || !identifier) {
      console.log('❌ Registration failed: OTP not verified');
      throw new AppError('OTP verification is required for registration', 400);
    }
    
    console.log('✅ OTP verification flag present, checking database...');

    // Verify the OTP is actually verified in database
    const otpService = require('../services/otp.service');
    console.log(`🔍 Checking OTP verification for: ${identifier}`);
    const isVerified = await otpService.isVerified(identifier, 'registration');
    console.log(`OTP verified in DB: ${isVerified}`);
    
    if (!isVerified) {
      console.log('❌ OTP verification not found in database');
      throw new AppError('Invalid or expired OTP verification. Please verify again.', 400);
    }
    
    console.log('✅ OTP verification confirmed, proceeding with registration...');

    const result = await authService.register({
      username,
      password,
      firstName,
      lastName,
      email,
      phone,
      role,
      region
    });

    // Clean up the verified OTP after successful registration
    await otpService.cleanupVerifiedOTP(identifier, 'registration');

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
