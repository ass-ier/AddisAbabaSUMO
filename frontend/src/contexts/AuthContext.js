import React, { createContext, useContext, useState, useEffect } from "react";
import axios from "axios";

// Configure axios early so calls from components (login/validate) use correct backend
const BASE_API = process.env.REACT_APP_API_BASE || "http://localhost:5001";
axios.defaults.baseURL = BASE_API;
axios.defaults.withCredentials = true;

const AuthContext = createContext();

export const useAuth = () => {
  return useContext(AuthContext);
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // axios defaults are configured at module scope so requests from child
    // components during initial render use the correct backend.

    // Install a single axios interceptor for auth failures
    const interceptorId = axios.interceptors.response.use(
      (response) => response,
      (error) => {
        const status = error?.response?.status;
        if (status === 401 || status === 403) {
          sessionStorage.removeItem("token");
          sessionStorage.removeItem("user");
          delete axios.defaults.headers.common["Authorization"];
          setUser(null);
          if (window.location.pathname !== "/login") {
            window.location.replace("/login");
          }
        }
        return Promise.reject(error);
      }
    );

    // Check if user is logged in on app load using a stored token ONLY
    // This prevents auto-login from cookie-only sessions and ensures the login page shows first
    const token = sessionStorage.getItem("token");
    if (token) {
      axios.defaults.headers.common["Authorization"] = `Bearer ${token}`;
      axios
        .get("/api/auth/validate")
        .then((res) => {
          const validUser = res.data?.user;
          if (validUser) {
            setUser(validUser);
            sessionStorage.setItem("user", JSON.stringify(validUser));
          } else {
            sessionStorage.removeItem("token");
            sessionStorage.removeItem("user");
            delete axios.defaults.headers.common["Authorization"];
            setUser(null);
          }
        })
        .catch(() => {
          sessionStorage.removeItem("token");
          sessionStorage.removeItem("user");
          delete axios.defaults.headers.common["Authorization"];
          setUser(null);
        })
        .finally(() => setLoading(false));
    } else {
      // No token stored; show the login screen without attempting cookie-based validation
      setLoading(false);
    }

    return () => {
      axios.interceptors.response.eject(interceptorId);
    };
  }, []);

  const login = async (username, password) => {
    try {
      const response = await axios.post(
        "/api/login",
        { username, password },
        { withCredentials: true }
      );

      const { token, user: userData } = response.data;

      if (token) {
        sessionStorage.setItem("token", token);
        axios.defaults.headers.common["Authorization"] = `Bearer ${token}`;
      }
      sessionStorage.setItem("user", JSON.stringify(userData));
      setUser(userData);

      return userData;
    } catch (error) {
      throw new Error(error.response?.data?.message || "Login failed");
    }
  };

  const logout = async () => {
    try {
      await axios.post("/api/logout", {}, { withCredentials: true });
    } catch {}
    sessionStorage.removeItem("token");
    sessionStorage.removeItem("user");
    delete axios.defaults.headers.common["Authorization"];
    setUser(null);
  };

  const value = {
    user,
    login,
    logout,
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};
