import { useState, useEffect, useCallback } from "react";
import websocketService from "../services/websocketService";
import { useAuth } from "../contexts/AuthContext";

/**
 * Custom hook for real-time data using WebSocket
 * @param {Array} streams - List of data streams to subscribe to
 * @param {Object} options - Configuration options
 * @returns {Object} Real-time data and connection status
 */
export const useRealTimeData = (streams = [], options = {}) => {
  const { user } = useAuth();
  const [data, setData] = useState({});
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState(null);
  const [connecting, setConnecting] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(null);

  const {
    autoConnect = true,
    retryOnError = true,
    updateInterval = null,
  } = options;

  // Handle real-time data updates
  const handleDataUpdate = useCallback((eventType, newData) => {
    setData((prevData) => ({
      ...prevData,
      [eventType]: {
        ...newData,
        receivedAt: new Date().toISOString(),
      },
    }));
    setLastUpdate(new Date().toISOString());
  }, []);

  // Handle connection status changes
  const handleConnectionChange = useCallback((isConnected) => {
    setConnected(isConnected);
    setConnecting(false);
    if (isConnected) {
      setError(null);
    }
  }, []);

  // Handle errors
  const handleError = useCallback((error) => {
    console.error("WebSocket error:", error);
    setError(error);
    setConnecting(false);
  }, []);

  // Connect to WebSocket
  const connect = useCallback(async () => {
    if (websocketService.isConnected()) {
      console.log("Already connected to WebSocket");
      return;
    }

    setConnecting(true);
    setError(null);

    try {
      await websocketService.connect();
      console.log("WebSocket connected successfully");

      // Authenticate if user is available
      if (user) {
        websocketService.authenticate(user);
      }

      // Subscribe to requested streams
      if (streams.length > 0) {
        websocketService.subscribe(streams);
      }
    } catch (error) {
      console.error("Failed to connect to WebSocket:", error);
      setError(error);
      setConnecting(false);
    }
  }, [user, streams]);

  // Disconnect from WebSocket
  const disconnect = useCallback(() => {
    websocketService.disconnect();
    setConnected(false);
    setData({});
    setError(null);
  }, []);

  // Subscribe to additional streams
  const subscribe = useCallback((additionalStreams) => {
    if (websocketService.isConnected()) {
      websocketService.subscribe(additionalStreams);
    }
  }, []);

  // Unsubscribe from streams
  const unsubscribe = useCallback((streamsToRemove) => {
    if (websocketService.isConnected()) {
      websocketService.unsubscribe(streamsToRemove);
    }
  }, []);

  // Setup event listeners
  useEffect(() => {
    // Connection events
    const onConnected = () => handleConnectionChange(true);
    const onDisconnected = () => handleConnectionChange(false);
    const onError = (error) => handleError(error);

    // Data events
    const onDashboard = (data) => handleDataUpdate("dashboard", data);
    const onSystemMetrics = (data) => handleDataUpdate("systemMetrics", data);
    const onTrafficData = (data) => handleDataUpdate("trafficData", data);
    const onAlerts = (data) => handleDataUpdate("alerts", data);
    const onSumoStatus = (data) => handleDataUpdate("sumoStatus", data);

    // Register event listeners
    websocketService.on("connected", onConnected);
    websocketService.on("disconnected", onDisconnected);
    websocketService.on("error", onError);
    websocketService.on("dashboard", onDashboard);
    websocketService.on("systemMetrics", onSystemMetrics);
    websocketService.on("trafficData", onTrafficData);
    websocketService.on("alerts", onAlerts);
    websocketService.on("sumoStatus", onSumoStatus);

    // Cleanup event listeners on unmount
    return () => {
      websocketService.off("connected", onConnected);
      websocketService.off("disconnected", onDisconnected);
      websocketService.off("error", onError);
      websocketService.off("dashboard", onDashboard);
      websocketService.off("systemMetrics", onSystemMetrics);
      websocketService.off("trafficData", onTrafficData);
      websocketService.off("alerts", onAlerts);
      websocketService.off("sumoStatus", onSumoStatus);
    };
  }, [handleConnectionChange, handleError, handleDataUpdate]);

  // Auto-connect on mount if enabled
  useEffect(() => {
    if (autoConnect && !websocketService.isConnected() && !connecting) {
      connect();
    }

    return () => {
      // Don't disconnect on unmount by default - let other components use the connection
    };
  }, [autoConnect, connect, connecting]);

  // Re-authenticate when user changes
  useEffect(() => {
    if (user && websocketService.isConnected()) {
      websocketService.authenticate(user);
    }
  }, [user]);

  // Update subscriptions when streams change
  useEffect(() => {
    if (websocketService.isConnected() && streams.length > 0) {
      const currentSubscriptions = websocketService.getSubscriptions();

      // Find streams to add and remove
      const toAdd = streams.filter(
        (stream) => !currentSubscriptions.includes(stream)
      );
      const toRemove = currentSubscriptions.filter(
        (stream) => !streams.includes(stream)
      );

      if (toAdd.length > 0) {
        websocketService.subscribe(toAdd);
      }
      if (toRemove.length > 0) {
        websocketService.unsubscribe(toRemove);
      }
    }
  }, [streams]);

  // Get connection info
  const getConnectionInfo = useCallback(() => {
    return websocketService.getConnectionInfo();
  }, []);

  return {
    // Data
    data,
    lastUpdate,

    // Connection status
    connected,
    connecting,
    error,

    // Actions
    connect,
    disconnect,
    subscribe,
    unsubscribe,
    getConnectionInfo,

    // Convenience getters for specific data types
    dashboardData: data.dashboard,
    systemMetrics: data.systemMetrics,
    trafficData: data.trafficData,
    alerts: data.alerts,
    sumoStatus: data.sumoStatus,
  };
};

/**
 * Hook specifically for dashboard data
 */
export const useDashboardData = (options = {}) => {
  return useRealTimeData(["dashboard", "traffic", "sumo"], options);
};

/**
 * Hook specifically for system monitoring
 */
export const useSystemMetrics = (options = {}) => {
  return useRealTimeData(["system"], options);
};

/**
 * Hook specifically for traffic data
 */
export const useTrafficData = (options = {}) => {
  return useRealTimeData(["traffic"], options);
};

/**
 * Hook specifically for alerts
 */
export const useAlerts = (options = {}) => {
  return useRealTimeData(["alerts"], options);
};

/**
 * Hook specifically for SUMO status
 */
export const useSumoStatus = (options = {}) => {
  return useRealTimeData(["sumo"], options);
};

export default useRealTimeData;
