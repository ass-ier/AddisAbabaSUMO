const express = require('express');
const router = express.Router();
const otpService = require('../services/otp.service');
const User = require('../models/User');

/**
 * OTP Routes - Presentation Layer (Tier 1)
 * Handles OTP (One-Time Password) verification for registration and password reset
 * 
 * All routes are prefixed with /api/otp
 */

/**
 * @route   POST /api/otp/send
 * @desc    Send OTP to email/phone
 * @access  Public
 */
router.post('/send', async (req, res) => {
    console.log('\n🔔 OTP SEND REQUEST RECEIVED');
    console.log('Request body:', req.body);
    try {
        const { identifier, purpose, method } = req.body;

        // Validate input
        if (!identifier || !purpose || !method) {
            return res.status(400).json({
                message: 'Identifier, purpose, and method are required'
            });
        }

        // Validate purpose
        const validPurposes = ['registration', 'password_reset', 'verification'];
        if (!validPurposes.includes(purpose)) {
            return res.status(400).json({
                message: 'Invalid purpose. Must be registration, password_reset, or verification'
            });
        }

        // Validate method
        const validMethods = ['email', 'sms'];
        if (!validMethods.includes(method)) {
            return res.status(400).json({
                message: 'Invalid method. Must be email or sms'
            });
        }

        // For registration, check if user already exists
        if (purpose === 'registration') {
            const existingUser = await User.findOne({
                $or: [{ email: identifier }, { phone: identifier }]
            });

            if (existingUser) {
                return res.status(400).json({
                    message: 'User with this email or phone already exists'
                });
            }
        }

        // For password reset, check if user exists
        if (purpose === 'password_reset') {
            const user = await User.findOne({
                $or: [{ email: identifier }, { phone: identifier }]
            });

            if (!user) {
                return res.status(404).json({
                    message: 'No user found with this email or phone'
                });
            }
        }

        // Send OTP
        console.log(`🚀 Calling otpService.sendOTP for ${identifier} via ${method}`);
        const result = await otpService.sendOTP(identifier, purpose, method);
        console.log('✅ OTP sent successfully, result:', result);

        res.json({
            message: `OTP sent successfully via ${method}`,
            expiresIn: 10 * 60, // 10 minutes in seconds
            identifier: identifier
        });

    } catch (error) {
        console.error('Error sending OTP:', error);
        res.status(500).json({
            message: error.message || 'Failed to send OTP'
        });
    }
});

/**
 * @route   POST /api/otp/verify
 * @desc    Verify OTP code
 * @access  Public
 */
router.post('/verify', async (req, res) => {
    try {
        const { identifier, otp, purpose } = req.body;

        // Validate input
        if (!identifier || !otp || !purpose) {
            return res.status(400).json({
                message: 'Identifier, OTP, and purpose are required'
            });
        }

        // Verify OTP
        const isValid = await otpService.verifyOTP(identifier, otp, purpose);

        if (isValid) {
            res.json({
                message: 'OTP verified successfully',
                verified: true
            });
        } else {
            res.status(400).json({
                message: 'Invalid or expired OTP',
                verified: false
            });
        }

    } catch (error) {
        console.error('Error verifying OTP:', error);

        // Handle specific error messages
        if (error.message.includes('Maximum verification attempts exceeded')) {
            return res.status(429).json({
                message: error.message,
                verified: false
            });
        }

        res.status(500).json({
            message: error.message || 'Failed to verify OTP',
            verified: false
        });
    }
});

/**
 * @route   POST /api/otp/resend
 * @desc    Resend OTP code
 * @access  Public
 */
router.post('/resend', async (req, res) => {
    try {
        const { identifier, purpose, method } = req.body;

        // Validate input
        if (!identifier || !purpose || !method) {
            return res.status(400).json({
                message: 'Identifier, purpose, and method are required'
            });
        }

        // Delete old OTP and send new one
        const result = await otpService.sendOTP(identifier, purpose, method);

        res.json({
            message: `OTP resent successfully via ${method}`,
            expiresIn: 10 * 60, // 10 minutes in seconds
            identifier: identifier
        });

    } catch (error) {
        console.error('Error resending OTP:', error);
        res.status(500).json({
            message: error.message || 'Failed to resend OTP'
        });
    }
});

/**
 * @route   POST /api/otp/check-verification
 * @desc    Check if identifier has been verified
 * @access  Public
 */
router.post('/check-verification', async (req, res) => {
    try {
        const { identifier, purpose } = req.body;

        if (!identifier || !purpose) {
            return res.status(400).json({
                message: 'Identifier and purpose are required'
            });
        }

        const isVerified = await otpService.isVerified(identifier, purpose);

        res.json({
            verified: isVerified
        });

    } catch (error) {
        console.error('Error checking verification:', error);
        res.status(500).json({
            message: 'Failed to check verification status'
        });
    }
});

module.exports = router;
