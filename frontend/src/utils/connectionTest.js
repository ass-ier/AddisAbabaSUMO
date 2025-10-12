// Connection test utilities for debugging SUMO integration issues

const API_BASE_URL = process.env.REACT_APP_API_BASE || "http://localhost:5001";

export const connectionTest = {
  // Test basic connectivity to backend
  async testBackendConnection() {
    try {
      const response = await fetch(`${API_BASE_URL}/api/health`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      return {
        success: true,
        status: response.status,
        message: `Backend reachable at ${API_BASE_URL}`
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        message: `Cannot connect to backend at ${API_BASE_URL}`
      };
    }
  },

  // Test authentication status
  async testAuthentication() {
    const token = sessionStorage.getItem("token");
    
    if (!token) {
      return {
        success: false,
        message: "No authentication token found in session storage"
      };
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/sumo/status`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        return {
          success: true,
          message: "Authentication successful",
          data: await response.json()
        };
      } else {
        return {
          success: false,
          status: response.status,
          message: `Authentication failed: ${response.status} ${response.statusText}`
        };
      }
    } catch (error) {
      return {
        success: false,
        error: error.message,
        message: "Authentication test failed"
      };
    }
  },

  // Test SUMO control endpoint
  async testSumoControl(command = "status") {
    const token = sessionStorage.getItem("token");
    
    try {
      const response = await fetch(`${API_BASE_URL}/api/sumo/control`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          command: "test_connection", // Test command
          parameters: {}
        })
      });

      const data = await response.json();
      
      return {
        success: response.ok,
        status: response.status,
        message: response.ok ? "SUMO control endpoint responsive" : data.message,
        data
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        message: "SUMO control endpoint test failed"
      };
    }
  },

  // Run all tests
  async runAllTests() {
    console.log("🔍 Running connection diagnostics...");
    
    const results = {
      backend: await this.testBackendConnection(),
      auth: await this.testAuthentication(),
      sumo: await this.testSumoControl()
    };

    console.log("📊 Diagnostic Results:", results);
    return results;
  },

  // Log connection info for debugging
  logConnectionInfo() {
    console.log("🔧 Connection Debug Info:");
    console.log("- API Base URL:", API_BASE_URL);
    console.log("- Has Auth Token:", !!sessionStorage.getItem("token"));
    console.log("- User Agent:", navigator.userAgent);
    console.log("- Current URL:", window.location.href);
    
    // Test if WebSocket is supported
    if (typeof WebSocket !== 'undefined') {
      console.log("- WebSocket Support: ✅");
    } else {
      console.log("- WebSocket Support: ❌");
    }
  }
};

export default connectionTest;