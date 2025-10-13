import io from "socket.io-client";

class WebSocketService {
  constructor() {
    this.socket = null;
    this.connected = false;
    this.subscriptions = new Map();
    this.listeners = new Map();
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 10;
    this.reconnectDelay = 1000;
    this.heartbeatInterval = null;
    this.connectionLost = false;
  }

  /**
   * Connect to the WebSocket server
   */
  connect() {
    if (this.socket?.connected) {
      console.log("WebSocket already connected");
      return Promise.resolve();
    }

    const serverUrl =
      process.env.REACT_APP_SERVER_URL || "http://localhost:5001";

    console.log("Connecting to WebSocket server:", serverUrl);

    this.socket = io(serverUrl, {
      withCredentials: true,
      transports: ["websocket", "polling"],
      timeout: 20000,
      forceNew: true,
      autoConnect: true,
    });

    return new Promise((resolve, reject) => {
      // Connection successful
      this.socket.on("connect", () => {
        console.log("✅ WebSocket connected:", this.socket.id);
        this.connected = true;
        this.reconnectAttempts = 0;
        this.connectionLost = false;
        this.startHeartbeat();

        // Trigger connection callback
        this.triggerEvent("connected", { clientId: this.socket.id });
        resolve();
      });

      // Connection confirmation from server
      this.socket.on("connected", (data) => {
        console.log("Server confirmed connection:", data);
        this.triggerEvent("server-connected", data);
      });

      // Authentication events
      this.socket.on("authenticated", (data) => {
        console.log("Authentication result:", data);
        this.triggerEvent("authenticated", data);
      });

      // Subscription events
      this.socket.on("subscribed", (data) => {
        console.log("Successfully subscribed to streams:", data.streams);
        this.triggerEvent("subscribed", data);
      });

      this.socket.on("unsubscribed", (data) => {
        console.log("Successfully unsubscribed from streams:", data.streams);
        this.triggerEvent("unsubscribed", data);
      });

      // Real-time data events
      this.socket.on("dashboard", (data) => {
        this.triggerEvent("dashboard", data);
      });

      this.socket.on("systemMetrics", (data) => {
        this.triggerEvent("systemMetrics", data);
      });

      this.socket.on("trafficData", (data) => {
        this.triggerEvent("trafficData", data);
      });

      this.socket.on("alerts", (data) => {
        this.triggerEvent("alerts", data);
      });

      this.socket.on("sumoStatus", (data) => {
        this.triggerEvent("sumoStatus", data);
      });

      // Error handling
      this.socket.on("connect_error", (error) => {
        console.error("WebSocket connection error:", error);
        this.connected = false;
        this.triggerEvent("error", error);

        if (this.reconnectAttempts === 0) {
          reject(error);
        }
      });

      // Disconnection handling
      this.socket.on("disconnect", (reason) => {
        console.warn("WebSocket disconnected:", reason);
        this.connected = false;
        this.connectionLost = true;
        this.stopHeartbeat();
        this.triggerEvent("disconnected", { reason });

        // Auto-reconnect logic
        if (reason !== "io client disconnect") {
          this.attemptReconnect();
        }
      });

      // Heartbeat response
      this.socket.on("pong", (data) => {
        // Connection is healthy
        this.connectionLost = false;
      });

      // Set connection timeout
      setTimeout(() => {
        if (!this.connected) {
          reject(new Error("Connection timeout"));
        }
      }, 10000);
    });
  }

  /**
   * Authenticate with the server
   */
  authenticate(user) {
    if (!this.socket || !this.connected) {
      console.warn("Cannot authenticate: not connected");
      return;
    }

    console.log("Authenticating user:", user.username);
    this.socket.emit("authenticate", { user });
  }

  /**
   * Subscribe to data streams
   */
  subscribe(streams = []) {
    if (!this.socket || !this.connected) {
      console.warn("Cannot subscribe: not connected");
      return;
    }

    console.log("Subscribing to streams:", streams);
    this.socket.emit("subscribe", { streams });

    // Store subscriptions
    streams.forEach((stream) => {
      this.subscriptions.set(stream, true);
    });
  }

  /**
   * Unsubscribe from data streams
   */
  unsubscribe(streams = []) {
    if (!this.socket || !this.connected) {
      console.warn("Cannot unsubscribe: not connected");
      return;
    }

    console.log("Unsubscribing from streams:", streams);
    this.socket.emit("unsubscribe", { streams });

    // Remove subscriptions
    streams.forEach((stream) => {
      this.subscriptions.delete(stream);
    });
  }

  /**
   * Add event listener
   */
  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(callback);
  }

  /**
   * Remove event listener
   */
  off(event, callback) {
    if (!this.listeners.has(event)) return;

    const callbacks = this.listeners.get(event);
    const index = callbacks.indexOf(callback);
    if (index > -1) {
      callbacks.splice(index, 1);
    }
  }

  /**
   * Trigger event listeners
   */
  triggerEvent(event, data) {
    if (!this.listeners.has(event)) return;

    this.listeners.get(event).forEach((callback) => {
      try {
        callback(data);
      } catch (error) {
        console.error(`Error in event listener for ${event}:`, error);
      }
    });
  }

  /**
   * Start heartbeat to detect connection issues
   */
  startHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }

    this.heartbeatInterval = setInterval(() => {
      if (this.socket && this.connected) {
        this.socket.emit("ping");

        // If no pong received in 10 seconds, consider connection lost
        setTimeout(() => {
          if (this.connectionLost) {
            console.warn("Heartbeat failed - connection may be lost");
            this.triggerEvent("connection-lost", {});
          }
        }, 10000);
      }
    }, 30000); // Ping every 30 seconds
  }

  /**
   * Stop heartbeat
   */
  stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  /**
   * Attempt to reconnect
   */
  attemptReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error("Max reconnection attempts reached");
      this.triggerEvent("reconnect-failed", {});
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);

    console.log(
      `Attempting to reconnect... (${this.reconnectAttempts}/${this.maxReconnectAttempts}) in ${delay}ms`
    );

    setTimeout(() => {
      this.connect().catch((error) => {
        console.error("Reconnection failed:", error);
        this.attemptReconnect();
      });
    }, delay);
  }

  /**
   * Disconnect from server
   */
  disconnect() {
    console.log("Disconnecting from WebSocket server");

    this.stopHeartbeat();

    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }

    this.connected = false;
    this.subscriptions.clear();
    this.listeners.clear();
  }

  /**
   * Get connection status
   */
  isConnected() {
    return this.connected && this.socket?.connected;
  }

  /**
   * Get subscriptions
   */
  getSubscriptions() {
    return Array.from(this.subscriptions.keys());
  }

  /**
   * Get connection info
   */
  getConnectionInfo() {
    return {
      connected: this.isConnected(),
      socketId: this.socket?.id,
      subscriptions: this.getSubscriptions(),
      reconnectAttempts: this.reconnectAttempts,
      connectionLost: this.connectionLost,
    };
  }
}

// Create singleton instance
const websocketService = new WebSocketService();

export default websocketService;
