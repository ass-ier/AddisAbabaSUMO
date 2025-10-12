const { Server } = require('socket.io');
const operatorAnalyticsService = require('./operator-analytics.service');
const systemMonitoringService = require('./system-monitoring.service');
const trafficService = require('./traffic.service');
const logger = require('../utils/logger');

/**
 * WebSocket Service
 * Handles real-time data streaming to connected clients
 */
class WebSocketService {
  constructor() {
    this.io = null;
    this.connectedClients = new Map();
    this.dataIntervals = new Map();
    this.isRunning = false;
    
    // Set global variables for monitoring
    global.wsConnections = 0;
    global.wsMessagesPerMinute = 0;
    this.messageCount = 0;
    this.lastMessageCountReset = Date.now();
  }

  /**
   * Initialize WebSocket server
   * @param {Object} httpServer - Express HTTP server instance
   */
  initialize(httpServer) {
    try {
      this.io = new Server(httpServer, {
        cors: {
          origin: [
            "http://localhost:3000",
            "http://127.0.0.1:3000",
            "http://localhost:3001",
            "http://127.0.0.1:3001"
          ],
          methods: ["GET", "POST"],
          credentials: true
        },
        pingTimeout: 60000,
        pingInterval: 25000
      });

      this.setupEventHandlers();
      this.startDataStreaming();
      this.isRunning = true;
      
      logger.info('WebSocket service initialized successfully');
      return this.io;
    } catch (error) {
      logger.error('Failed to initialize WebSocket service', { error: error.message });
      throw error;
    }
  }

  /**
   * Set up WebSocket event handlers
   */
  setupEventHandlers() {
    this.io.on('connection', (socket) => {
      const clientInfo = {
        id: socket.id,
        ip: socket.handshake.address,
        userAgent: socket.handshake.headers['user-agent'],
        connectedAt: new Date(),
        subscriptions: new Set(),
        user: null
      };

      this.connectedClients.set(socket.id, clientInfo);
      global.wsConnections = this.connectedClients.size;

      logger.info('Client connected', { 
        clientId: socket.id, 
        totalConnections: this.connectedClients.size 
      });

      // Handle authentication
      socket.on('authenticate', (data) => {
        this.handleAuthentication(socket, data);
      });

      // Handle subscription requests
      socket.on('subscribe', (data) => {
        this.handleSubscription(socket, data);
      });

      // Handle unsubscription requests
      socket.on('unsubscribe', (data) => {
        this.handleUnsubscription(socket, data);
      });

      // Handle ping/pong for connection health
      socket.on('ping', () => {
        socket.emit('pong', { timestamp: Date.now() });
      });

      // Handle disconnect
      socket.on('disconnect', (reason) => {
        this.handleDisconnect(socket, reason);
      });

      // Send initial connection confirmation
      socket.emit('connected', {
        clientId: socket.id,
        serverTime: new Date().toISOString(),
        availableStreams: this.getAvailableStreams()
      });
    });
  }

  /**
   * Handle client authentication
   */
  handleAuthentication(socket, data) {
    try {
      const client = this.connectedClients.get(socket.id);
      if (client && data.user) {
        client.user = data.user;
        this.connectedClients.set(socket.id, client);
        
        socket.emit('authenticated', { 
          success: true, 
          user: data.user 
        });
        
        logger.info('Client authenticated', { 
          clientId: socket.id, 
          username: data.user.username,
          role: data.user.role 
        });
      }
    } catch (error) {
      logger.error('Authentication error', { error: error.message });
      socket.emit('authenticated', { success: false, error: 'Authentication failed' });
    }
  }

  /**
   * Handle subscription to data streams
   */
  handleSubscription(socket, data) {
    try {
      const client = this.connectedClients.get(socket.id);
      if (!client) return;

      const { streams = [] } = data;
      streams.forEach(stream => {
        if (this.isValidStream(stream)) {
          client.subscriptions.add(stream);
        }
      });

      this.connectedClients.set(socket.id, client);
      
      socket.emit('subscribed', { 
        streams: Array.from(client.subscriptions),
        message: 'Successfully subscribed to data streams'
      });

      logger.debug('Client subscribed to streams', { 
        clientId: socket.id, 
        streams: Array.from(client.subscriptions) 
      });
    } catch (error) {
      logger.error('Subscription error', { error: error.message });
    }
  }

