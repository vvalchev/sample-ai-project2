/**
 * Integration tests for API endpoints
 */

const request = require('supertest');
const { app } = require('../../src/app');
const tenantService = require('../../src/services/tenantService');

describe('API Integration Tests', () => {
  beforeEach(() => {
    // Clear all tenant events before each test
    tenantService.getSupportedTenants().forEach(tenantId => {
      tenantService.clearTenantEvents(tenantId);
    });
  });

  describe('POST /api/events', () => {
    test('should create event successfully with valid data', async () => {
      const eventData = { message: 'Test event message' };
      
      const response = await request(app)
        .post('/api/events')
        .set('X-Tenant-ID', 'tenant_a')
        .send(eventData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('id');
      expect(response.body.data).toHaveProperty('tenant_id', 'tenant_a');
      expect(response.body.data).toHaveProperty('message', 'Test event message');
      expect(response.body.data).toHaveProperty('timestamp');
    });

    test('should return 400 for missing tenant header', async () => {
      const eventData = { message: 'Test event message' };
      
      const response = await request(app)
        .post('/api/events')
        .send(eventData)
        .expect(400);

      expect(response.body.error).toBe('Missing X-Tenant-ID header');
      expect(response.body.code).toBe('MISSING_TENANT_HEADER');
    });

    test('should return 400 for invalid tenant', async () => {
      const eventData = { message: 'Test event message' };
      
      const response = await request(app)
        .post('/api/events')
        .set('X-Tenant-ID', 'invalid_tenant')
        .send(eventData)
        .expect(400);

      expect(response.body.error).toBe('Invalid tenant ID');
      expect(response.body.code).toBe('INVALID_TENANT_ID');
      expect(response.body.supportedTenants).toEqual(['tenant_a', 'tenant_b']);
    });

    test('should return 400 for missing message', async () => {
      const response = await request(app)
        .post('/api/events')
        .set('X-Tenant-ID', 'tenant_a')
        .send({})
        .expect(400);

      expect(response.body.error).toBe('Validation failed');
      expect(response.body.code).toBe('VALIDATION_ERROR');
    });

    test('should return 400 for empty message', async () => {
      const response = await request(app)
        .post('/api/events')
        .set('X-Tenant-ID', 'tenant_a')
        .send({ message: '' })
        .expect(400);

      expect(response.body.error).toBe('Validation failed');
    });

    test('should return 400 for message exceeding max length', async () => {
      const longMessage = 'a'.repeat(501);
      
      const response = await request(app)
        .post('/api/events')
        .set('X-Tenant-ID', 'tenant_a')
        .send({ message: longMessage })
        .expect(400);

      expect(response.body.error).toBe('Validation failed');
    });

    test('should sanitize message content', async () => {
      const maliciousMessage = '<script>alert("xss")</script>';
      
      const response = await request(app)
        .post('/api/events')
        .set('X-Tenant-ID', 'tenant_a')
        .send({ message: maliciousMessage })
        .expect(201);

      expect(response.body.data.message).toBe('&lt;script&gt;alert(&quot;xss&quot;)&lt;&#x2F;script&gt;');
    });

    test('should trim whitespace from message', async () => {
      const response = await request(app)
        .post('/api/events')
        .set('X-Tenant-ID', 'tenant_a')
        .send({ message: '  Test message  ' })
        .expect(201);

      expect(response.body.data.message).toBe('Test message');
    });

    test('should maintain tenant isolation in event creation', async () => {
      // Create event for tenant A
      await request(app)
        .post('/api/events')
        .set('X-Tenant-ID', 'tenant_a')
        .send({ message: 'Message for A' })
        .expect(201);

      // Create event for tenant B
      await request(app)
        .post('/api/events')
        .set('X-Tenant-ID', 'tenant_b')
        .send({ message: 'Message for B' })
        .expect(201);

      // Verify isolation
      expect(tenantService.getEventCount('tenant_a')).toBe(1);
      expect(tenantService.getEventCount('tenant_b')).toBe(1);
    });
  });

  describe('GET /api/events', () => {
    beforeEach(async () => {
      // Create test events
      await request(app)
        .post('/api/events')
        .set('X-Tenant-ID', 'tenant_a')
        .send({ message: 'Message 1' });

      await request(app)
        .post('/api/events')
        .set('X-Tenant-ID', 'tenant_a')
        .send({ message: 'Message 2' });

      await request(app)
        .post('/api/events')
        .set('X-Tenant-ID', 'tenant_b')
        .send({ message: 'Message for B' });
    });

    test('should return events for specified tenant', async () => {
      const response = await request(app)
        .get('/api/events')
        .set('X-Tenant-ID', 'tenant_a')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.events).toHaveLength(2);
      expect(response.body.data.count).toBe(2);
      expect(response.body.data.tenant).toBe('tenant_a');
      
      // Verify tenant isolation
      response.body.data.events.forEach(event => {
        expect(event.tenant_id).toBe('tenant_a');
      });
    });

    test('should return 400 for missing tenant header', async () => {
      const response = await request(app)
        .get('/api/events')
        .expect(400);

      expect(response.body.error).toBe('Missing X-Tenant-ID header');
    });

    test('should return 400 for invalid tenant', async () => {
      const response = await request(app)
        .get('/api/events')
        .set('X-Tenant-ID', 'invalid_tenant')
        .expect(400);

      expect(response.body.error).toBe('Invalid tenant ID');
    });

    test('should respect limit parameter', async () => {
      const response = await request(app)
        .get('/api/events?limit=1')
        .set('X-Tenant-ID', 'tenant_a')
        .expect(200);

      expect(response.body.data.events).toHaveLength(1);
      expect(response.body.data.count).toBe(1);
    });

    test('should return 400 for invalid limit values', async () => {
      // Limit too low
      await request(app)
        .get('/api/events?limit=0')
        .set('X-Tenant-ID', 'tenant_a')
        .expect(400);

      // Limit too high
      await request(app)
        .get('/api/events?limit=101')
        .set('X-Tenant-ID', 'tenant_a')
        .expect(400);

      // Invalid limit format
      await request(app)
        .get('/api/events?limit=invalid')
        .set('X-Tenant-ID', 'tenant_a')
        .expect(400);
    });

    test('should return empty array for tenant with no events', async () => {
      // Clear events for tenant_b
      tenantService.clearTenantEvents('tenant_b');
      
      const response = await request(app)
        .get('/api/events')
        .set('X-Tenant-ID', 'tenant_b')
        .expect(200);

      expect(response.body.data.events).toHaveLength(0);
      expect(response.body.data.count).toBe(0);
    });

    test('should return events in chronological order (newest first)', async () => {
      const response = await request(app)
        .get('/api/events')
        .set('X-Tenant-ID', 'tenant_a')
        .expect(200);

      const events = response.body.data.events;
      expect(events).toHaveLength(2);
      
      // Newer event should come first
      const timestamps = events.map(e => new Date(e.timestamp));
      expect(timestamps[0] >= timestamps[1]).toBe(true);
    });
  });

  describe('GET /api/events/stats', () => {
    beforeEach(async () => {
      // Create test events
      await request(app)
        .post('/api/events')
        .set('X-Tenant-ID', 'tenant_a')
        .send({ message: 'Message 1' });

      await request(app)
        .post('/api/events')
        .set('X-Tenant-ID', 'tenant_a')
        .send({ message: 'Message 2' });

      await request(app)
        .post('/api/events')
        .set('X-Tenant-ID', 'tenant_b')
        .send({ message: 'Message for B' });
    });

    test('should return event statistics', async () => {
      const response = await request(app)
        .get('/api/events/stats')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('totalEvents', 3);
      expect(response.body.data).toHaveProperty('tenantStats');
      expect(response.body.data.tenantStats).toHaveProperty('tenant_a', 2);
      expect(response.body.data.tenantStats).toHaveProperty('tenant_b', 1);
    });

    test('should not require tenant header for stats', async () => {
      await request(app)
        .get('/api/events/stats')
        .expect(200);
    });
  });

  describe('GET /api/health', () => {
    test('should return health status', async () => {
      const response = await request(app)
        .get('/api/health')
        .expect(200);

      expect(response.body).toHaveProperty('status', 'healthy');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('version');
      expect(response.body).toHaveProperty('uptime');
      expect(response.body).toHaveProperty('memory');
      expect(response.body).toHaveProperty('eventStats');
    });
  });

  describe('Rate limiting', () => {
    test('should not rate limit normal usage', async () => {
      // Make several requests within normal limits
      for (let i = 0; i < 5; i++) {
        await request(app)
          .post('/api/events')
          .set('X-Tenant-ID', 'tenant_a')
          .send({ message: `Message ${i}` })
          .expect(201);
      }
    });

    // Note: Full rate limiting test would require many requests
    // and might be better suited for load testing
  });

  describe('CORS and Security Headers', () => {
    test('should include security headers', async () => {
      const response = await request(app)
        .get('/api/health')
        .expect(200);

      // Check for helmet security headers
      expect(response.headers).toHaveProperty('x-content-type-options');
      expect(response.headers).toHaveProperty('x-frame-options');
    });
  });

  describe('Error handling', () => {
    test('should return 404 for non-existent routes', async () => {
      const response = await request(app)
        .get('/api/nonexistent')
        .expect(404);

      expect(response.body.error).toBe('Not Found');
      expect(response.body.code).toBe('NOT_FOUND');
    });

    test('should handle malformed JSON', async () => {
      const response = await request(app)
        .post('/api/events')
        .set('X-Tenant-ID', 'tenant_a')
        .set('Content-Type', 'application/json')
        .send('{ invalid json }')
        .expect(400);

      // Express should handle this automatically
    });

    test('should handle large request bodies', async () => {
      const largeData = { message: 'a'.repeat(2000000) }; // 2MB
      
      const response = await request(app)
        .post('/api/events')
        .set('X-Tenant-ID', 'tenant_a')
        .send(largeData)
        .expect(413); // Payload too large

      // This test verifies body size limits are enforced
    });
  });
});
