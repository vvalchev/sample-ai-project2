/**
 * Socket Service
 * Manages WebSocket connections and real-time messaging
 */

const { Server } = require('socket.io');
const { validateSocketTenant } = require('../middleware/tenantMiddleware');
const tenantService = require('./tenantService');

class SocketService {
  constructor() {
    this.io = null;
    this.connectedClients = new Map(); // Track connected clients by tenant
  }

  /**
   * Initialize Socket.io server
   * @param {Object} server - HTTP server instance
   * @param {Object} corsOptions - CORS configuration
   */
  initialize(server, corsOptions) {
    this.io = new Server(server, {
      cors: corsOptions,
      transports: ['websocket', 'polling'],
      pingTimeout: 60000,
      pingInterval: 25000,
    });

    // Add tenant validation middleware
    this.io.use(validateSocketTenant);

    // Handle client connections
    this.io.on('connection', (socket) => {
      this.handleConnection(socket);
    });

    console.log('[SOCKET_SERVICE] WebSocket server initialized');
  }

  /**
   * Subscribe to EventService events for automatic broadcasting
   * @param {EventEmitter} eventService - The event service instance
   */
  subscribeToEventService(eventService) {
    eventService.on('eventCreated', ({ tenantId, event }) => {
      this.broadcastToTenant(tenantId, event);
    });

    console.log('[SOCKET_SERVICE] Subscribed to EventService events');
  }

  /**
   * Handle new socket connection
   * @param {Object} socket - Socket.io socket instance
   */
  handleConnection(socket) {
    const tenantId = socket.tenantId;

    // Join tenant-specific room
    socket.join(tenantId);

    // Track connection
    if (!this.connectedClients.has(tenantId)) {
      this.connectedClients.set(tenantId, new Set());
    }
    this.connectedClients.get(tenantId).add(socket.id);

    console.log(`[SOCKET_CONNECT] Tenant: ${tenantId}, Socket: ${socket.id}, Room joined`);

    // Send connection confirmation
    socket.emit('connection_established', {
      tenantId: tenantId,
      timestamp: new Date().toISOString(),
      message: 'Connected to event stream',
    });

    // Send recent events to newly connected client
    try {
      const recentEvents = tenantService.getEvents(tenantId, 10);
      if (recentEvents.length > 0) {
        socket.emit('initial_events', {
          events: recentEvents,
          count: recentEvents.length,
        });
      }
    } catch (error) {
      console.error(`[SOCKET_ERROR] Failed to send initial events: ${error.message}`);
    }

    // Handle client disconnect
    socket.on('disconnect', (reason) => {
      this.handleDisconnection(socket, reason);
    });

    // Handle client errors
    socket.on('error', (error) => {
      console.error(`[SOCKET_ERROR] Socket: ${socket.id}, Error: ${error.message}`);
    });

    // Optional: Handle heartbeat/ping for connection monitoring
    socket.on('ping', () => {
      socket.emit('pong', { timestamp: new Date().toISOString() });
    });
  }

  /**
   * Handle socket disconnection
   * @param {Object} socket - Socket.io socket instance
   * @param {string} reason - Disconnection reason
   */
  handleDisconnection(socket, reason) {
    const tenantId = socket.tenantId;

    // Remove from tracking
    if (this.connectedClients.has(tenantId)) {
      this.connectedClients.get(tenantId).delete(socket.id);

      // Clean up empty tenant sets
      if (this.connectedClients.get(tenantId).size === 0) {
        this.connectedClients.delete(tenantId);
      }
    }

    console.log(`[SOCKET_DISCONNECT] Tenant: ${tenantId}, Socket: ${socket.id}, Reason: ${reason}`);
  }

  /**
   * Broadcast event to all clients in a tenant
   * @param {string} tenantId - The tenant identifier
   * @param {Object} event - The event to broadcast
   */
  broadcastToTenant(tenantId, event) {
    if (!tenantService.isValidTenant(tenantId)) {
      console.error(`[SOCKET_BROADCAST_ERROR] Invalid tenant: ${tenantId}`);
      return;
    }

    // Broadcast to all sockets in the tenant room
    this.io.to(tenantId).emit('event_created', {
      event: event,
      timestamp: new Date().toISOString(),
    });

    console.log(
      `[SOCKET_BROADCAST] Tenant: ${tenantId}, Event: ${event.id}, Clients: ${this.getConnectedClientCount(tenantId)}`
    );
  }

  /**
   * Get the number of connected clients for a tenant
   * @param {string} tenantId - The tenant identifier
   * @returns {number} - Number of connected clients
   */
  getConnectedClientCount(tenantId) {
    return this.connectedClients.has(tenantId) ? this.connectedClients.get(tenantId).size : 0;
  }

  /**
   * Get connection statistics
   * @returns {Object} - Connection statistics
   */
  getConnectionStats() {
    const stats = {
      totalConnections: 0,
      tenantConnections: {},
    };

    for (const [tenantId, clients] of this.connectedClients) {
      const count = clients.size;
      stats.tenantConnections[tenantId] = count;
      stats.totalConnections += count;
    }

    return stats;
  }

  /**
   * Broadcast system message to all clients
   * @param {string} message - The system message
   */
  broadcastSystemMessage(message) {
    this.io.emit('system_message', {
      message: message,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Disconnect all clients (useful for maintenance)
   */
  disconnectAll() {
    this.io.disconnectSockets();
    this.connectedClients.clear();
    console.log('[SOCKET_SERVICE] All clients disconnected');
  }
}

// Export singleton instance
module.exports = new SocketService();
