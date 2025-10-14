const mongoose = require('mongoose');

const otpSchema = new mongoose.Schema({
  identifier: {
    type: String,
    required: true,
    index: true,
  },
  identifierType: {
    type: String,
    enum: ['email', 'phone'],
    required: true,
  },
  otp: {
    type: String,
    required: true,
  },
  purpose: {
    type: String,
    enum: ['registration', 'password_reset', 'verification'],
    required: true,
  },
  attempts: {
    type: Number,
    default: 0,
  },
  maxAttempts: {
    type: Number,
    default: 3,
  },
  expiresAt: {
    type: Date,
    required: true,
    index: { expires: 0 }, // TTL index - auto-delete when expires
  },
  verified: {
    type: Boolean,
    default: false,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// Index for quick lookups
otpSchema.index({ identifier: 1, purpose: 1, verified: 1 });

// Clean up old OTPs periodically
otpSchema.index({ createdAt: 1 }, { expireAfterSeconds: 600 }); // 10 minutes

module.exports = mongoose.model('OTP', otpSchema);
