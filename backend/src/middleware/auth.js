const jwt = require('jsonwebtoken');
const { AppError, asyncHandler } = require('./errorHandler');
const userRepository = require('../repositories/user.repository');
const logger = require('../utils/logger');

/**
 * Authentication Middleware
 * Verifies JWT token and attaches user to request
 */
const authenticateToken = asyncHandler(async (req, res, next) => {
  let token;

  // Check for token in Authorization header
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }
  // Check for token in cookies (both 'token' and 'access_token')
  else if (req.cookies && (req.cookies.token || req.cookies.access_token)) {
    token = req.cookies.token || req.cookies.access_token;
  }

  if (!token) {
    throw new AppError('No token provided. Authentication required.', 401);
  }

  try {
    // Verify token
    const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET || 'your-secret-key');

    // Get user from database
    const user = await userRepository.findById(decoded.id);

    if (!user) {
      throw new AppError('User no longer exists', 401);
    }

    if (!user.isActive) {
      throw new AppError('User account is deactivated', 403);
    }

    // Attach user to request
    req.user = {
      _id: user._id,
      username: user.username,
      role: user.role,
      region: user.region
    };

    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      throw new AppError('Invalid token', 401);
    }
    if (error.name === 'TokenExpiredError') {
      throw new AppError('Token expired. Please log in again.', 401);
    }
    throw error;
  }
});

/**
 * Role-based authorization middleware
 * @param {...string} roles - Allowed roles
 */
const requireRole = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      throw new AppError('Authentication required', 401);
    }

    if (!roles.includes(req.user.role)) {
      logger.warn(
        `Unauthorized access attempt by ${req.user.username} (${req.user.role}) to ${req.originalUrl}`
      );
      throw new AppError(
        `Access denied. Required role(s): ${roles.join(', ')}`,
        403
      );
    }

    next();
  };
};

/**
 * Role-based authorization middleware (accepts array of roles)
 * @param {Array} roles - Array of allowed roles
 */
const requireAnyRole = (roles) => {
  return (req, res, next) => {
    if (!req.user) {
      throw new AppError('Authentication required', 401);
    }

    if (!roles.includes(req.user.role)) {
      logger.warn(
        `Unauthorized access attempt by ${req.user.username} (${req.user.role}) to ${req.originalUrl}`
      );
      throw new AppError(
        `Access denied. Required role(s): ${roles.join(', ')}`,
        403
      );
    }

    next();
  };
};

/**
 * Optional authentication middleware
 * Attaches user if token is present, but doesn't throw error if missing
 */
const optionalAuth = async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  } else if (req.cookies && req.cookies.token) {
    token = req.cookies.token;
  }

  if (token) {
    try {
      const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET || 'your-secret-key');
      const user = await userRepository.findById(decoded.id);
      
      if (user && user.isActive) {
        req.user = {
          _id: user._id,
          username: user.username,
          role: user.role,
          region: user.region
        };
      }
    } catch (error) {
      // Silently fail - authentication is optional
      logger.debug('Optional auth failed:', error.message);
    }
  }

  next();
};

/**
 * Generate JWT token
 * @param {string} userId - User ID
 * @returns {string} JWT token
 */
const generateToken = (userId) => {
  return jwt.sign(
    { id: userId },
    process.env.ACCESS_TOKEN_SECRET || 'your-secret-key',
    { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
  );
};

/**
 * Verify if user owns the resource or is admin
 * @param {string} resourceUserId - User ID of resource owner
 */
const requireOwnerOrAdmin = (resourceUserId) => {
  return (req, res, next) => {
    if (!req.user) {
      throw new AppError('Authentication required', 401);
    }

    const isOwner = req.user._id.toString() === resourceUserId.toString();
    const isAdmin = req.user.role === 'super_admin';

    if (!isOwner && !isAdmin) {
      logger.warn(
        `Unauthorized resource access attempt by ${req.user.username} to resource owned by ${resourceUserId}`
      );
      throw new AppError('Access denied. You can only access your own resources.', 403);
    }

    next();
  };
};

/**
 * Require system operator role
 * Only allows users with 'operator' or 'super_admin' roles
 */
const requireOperatorRole = (req, res, next) => {
  if (!req.user) {
    throw new AppError('Authentication required', 401);
  }

  const allowedRoles = ['operator', 'super_admin'];
  if (!allowedRoles.includes(req.user.role)) {
    logger.warn(
      `Unauthorized operator access attempt by ${req.user.username} (${req.user.role}) to ${req.originalUrl}`
    );
    throw new AppError(
      'Access denied. System operator privileges required.',
      403
    );
  }

  next();
};

/**
 * Require admin role
 * Only allows users with 'admin' or 'super_admin' roles
 */
const requireAdminRole = (req, res, next) => {
  if (!req.user) {
    throw new AppError('Authentication required', 401);
  }

  const allowedRoles = ['super_admin'];
  if (!allowedRoles.includes(req.user.role)) {
    logger.warn(
      `Unauthorized admin access attempt by ${req.user.username} (${req.user.role}) to ${req.originalUrl}`
    );
    throw new AppError(
      'Access denied. Administrative privileges required.',
      403
    );
  }

  next();
};

/**
 * Require super admin role
 * Only allows users with 'super_admin' role
 */
const requireSuperAdminRole = (req, res, next) => {
  if (!req.user) {
    throw new AppError('Authentication required', 401);
  }

  if (req.user.role !== 'super_admin') {
    logger.warn(
      `Unauthorized super admin access attempt by ${req.user.username} (${req.user.role}) to ${req.originalUrl}`
    );
    throw new AppError(
      'Access denied. Super administrator privileges required.',
      403
    );
  }

  next();
};

module.exports = {
  // Main authentication function
  authenticate: authenticateToken,
  authenticateToken,
  
  // Role-based authorization
  requireRole,
  requireAnyRole,
  requireOperatorRole,
  requireAdminRole,
  requireSuperAdminRole,
  
  // Utility functions
  optionalAuth,
  generateToken,
  requireOwnerOrAdmin
};
