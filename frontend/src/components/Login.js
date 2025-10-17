import React, { useState, useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import OTPInput from "./OTPInput";
import "./Login.css";

const Login = () => {
  // Mode: only 'login' now
  const [mode] = useState('login');
  
  // Common fields
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  
  
  // Password reset fields
  const [identifier, setIdentifier] = useState(""); // email or phone for reset
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  
  // OTP state
  const [showOTP, setShowOTP] = useState(false);
  const [otpVerified, setOtpVerified] = useState(false);
  const [otpIdentifier, setOtpIdentifier] = useState("");
  const [otpPurpose, setOtpPurpose] = useState("");
  
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [deactModal, setDeactModal] = useState({ open: false, message: "" });
  const { login } = useAuth();
  const navigate = useNavigate();

  // Force light mode on login page
  useEffect(() => {
    // Save current theme to restore later
    const savedTheme = document.documentElement.getAttribute('data-theme');
    
    // Force light mode
    document.documentElement.setAttribute('data-theme', 'light');
    document.documentElement.classList.remove('dark');
    
    // Cleanup: restore theme when component unmounts (user logs in or navigates away)
    return () => {
      if (savedTheme) {
        document.documentElement.setAttribute('data-theme', savedTheme);
        if (savedTheme === 'dark') {
          document.documentElement.classList.add('dark');
        }
      }
    };
  }, []);

  // Clear messages when user changes input
  useEffect(() => {
    if (error || success) {
      setError("");
      setSuccess("");
    }
  }, [username, password, email, phone, identifier, newPassword]);

  // Reset form when mode changes
  const handleModeChange = (newMode) => {
    setMode(newMode);
    setError("");
    setSuccess("");
    setShowOTP(false);
    setOtpVerified(false);
    setUsername("");
    setPassword("");
    setEmail("");
    setPhone("");
    setIdentifier("");
    setNewPassword("");
    setConfirmNewPassword("");
  };

  // Handle login
  const handleLogin = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    if (!username.trim() || !password.trim()) {
      setError("Please enter both username and password");
      setIsLoading(false);
      return;
    }

    try {
      const user = await login(username, password);
      if (user?.forcePasswordChange) {
        navigate("/profile", { replace: true });
        return;
      }
      const role = user?.role;
      if (role === "super_admin") {
        navigate("/admin/users", { replace: true });
      } else {
        navigate("/dashboard", { replace: true });
      }
    } catch (err) {
      const msg = err.message || "Failed to log in. Please check your credentials.";
      if (err.status === 403 || /deactivat(ed|ion)/i.test(msg)) {
        setError("");
        setDeactModal({
          open: true,
          message: "Account deactivated. Please contact admin to activate.",
        });
      } else {
        setError(msg);
      }
    } finally {
      setIsLoading(false);
    }
  };


  // Send OTP for password reset
  const handleSendResetOTP = async () => {
    if (!identifier.trim()) {
      setError("Please enter your email or phone number");
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      const response = await fetch('http://localhost:5001/api/otp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identifier,
          purpose: 'password_reset',
          method: identifier.includes('@') ? 'email' : 'sms',
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setSuccess('OTP sent successfully! Check your ' + (identifier.includes('@') ? 'email' : 'phone'));
        setShowOTP(true);
        setOtpIdentifier(identifier);
        setOtpPurpose('password_reset');
      } else {
        setError(data.message || 'Failed to send OTP');
      }
    } catch (error) {
      console.error('Send OTP error:', error);
      setError('Failed to send OTP. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle password reset
  const handlePasswordReset = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    // Validation
    if (!newPassword.trim()) {
      setError("Please enter a new password");
      setIsLoading(false);
      return;
    }

    if (newPassword !== confirmNewPassword) {
      setError("Passwords do not match");
      setIsLoading(false);
      return;
    }

    if (newPassword.length < 6) {
      setError("Password must be at least 6 characters long");
      setIsLoading(false);
      return;
    }

    if (!otpVerified) {
      setError("Please verify your OTP first");
      setIsLoading(false);
      return;
    }

    try {
      const response = await fetch('http://localhost:5001/api/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identifier: otpIdentifier,
          newPassword,
          otpVerified: true,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setSuccess("Password reset successful! You can now login.");
        setTimeout(() => handleModeChange('login'), 2000);
      } else {
        setError(data.message || 'Password reset failed');
      }
    } catch (error) {
      console.error('Password reset error:', error);
      setError('Password reset failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle OTP completion
  const handleOTPComplete = (otp, verified) => {
    if (verified) {
      setOtpVerified(true);
      setSuccess("OTP verified successfully!");
    }
  };

  const handleDemoLogin = (demoUsername, demoPassword) => {
    setUsername(demoUsername);
    setPassword(demoPassword);
    setError("");
  };

  return (
    <div className="login-container">
      <div className="login-form">
        <div className="login-header">
          <h1>Addis Ababa Traffic Management System</h1>
          <p>Driving Addis Forward</p>
        </div>


        {error && (
          <div className="error-message" role="alert">
            {error}
          </div>
        )}

        {success && (
          <div className="success-message" role="alert">
            {success}
          </div>
        )}

        {/* LOGIN FORM */}
        {(
          <form onSubmit={handleLogin} noValidate>
            <div className="form-group">
              <label htmlFor="username">Username</label>
              <input
                type="text"
                id="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                placeholder="Enter your username"
                autoComplete="username"
                disabled={isLoading}
              />
            </div>

            <div className="form-group">
              <label htmlFor="password">Password</label>
              <div className="password-input-container">
                <input
                  type={showPassword ? "text" : "password"}
                  id="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  disabled={isLoading}
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowPassword(!showPassword)}
                  disabled={isLoading}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? "👁️" : "👁️‍🗨️"}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className={isLoading ? "loading" : ""}
            >
              {isLoading ? "Authenticating..." : "Login"}
            </button>

            <div className="login-footer">
              <p>Demo Credentials - Click to use:</p>
              <p onClick={() => handleDemoLogin("admin", "admin123")} style={{ cursor: "pointer" }}>
                Super Admin: admin / admin123
              </p>
              <p onClick={() => handleDemoLogin("operatornew", "operator123")} style={{ cursor: "pointer" }}>
                Operator: operatornew / operator123
              </p>
              <p onClick={() => handleDemoLogin("analystnew", "analyst123")} style={{ cursor: "pointer" }}>
                Analyst: analystnew / analyst123
              </p>
              <p onClick={() => handleDemoLogin("testuser", "test123")} style={{ cursor: "pointer" }}>
                Test User: testuser / test123
              </p>
            </div>
          </form>
        )}
      </div>

      {deactModal.open && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.4)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
          }}
          role="dialog"
          aria-modal="true"
        >
          <div
            style={{
              background: "#fff",
              borderRadius: 8,
              width: "min(460px, 92vw)",
              boxShadow: "0 10px 30px rgba(0,0,0,0.2)",
              padding: 20,
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 12,
              }}
            >
              <h3 style={{ margin: 0, fontSize: 18 }}>Login blocked</h3>
              <button
                onClick={() => setDeactModal({ open: false, message: "" })}
                style={{
                  background: "transparent",
                  border: "none",
                  fontSize: 18,
                  cursor: "pointer",
                }}
                aria-label="Close"
              >
                ×
              </button>
            </div>
            <p style={{ marginTop: 0, color: "#555" }}>{deactModal.message}</p>
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button
                className="btn-primary"
                onClick={() => setDeactModal({ open: false, message: "" })}
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Login;