  /**
   * Handle unsubscription from data streams
   */
  handleUnsubscription(socket, data) {
    try {
      const client = this.connectedClients.get(socket.id);
      if (!client) return;

      const { streams = [] } = data;
      streams.forEach(stream => {
        client.subscriptions.delete(stream);
      });

      this.connectedClients.set(socket.id, client);
      
      socket.emit('unsubscribed', { 
        streams,
        message: 'Successfully unsubscribed from data streams'
      });
    } catch (error) {
      logger.error('Unsubscription error', { error: error.message });
    }
  }

  /**
   * Handle client disconnect
   */
  handleDisconnect(socket, reason) {
    const client = this.connectedClients.get(socket.id);
    this.connectedClients.delete(socket.id);
    global.wsConnections = this.connectedClients.size;

    logger.info('Client disconnected', { 
      clientId: socket.id, 
      reason,
      duration: client ? Date.now() - client.connectedAt.getTime() : 0,
      totalConnections: this.connectedClients.size 
    });
  }

  /**
   * Start data streaming intervals
   */
  startDataStreaming() {
    // Dashboard metrics - every 5 seconds
    this.dataIntervals.set('dashboard', setInterval(async () => {
      await this.broadcastDashboardData();
    }, 5000));

    // System metrics - every 10 seconds
    this.dataIntervals.set('system', setInterval(async () => {
      await this.broadcastSystemMetrics();
    }, 10000));

    // Traffic data - every 3 seconds
    this.dataIntervals.set('traffic', setInterval(async () => {
      await this.broadcastTrafficData();
    }, 3000));

    // Alerts - every 15 seconds
    this.dataIntervals.set('alerts', setInterval(async () => {
      await this.broadcastAlerts();
    }, 15000));

    // SUMO status - every 2 seconds
    this.dataIntervals.set('sumo', setInterval(async () => {
      await this.broadcastSUMOStatus();
    }, 2000));

    // Reset message counter every minute
    this.dataIntervals.set('messageCounter', setInterval(() => {
      global.wsMessagesPerMinute = this.messageCount;
      this.messageCount = 0;
    }, 60000));

    logger.info('Real-time data streaming started');
  }

  /**
   * Broadcast dashboard data to subscribed clients
   */
  async broadcastDashboardData() {
    try {
      // Only broadcast if there are connected clients
      if (this.connectedClients.size === 0) return;
      
      const data = await operatorAnalyticsService.getDashboardMetrics();
      this.broadcast('dashboard', data, 'dashboard');
    } catch (error) {
      logger.debug('Error broadcasting dashboard data', { error: error.message });
      // Don't crash - just skip this broadcast cycle
    }
  }

  /**
   * Broadcast system metrics to subscribed clients
   */
  async broadcastSystemMetrics() {
    try {
      // Only broadcast if there are connected clients
      if (this.connectedClients.size === 0) return;
      
      const metrics = systemMonitoringService.getMetrics();
      const health = systemMonitoringService.getHealthSummary();
      
      const data = {
        metrics,
        health,
        timestamp: new Date().toISOString()
      };
      
      this.broadcast('systemMetrics', data, 'system');
    } catch (error) {
      logger.debug('Error broadcasting system metrics', { error: error.message });
      // Don't crash - just skip this broadcast cycle
    }
  }

  /**
   * Broadcast traffic data to subscribed clients
   */
  async broadcastTrafficData() {
    try {
      // Only broadcast if there are connected clients
      if (this.connectedClients.size === 0) return;
      
      const [overview, stats] = await Promise.all([
        operatorAnalyticsService.getTrafficOverview(),
        trafficService.getStatistics({ limit: 50 })
      ]);

      const data = {
        overview,
        stats,
        timestamp: new Date().toISOString()
      };

      this.broadcast('trafficData', data, 'traffic');
    } catch (error) {
      logger.debug('Error broadcasting traffic data', { error: error.message });
      // Don't crash - just skip this broadcast cycle
    }
  }

