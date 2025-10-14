# OTP Verification System Implementation Guide

## 📋 Overview

I've started implementing a comprehensive OTP (One-Time Password) verification system for the Addis Ababa Traffic Management System. This adds an additional security layer for user registration and password reset flows.

## ✅ What's Been Completed

### 1. **Backend Foundation** ✓

#### **Packages Installed:**
- `nodemailer` - For sending OTP via email
- `otp-generator` - For generating secure 6-digit OTPs

#### **OTP Model Created:** (`backend/src/models/OTP.js`)
- Stores OTPs with expiration (10 minutes)
- Tracks verification attempts (max 3 attempts)
- Supports both email and phone verification
- Auto-deletes expired OTPs using MongoDB TTL indexes
- Fields:
  - `identifier` - Email or phone number
  - `identifierType` - 'email' or 'phone'
  - `otp` - The 6-digit code
  - `purpose` - 'registration', 'password_reset', or 'verification'
  - `attempts` - Number of verification attempts
  - `expiresAt` - Expiration timestamp
  - `verified` - Verification status

#### **OTP Service Created:** (`backend/src/services/otp.service.js`)
Features:
- `createAndSendOTP()` - Generates and sends OTP
- `verifyOTP()` - Verifies user-submitted OTP
- `isVerified()` - Checks if identifier has been verified
- Email sending with HTML templates
- SMS sending placeholder (ready for Twilio integration)
- Automatic cleanup of old OTPs
- Rate limiting (max 3 attempts)

## 📝 What Still Needs to Be Done

### 2. **API Routes** (Next Step)
Need to create routes in `backend/src/routes/`:
- `POST /api/otp/send` - Send OTP to email/phone
- `POST /api/otp/verify` - Verify OTP code
- `POST /api/otp/resend` - Resend OTP

### 3. **Frontend Components**
Need to create React components:
- `OTPInput.jsx` - Input component for 6-digit OTP
- `OTPVerification.jsx` - Full verification screen
- Update Login/Registration flows

### 4. **Integration**
- Integrate OTP into user registration flow
- Integrate OTP into password reset flow
- Add OTP verification to profile changes

## 🔧 Configuration Required

### Email Setup (Required for Production)

Add these environment variables to `backend/config.env`:

```env
# Email Configuration
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password
EMAIL_FROM="Traffic Management System <noreply@trafficmanagement.com>"
```

### For Gmail:
1. Enable 2-factor authentication
2. Generate an app-specific password
3. Use that password in `EMAIL_PASS`

### SMS Setup (Optional - For Phone Verification)

To enable SMS verification with Twilio:

```env
# Twilio Configuration (Optional)
TWILIO_ACCOUNT_SID=your_account_sid
TWILIO_AUTH_TOKEN=your_auth_token  
TWILIO_PHONE_NUMBER=your_twilio_number
```

## 📊 How It Works

### Registration Flow:
1. User enters email/phone during registration
2. System sends 6-digit OTP
3. User enters OTP code
4. System verifies code (3 attempts max)
5. Account is created/verified

### Password Reset Flow:
1. User requests password reset
2. System sends OTP to registered email/phone
3. User enters OTP code
4. System verifies code
5. User can set new password

## 🔒 Security Features

- **Expiration**: OTPs expire after 10 minutes
- **Rate Limiting**: Maximum 3 verification attempts
- **Auto-Cleanup**: Expired OTPs are automatically deleted
- **Secure Generation**: Uses cryptographically secure random generation
- **Purpose-Based**: Separate OTPs for different purposes
- **Single-Use**: OTPs are marked as verified and can't be reused

## 📱 Development Mode

In development (when email credentials aren't configured):
- **Email OTPs**: Logged to console for testing
- **SMS OTPs**: Logged to console (SMS sending not required)

## 🚀 Next Steps to Complete Implementation

1. **Create API routes** for OTP operations
2. **Build frontend components** for OTP input
3. **Integrate into registration** workflow
4. **Integrate into password reset** workflow
5. **Test end-to-end** flow
6. **Configure production email** service

## 💡 Usage Examples

### Backend Usage:

```javascript
const otpService = require('./src/services/otp.service');

// Send OTP
await otpService.createAndSendOTP(
  'user@example.com',
  'email',
  'registration'
);

// Verify OTP
const result = await otpService.verifyOTP(
  'user@example.com',
  '123456',
  'registration'
);

// Check if verified
const isVerified = await otpService.isVerified(
  'user@example.com',
  'registration'
);
```

## ⚠️ Important Notes

1. **Email credentials are required** for production use
2. **SMS requires Twilio account** (optional, can use email-only)
3. **OTPs are logged in development** for easy testing
4. **MongoDB TTL indexes** handle automatic cleanup
5. **Rate limiting prevents brute force** attacks

---

Would you like me to continue with:
- Creating the API routes?
- Building the frontend OTP components?
- Integrating into existing flows?

Let me know which part you'd like me to implement next!
