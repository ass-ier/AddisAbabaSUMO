import React, { useState, useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import "./Login.css";

const Login = () => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  // Clear error when user starts typing
  useEffect(() => {
    if (error && (username || password)) {
      setError("");
    }
  }, [username, password, error]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    // Basic validation
    if (!username.trim() || !password.trim()) {
      setError("Please enter both username and password");
      setIsLoading(false);
      return;
    }

    try {
      const user = await login(username, password);
      // Role-based redirect
      const role = user?.role;
      if (role === "super_admin") {
        navigate("/admin/users", { replace: true });
      } else if (role === "operator" || role === "analyst") {
        navigate("/dashboard", { replace: true });
      } else {
        navigate("/dashboard", { replace: true });
      }
    } catch (err) {
      setError(
        err.message || "Failed to log in. Please check your credentials."
      );
    } finally {
      setIsLoading(false);
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

        <form onSubmit={handleSubmit} noValidate>
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
            aria-label={isLoading ? "Signing in..." : "Sign in to dashboard"}
          >
            {isLoading ? "Authenticating..." : "Login"}
          </button>
        </form>

        <div className="login-footer">
          <p>Demo Credentials - Click to use:</p>
          <p
            onClick={() => handleDemoLogin("admin", "admin123")}
            style={{ cursor: "pointer" }}
            title="Click to use these credentials"
          >
            Super Admin: admin / admin123
          </p>
          <p
            onClick={() => handleDemoLogin("operatornew", "operator123")}
            style={{ cursor: "pointer" }}
            title="Click to use these credentials"
          >
            Operator: operatornew / operator123
          </p>
          <p
            onClick={() => handleDemoLogin("analystnew", "analyst123")}
            style={{ cursor: "pointer" }}
            title="Click to use these credentials"
          >
            Analyst: analystnew / analyst123
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
