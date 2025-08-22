/**
 * Integration tests for WebSocket functionality
 */

const http = require('http');
const { Server } = require('socket.io');
const Client = require('socket.io-client');
const express = require('express');
const socketService = require('../../src/services/socketService');
const tenantService = require('../../src/services/tenantService');
const eventService = require('../../src/services/eventService');

describe('WebSocket Integration Tests', () => {
  let server, io, clientSocket1, clientSocket2, port;

  beforeAll((done) => {
    const app = express();
    server = http.createServer(app);
    port = 3001; // Use different port for testing
    
    // Initialize socket service
    socketService.initialize(server, {
      origin: `http://localhost:${port}`,
      credentials: true
    });

    // Subscribe SocketService to EventService for automatic broadcasting
    socketService.subscribeToEventService(eventService);

    server.listen(port, () => {
      done();
    });
  });

  afterAll((done) => {
    server.close(done);
  });

  beforeEach(() => {
    // Clear all tenant events before each test
    tenantService.getSupportedTenants().forEach(tenantId => {
      tenantService.clearTenantEvents(tenantId);
    });
    
    // Clear socket service connections
    if (socketService.connectedClients) {
      socketService.connectedClients.clear();
    }
  });

  afterEach(() => {
    // Disconnect all clients after each test
    if (clientSocket1) {
      clientSocket1.disconnect();
      clientSocket1 = null;
    }
    if (clientSocket2) {
      clientSocket2.disconnect();
      clientSocket2 = null;
    }
  });

  describe('Connection establishment', () => {
    test('should connect successfully with valid tenant', (done) => {
      clientSocket1 = new Client(`http://localhost:${port}`, {
        query: { tenant: 'tenant_a' }
      });

      clientSocket1.on('connect', () => {
        expect(clientSocket1.connected).toBe(true);
        done();
      });

      clientSocket1.on('connect_error', (error) => {
        done(error);
      });
    });

    test('should reject connection with missing tenant', (done) => {
      clientSocket1 = new Client(`http://localhost:${port}`);

      clientSocket1.on('connect', () => {
        done(new Error('Should not connect without tenant'));
      });

      clientSocket1.on('connect_error', (error) => {
        expect(error.message).toBe('Missing tenant query parameter');
        done();
      });
    });

    test('should reject connection with invalid tenant', (done) => {
      clientSocket1 = new Client(`http://localhost:${port}`, {
        query: { tenant: 'invalid_tenant' }
      });

      clientSocket1.on('connect', () => {
        done(new Error('Should not connect with invalid tenant'));
      });

      clientSocket1.on('connect_error', (error) => {
        expect(error.message).toBe('Invalid tenant ID');
        done();
      });
    });

    test('should send connection confirmation', (done) => {
      clientSocket1 = new Client(`http://localhost:${port}`, {
        query: { tenant: 'tenant_a' }
      });

      clientSocket1.on('connection_established', (data) => {
        expect(data).toHaveProperty('tenantId', 'tenant_a');
        expect(data).toHaveProperty('timestamp');
        expect(data).toHaveProperty('message', 'Connected to event stream');
        done();
      });
    });

    test('should send initial events to newly connected client', (done) => {
      // Create some events first
      eventService.createEvent('tenant_a', 'Initial event 1');
      eventService.createEvent('tenant_a', 'Initial event 2');

      clientSocket1 = new Client(`http://localhost:${port}`, {
        query: { tenant: 'tenant_a' }
      });

      clientSocket1.on('initial_events', (data) => {
        expect(data).toHaveProperty('events');
        expect(data).toHaveProperty('count');
        expect(data.events.length).toBe(2);
        expect(data.count).toBe(2);
        done();
      });
    });
  });

  describe('Event broadcasting', () => {
    beforeEach((done) => {
      // Connect two clients for the same tenant
      clientSocket1 = new Client(`http://localhost:${port}`, {
        query: { tenant: 'tenant_a' }
      });
      
      clientSocket2 = new Client(`http://localhost:${port}`, {
        query: { tenant: 'tenant_a' }
      });

      let connectedCount = 0;
      const checkConnected = () => {
        connectedCount++;
        if (connectedCount === 2) {
          done();
        }
      };

      clientSocket1.on('connect', checkConnected);
      clientSocket2.on('connect', checkConnected);
    });

    test('should broadcast event to all clients in same tenant', (done) => {
      let receivedCount = 0;
      const testEvent = { id: 'test-123', tenant_id: 'tenant_a', message: 'Test broadcast' };

      const checkReceived = (data) => {
        expect(data).toHaveProperty('event');
        expect(data.event.id).toBe('test-123');
        expect(data.event.message).toBe('Test broadcast');
        
        receivedCount++;
        if (receivedCount === 2) {
          done();
        }
      };

      clientSocket1.on('event_created', checkReceived);
      clientSocket2.on('event_created', checkReceived);

      // Simulate event broadcast
      setTimeout(() => {
        socketService.broadcastToTenant('tenant_a', testEvent);
      }, 100);
    });

    test('should maintain tenant isolation in broadcasting', (done) => {
      // Connect client for different tenant
      const clientSocketB = new Client(`http://localhost:${port}`, {
        query: { tenant: 'tenant_b' }
      });

      clientSocketB.on('connect', () => {
        const testEventA = { id: 'test-a', tenant_id: 'tenant_a', message: 'Event for A' };
        const testEventB = { id: 'test-b', tenant_id: 'tenant_b', message: 'Event for B' };

        let receivedA = false;
        let receivedB = false;

        // Client A should only receive events for tenant A
        clientSocket1.on('event_created', (data) => {
          expect(data.event.tenant_id).toBe('tenant_a');
          expect(data.event.message).toBe('Event for A');
          receivedA = true;
          checkCompletion();
        });

        // Client B should only receive events for tenant B
        clientSocketB.on('event_created', (data) => {
          expect(data.event.tenant_id).toBe('tenant_b');
          expect(data.event.message).toBe('Event for B');
          receivedB = true;
          checkCompletion();
        });

        const checkCompletion = () => {
          if (receivedA && receivedB) {
            clientSocketB.disconnect();
            done();
          }
        };

        // Broadcast events to different tenants
        setTimeout(() => {
          socketService.broadcastToTenant('tenant_a', testEventA);
          socketService.broadcastToTenant('tenant_b', testEventB);
        }, 100);
      });
    });

    test('should handle broadcast to tenant with no connected clients', () => {
      const testEvent = { id: 'test-123', tenant_id: 'tenant_b', message: 'No clients' };
      
      // This should not throw an error
      expect(() => {
        socketService.broadcastToTenant('tenant_b', testEvent);
      }).not.toThrow();
    });

    test('should handle broadcast to invalid tenant', () => {
      const testEvent = { id: 'test-123', tenant_id: 'invalid_tenant', message: 'Invalid' };
      
      // Should log error but not throw
      expect(() => {
        socketService.broadcastToTenant('invalid_tenant', testEvent);
      }).not.toThrow();
    });
  });

  describe('Connection management', () => {
    test('should track connected clients correctly', (done) => {
      clientSocket1 = new Client(`http://localhost:${port}`, {
        query: { tenant: 'tenant_a' }
      });

      clientSocket1.on('connect', () => {
        // Check connection stats
        const stats = socketService.getConnectionStats();
        expect(stats.totalConnections).toBe(1);
        expect(stats.tenantConnections.tenant_a).toBe(1);
        done();
      });
    });

    test('should update stats when client disconnects', (done) => {
      clientSocket1 = new Client(`http://localhost:${port}`, {
        query: { tenant: 'tenant_a' }
      });

      clientSocket1.on('connect', () => {
        // Verify connected
        const statsConnected = socketService.getConnectionStats();
        expect(statsConnected.totalConnections).toBe(1);

        // Disconnect and check again
        clientSocket1.disconnect();
        
        setTimeout(() => {
          const statsDisconnected = socketService.getConnectionStats();
          expect(statsDisconnected.totalConnections).toBe(0);
          done();
        }, 100);
      });
    });

    test('should handle multiple clients for same tenant', (done) => {
      clientSocket1 = new Client(`http://localhost:${port}`, {
        query: { tenant: 'tenant_a' }
      });
      
      clientSocket2 = new Client(`http://localhost:${port}`, {
        query: { tenant: 'tenant_a' }
      });

      let connectedCount = 0;
      const checkConnected = () => {
        connectedCount++;
        if (connectedCount === 2) {
          const stats = socketService.getConnectionStats();
          expect(stats.totalConnections).toBe(2);
          expect(stats.tenantConnections.tenant_a).toBe(2);
          done();
        }
      };

      clientSocket1.on('connect', checkConnected);
      clientSocket2.on('connect', checkConnected);
    });

    test('should handle ping/pong for connection monitoring', (done) => {
      clientSocket1 = new Client(`http://localhost:${port}`, {
        query: { tenant: 'tenant_a' }
      });

      clientSocket1.on('connect', () => {
        clientSocket1.emit('ping');
      });

      clientSocket1.on('pong', (data) => {
        expect(data).toHaveProperty('timestamp');
        done();
      });
    });
  });

  describe('System messaging', () => {
    beforeEach((done) => {
      clientSocket1 = new Client(`http://localhost:${port}`, {
        query: { tenant: 'tenant_a' }
      });

      clientSocket1.on('connect', () => {
        done();
      });
    });

    test('should receive system messages', (done) => {
      clientSocket1.on('system_message', (data) => {
        expect(data).toHaveProperty('message', 'Test system message');
        expect(data).toHaveProperty('timestamp');
        done();
      });

      setTimeout(() => {
        socketService.broadcastSystemMessage('Test system message');
      }, 100);
    });
  });

  describe('Error handling', () => {
    test('should handle socket errors gracefully', (done) => {
      clientSocket1 = new Client(`http://localhost:${port}`, {
        query: { tenant: 'tenant_a' }
      });

      clientSocket1.on('connect', () => {
        // Simulate error
        clientSocket1.emit('error', new Error('Test error'));
        
        // Should not crash the application
        setTimeout(() => {
          expect(clientSocket1.connected).toBe(true);
          done();
        }, 100);
      });
    });

    test('should handle unexpected disconnections', (done) => {
      clientSocket1 = new Client(`http://localhost:${port}`, {
        query: { tenant: 'tenant_a' }
      });

      clientSocket1.on('connect', () => {
        const stats = socketService.getConnectionStats();
        expect(stats.totalConnections).toBe(1);

        // Force disconnect
        clientSocket1.disconnect();
      });

      clientSocket1.on('disconnect', () => {
        setTimeout(() => {
          const stats = socketService.getConnectionStats();
          expect(stats.totalConnections).toBe(0);
          done();
        }, 100);
      });
    });
  });

  describe('Real-time integration with event service', () => {
    beforeEach((done) => {
      clientSocket1 = new Client(`http://localhost:${port}`, {
        query: { tenant: 'tenant_a' }
      });

      clientSocket1.on('connect', () => {
        done();
      });
    });

    test('should broadcast when event is created via service', (done) => {
      // Set longer timeout for this test
      jest.setTimeout(15000);
      
      let timeoutId;
      let testCompleted = false;
      
      const completeTest = (error) => {
        if (testCompleted) return;
        testCompleted = true;
        
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
        
        if (error) {
          done(error);
        } else {
          done();
        }
      };
      
      clientSocket1.on('event_created', (data) => {
        expect(data.event.message).toBe('Test real-time event');
        expect(data.event.tenant_id).toBe('tenant_a');
        completeTest();
      });

      // Create event via service (this should trigger broadcast)
      setTimeout(() => {
        try {
          eventService.createEvent('tenant_a', 'Test real-time event');
        } catch (error) {
          completeTest(error);
        }
      }, 100);
      
      // Fallback timeout to prevent hanging
      timeoutId = setTimeout(() => {
        completeTest(new Error('Event was not broadcasted within expected timeframe'));
      }, 5000);
    }, 15000);
  });
});
