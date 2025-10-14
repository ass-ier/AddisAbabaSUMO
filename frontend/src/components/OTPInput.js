import React, { useState, useRef, useEffect } from 'react';
import './OTPInput.css';

const OTPInput = ({ length = 6, onComplete, onResend, identifier, purpose, disabled = false }) => {
  const [otp, setOtp] = useState(new Array(length).fill(''));
  const [timer, setTimer] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const inputRefs = useRef([]);

  useEffect(() => {
    // Focus first input on mount
    if (inputRefs.current[0]) {
      inputRefs.current[0].focus();
    }
  }, []);

  useEffect(() => {
    // Timer countdown
    if (timer > 0) {
      const interval = setInterval(() => {
        setTimer((prev) => prev - 1);
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [timer]);

  const handleChange = (element, index) => {
    const value = element.value;
    
    // Only accept numbers
    if (isNaN(value)) return;

    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);

    // Focus next input
    if (value !== '' && index < length - 1) {
      inputRefs.current[index + 1].focus();
    }

    // Check if all fields are filled
    if (newOtp.every((digit) => digit !== '')) {
      const otpCode = newOtp.join('');
      handleVerify(otpCode);
    }
  };

  const handleKeyDown = (e, index) => {
    // Handle backspace
    if (e.key === 'Backspace') {
      if (otp[index] === '' && index > 0) {
        // Move to previous input if current is empty
        inputRefs.current[index - 1].focus();
      } else {
        // Clear current input
        const newOtp = [...otp];
        newOtp[index] = '';
        setOtp(newOtp);
      }
    }
    // Handle arrow keys
    else if (e.key === 'ArrowLeft' && index > 0) {
      inputRefs.current[index - 1].focus();
    } else if (e.key === 'ArrowRight' && index < length - 1) {
      inputRefs.current[index + 1].focus();
    }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text/plain').trim();
    
    // Only accept numeric paste
    if (!/^\d+$/.test(pastedData)) return;

    const pastedDigits = pastedData.slice(0, length).split('');
    const newOtp = [...otp];
    
    pastedDigits.forEach((digit, index) => {
      newOtp[index] = digit;
    });
    
    setOtp(newOtp);

    // Focus the next empty input or last input
    const nextIndex = Math.min(pastedDigits.length, length - 1);
    inputRefs.current[nextIndex].focus();

    // Auto-verify if complete
    if (pastedDigits.length === length) {
      handleVerify(pastedDigits.join(''));
    }
  };

  const handleVerify = async (otpCode) => {
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const response = await fetch('http://localhost:5001/api/otp/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          identifier,
          otp: otpCode,
          purpose,
        }),
      });

      const data = await response.json();

      if (response.ok && data.verified) {
        setSuccess('OTP verified successfully!');
        if (onComplete) {
          onComplete(otpCode, true);
        }
      } else {
        setError(data.message || 'Invalid OTP code');
        // Clear OTP on error
        setOtp(new Array(length).fill(''));
        inputRefs.current[0].focus();
        if (onComplete) {
          onComplete(otpCode, false);
        }
      }
    } catch (error) {
      console.error('OTP verification error:', error);
      setError('Failed to verify OTP. Please try again.');
      setOtp(new Array(length).fill(''));
      inputRefs.current[0].focus();
      if (onComplete) {
        onComplete(otpCode, false);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setLoading(true);
    setError('');
    setSuccess('');
    setOtp(new Array(length).fill(''));

    try {
      const response = await fetch('http://localhost:5001/api/otp/resend', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          identifier,
          purpose,
          method: identifier.includes('@') ? 'email' : 'sms',
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setSuccess('OTP code resent successfully!');
        setTimer(60); // 60 seconds cooldown
        if (onResend) {
          onResend();
        }
      } else {
        setError(data.message || 'Failed to resend OTP');
      }
    } catch (error) {
      console.error('OTP resend error:', error);
      setError('Failed to resend OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="otp-input-container">
      <div className="otp-input-wrapper">
        {otp.map((digit, index) => (
          <input
            key={index}
            ref={(el) => (inputRefs.current[index] = el)}
            type="text"
            inputMode="numeric"
            maxLength={1}
            value={digit}
            onChange={(e) => handleChange(e.target, index)}
            onKeyDown={(e) => handleKeyDown(e, index)}
            onPaste={handlePaste}
            disabled={disabled || loading}
            className={`otp-input ${error ? 'error' : ''} ${success ? 'success' : ''}`}
            autoComplete="off"
          />
        ))}
      </div>

      {loading && (
        <div className="otp-loading">
          <div className="spinner"></div>
          <span>Verifying...</span>
        </div>
      )}

      {error && (
        <div className="otp-message error-message">
          <i className="fas fa-exclamation-circle"></i>
          {error}
        </div>
      )}

      {success && (
        <div className="otp-message success-message">
          <i className="fas fa-check-circle"></i>
          {success}
        </div>
      )}

      <div className="otp-resend">
        {timer > 0 ? (
          <span className="timer-text">
            Resend OTP in {timer}s
          </span>
        ) : (
          <button
            type="button"
            onClick={handleResend}
            disabled={disabled || loading}
            className="resend-button"
          >
            Resend OTP
          </button>
        )}
      </div>

      <div className="otp-help-text">
        Enter the 6-digit code sent to {identifier.includes('@') ? 'your email' : 'your phone'}
      </div>
    </div>
  );
};

export default OTPInput;
