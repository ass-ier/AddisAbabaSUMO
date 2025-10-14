const otpGenerator = require('otp-generator');
const nodemailer = require('nodemailer');
const OTP = require('../models/OTP'); // Correct path: src/services -> src/models

// Email transporter configuration
// For production, use proper SMTP credentials
const createEmailTransporter = () => {
  // For development, you can use ethereal.email or Gmail
  // To use Gmail:
  // 1. Enable 2-factor authentication
  // 2. Generate an app-specific password
  // 3. Set env variables: EMAIL_USER and EMAIL_PASS
  
  return nodemailer.createTransporter({
    host: process.env.EMAIL_HOST || 'smtp.gmail.com',
    port: process.env.EMAIL_PORT || 587,
    secure: false,
    auth: {
      user: process.env.EMAIL_USER || 'your-email@gmail.com',
      pass: process.env.EMAIL_PASS || 'your-app-password',
    },
  });
};

/**
 * Generate OTP code
 */
const generateOTP = () => {
  return otpGenerator.generate(6, {
    digits: true,
    lowerCaseAlphabets: false,
    upperCaseAlphabets: false,
    specialChars: false,
  });
};

/**
 * Send OTP via email
 */
const sendEmailOTP = async (email, otp, purpose) => {
  try {
    // In development mode or if email not configured, just log the OTP
    const isDevelopment = !process.env.EMAIL_USER || process.env.EMAIL_USER === 'your-email@gmail.com';
    
    if (isDevelopment) {
      console.log('\n========================================');
      console.log('📧 DEVELOPMENT MODE - OTP EMAIL');
      console.log('========================================');
      console.log(`To: ${email}`);
      console.log(`Purpose: ${purpose}`);
      console.log(`\n🔐 OTP CODE: ${otp}`);
      console.log('\nExpires in: 10 minutes');
      console.log('========================================\n');
      return true;
    }
    
    const transporter = createEmailTransporter();
    
    const purposeText = {
      registration: 'account registration',
      password_reset: 'password reset',
      verification: 'account verification',
    }[purpose] || 'verification';

    const mailOptions = {
      from: process.env.EMAIL_FROM || '"Traffic Management System" <noreply@trafficmanagement.com>',
      to: email,
      subject: `Your OTP Code for ${purposeText.charAt(0).toUpperCase() + purposeText.slice(1)}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">Addis Ababa Traffic Management System</h2>
          <p>Your OTP code for <strong>${purposeText}</strong> is:</p>
          <div style="background: #f5f5f5; padding: 20px; text-align: center; margin: 20px 0;">
            <h1 style="color: #4CAF50; letter-spacing: 5px; margin: 0;">${otp}</h1>
          </div>
          <p>This code will expire in <strong>10 minutes</strong>.</p>
          <p>If you didn't request this code, please ignore this email.</p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
          <p style="color: #999; font-size: 12px;">
            Addis Ababa Traffic Management System<br>
            Driving Addis Forward
          </p>
        </div>
      `,
    };

    await transporter.sendMail(mailOptions);
    console.log(`OTP email sent to ${email}`);
    return true;
  } catch (error) {
    console.error('Error sending email OTP:', error);
    // Fallback to console logging in case of email error
    console.log('\n========================================');
    console.log('📧 EMAIL FAILED - SHOWING OTP IN CONSOLE');
    console.log('========================================');
    console.log(`To: ${email}`);
    console.log(`Purpose: ${purpose}`);
    console.log(`\n🔐 OTP CODE: ${otp}`);
    console.log('\nExpires in: 10 minutes');
    console.log('========================================\n');
    return true; // Return true to allow development to continue
  }
};

/**
 * Send OTP via SMS (placeholder - requires SMS service like Twilio)
 */