  /**
   * Broadcast alerts to subscribed clients
   */
  async broadcastAlerts() {
    try {
      // Only broadcast if there are connected clients
      if (this.connectedClients.size === 0) return;
      
      const alerts = await operatorAnalyticsService.getAlerts();
      this.broadcast('alerts', alerts, 'alerts');
    } catch (error) {
      logger.debug('Error broadcasting alerts', { error: error.message });
      // Don't crash - just skip this broadcast cycle
    }
  }

  /**
   * Broadcast SUMO status to subscribed clients
   */
  async broadcastSUMOStatus() {
    try {
      const sumoService = require('./sumo-subprocess.service');
      const isRunning = sumoService.getIsRunning();
      const processInfo = sumoService.getProcessInfo();

      const data = {
        isRunning,
        processInfo,
        timestamp: new Date().toISOString()
      };

      this.broadcast('sumoStatus', data, 'sumo');
    } catch (error) {
      logger.debug('SUMO service not available or not running');
      // Don't log this as an error since SUMO might not be running
      const data = {
        isRunning: false,
        processInfo: null,
        timestamp: new Date().toISOString()
      };
      this.broadcast('sumoStatus', data, 'sumo');
    }
  }

  /**
   * Broadcast data to subscribed clients
   * @param {string} event - Event name
   * @param {Object} data - Data to send
   * @param {string} stream - Stream name for subscription filtering
   */
  broadcast(event, data, stream = null) {
    if (!this.io) return;

    let targetClients = this.connectedClients;
    
    // Filter by subscription if stream is specified
    if (stream) {
      targetClients = new Map();
      for (const [clientId, client] of this.connectedClients) {
        if (client.subscriptions.has(stream)) {
          targetClients.set(clientId, client);
        }
      }
    }

    // Send to all target clients
    for (const [clientId] of targetClients) {
      const socket = this.io.sockets.sockets.get(clientId);
      if (socket) {
        socket.emit(event, data);
        this.messageCount++;
      }
    }

    // Also broadcast to all if no specific subscriptions
    if (!stream || targetClients.size === 0) {
      this.io.emit(event, data);
      this.messageCount += this.connectedClients.size;
    }
  }

  /**
   * Send data to a specific client
   * @param {string} clientId - Client socket ID
   * @param {string} event - Event name
   * @param {Object} data - Data to send
   */
  sendToClient(clientId, event, data) {
    if (!this.io) return;

    const socket = this.io.sockets.sockets.get(clientId);
    if (socket) {
      socket.emit(event, data);
      this.messageCount++;
    }
  }

  /**
   * Get list of available data streams
   */
  getAvailableStreams() {
    return [
      'dashboard',
      'system',
      'traffic',
      'alerts',
      'sumo'
    ];
  }

  /**
   * Check if stream name is valid
   */
  isValidStream(stream) {
    return this.getAvailableStreams().includes(stream);
  }

  /**
   * Get WebSocket statistics
   */
  getStats() {
    return {
      isRunning: this.isRunning,
      connectedClients: this.connectedClients.size,
      messagesPerMinute: global.wsMessagesPerMinute,
      availableStreams: this.getAvailableStreams(),
      activeIntervals: this.dataIntervals.size
    };
  }

  /**
   * Stop all data streaming
   */
  stop() {
    // Clear all intervals
    for (const [name, interval] of this.dataIntervals) {
      clearInterval(interval);
      logger.debug(`Stopped ${name} data streaming interval`);
    }
    this.dataIntervals.clear();

    // Close all connections
    if (this.io) {
      this.io.close();
    }

    this.isRunning = false;
    global.wsConnections = 0;
    global.wsMessagesPerMinute = 0;
    
    logger.info('WebSocket service stopped');
  }

  /**
   * Get connected clients info (for admin purposes)
   */
  getConnectedClients() {
    const clients = [];
    for (const [clientId, client] of this.connectedClients) {
      clients.push({
        id: clientId,
        connectedAt: client.connectedAt,
        subscriptions: Array.from(client.subscriptions),
        user: client.user ? {
          username: client.user.username,
          role: client.user.role
        } : null,
        ip: client.ip
      });
    }
    return clients;
  }
}

module.exports = new WebSocketService();