const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const { authenticateToken } = require('../middleware/auth');
const { validate, schemas } = require('../middleware/validation');

/**
 * Auth Routes - Presentation Layer (Tier 1)
 * Defines API endpoints for authentication
 * 
 * All routes are prefixed with /api/auth
 */

/**
 * @route   POST /api/auth/login
 * @desc    Login user
 * @access  Public
 */
router.post('/login', validate(schemas.login), authController.login);

/**
 * @route   POST /api/auth/register
 * @desc    Register new user
 * @access  Public
 */
router.post('/register', validate(schemas.register), authController.register);

/**
 * @route   POST /api/auth/logout
 * @desc    Logout user
 * @access  Protected
 */
router.post('/logout', authenticateToken, authController.logout);

/**
 * @route   GET /api/auth/verify
 * @desc    Verify JWT token
 * @access  Protected
 */
router.get('/verify', authenticateToken, authController.verifyToken);

/**
 * @route   GET /api/auth/validate
 * @desc    Validate JWT token (alias for /verify for frontend compatibility)
 * @access  Protected
 */
router.get('/validate', authenticateToken, authController.verifyToken);

module.exports = router;