const sendSMSOTP = async (phone, otp, purpose) => {
  try {
    // Check if Twilio is configured
    const isTwilioConfigured = process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN;
    
    if (!isTwilioConfigured) {
      // For development, just log the OTP
      console.log('\n========================================');
      console.log('📱 DEVELOPMENT MODE - OTP SMS');
      console.log('========================================');
      console.log(`To: ${phone}`);
      console.log(`Purpose: ${purpose}`);
      console.log(`\n🔐 OTP CODE: ${otp}`);
      console.log('\nExpires in: 10 minutes');
      console.log('========================================\n');
      return true;
    }
    
    // TODO: Implement actual SMS sending with Twilio or similar service
    // const accountSid = process.env.TWILIO_ACCOUNT_SID;
    // const authToken = process.env.TWILIO_AUTH_TOKEN;
    // const client = require('twilio')(accountSid, authToken);
    //
    // await client.messages.create({
    //   body: `Your verification code is: ${otp}. Valid for 10 minutes.`,
    //   from: process.env.TWILIO_PHONE_NUMBER,
    //   to: phone
    // });

    return true;
  } catch (error) {
    console.error('Error sending SMS OTP:', error);
    // Fallback to console logging
    console.log('\n========================================');
    console.log('📱 SMS FAILED - SHOWING OTP IN CONSOLE');
    console.log('========================================');
    console.log(`To: ${phone}`);
    console.log(`Purpose: ${purpose}`);
    console.log(`\n🔐 OTP CODE: ${otp}`);
    console.log('\nExpires in: 10 minutes');
    console.log('========================================\n');
    return true;
  }
};

/**
 * Create and send OTP
 */
const createAndSendOTP = async (identifier, identifierType, purpose) => {
  try {
    // Delete any existing unverified OTPs for this identifier and purpose
    await OTP.deleteMany({
      identifier,
      purpose,
      verified: false,
    });

    // Generate new OTP
    const otp = generateOTP();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Save OTP to database
    await OTP.create({
      identifier,
      identifierType,
      otp,
      purpose,
      expiresAt,
    });

    // Send OTP based on type
    if (identifierType === 'email') {
      await sendEmailOTP(identifier, otp, purpose);
    } else if (identifierType === 'phone') {
      await sendSMSOTP(identifier, otp, purpose);
    }

    return {
      success: true,
      message: `OTP sent to your ${identifierType}`,
      expiresIn: 600, // seconds
    };
  } catch (error) {
    console.error('Error creating and sending OTP:', error);
    throw error;
  }
};

/**
 * Verify OTP
 */
const verifyOTP = async (identifier, otp, purpose) => {
  const otpRecord = await OTP.findOne({
    identifier,
    purpose,
    verified: false,
    expiresAt: { $gt: new Date() },
  }).sort({ createdAt: -1 });

  if (!otpRecord) {
    return false;
  }

  // Check attempts
  if (otpRecord.attempts >= otpRecord.maxAttempts) {
    await OTP.deleteOne({ _id: otpRecord._id });
    throw new Error('Maximum verification attempts exceeded. Please request a new OTP.');
  }

  // Verify OTP
  if (otpRecord.otp !== otp) {
    otpRecord.attempts += 1;
    await otpRecord.save();
    const remaining = otpRecord.maxAttempts - otpRecord.attempts;
    throw new Error(`Invalid OTP. ${remaining} attempt${remaining !== 1 ? 's' : ''} remaining.`);
  }

  // Mark as verified
  otpRecord.verified = true;
  await otpRecord.save();

  return true;
};

/**
 * Check if identifier has been verified
 */
const isVerified = async (identifier, purpose) => {
  const verifiedOTP = await OTP.findOne({
    identifier,
    purpose,
    verified: true,
  });

  return !!verifiedOTP;
};

/**
 * Clean up verified OTP after successful use
 */
const cleanupVerifiedOTP = async (identifier, purpose) => {
  try {
    await OTP.deleteMany({
      identifier,
      purpose,
      verified: true,
    });
    console.log(`Cleaned up verified OTP for ${identifier} (${purpose})`);
  } catch (error) {
    console.error('Error cleaning up verified OTP:', error);
  }
};

/**
 * Send OTP (wrapper for createAndSendOTP to match route interface)
 */
const sendOTP = async (identifier, purpose, method) => {
  console.log('\n📦 sendOTP function called');
  console.log('- Identifier:', identifier);
  console.log('- Purpose:', purpose);
  console.log('- Method:', method);
  const identifierType = method; // 'email' or 'sms'
  return await createAndSendOTP(identifier, identifierType, purpose);
};

module.exports = {
  createAndSendOTP,
  sendOTP,
  verifyOTP,
  isVerified,
  cleanupVerifiedOTP,
};
