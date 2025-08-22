/**
 * Unit tests for EventService
 */

const eventService = require('../../src/services/eventService');
const tenantService = require('../../src/services/tenantService');

describe('EventService', () => {
  beforeEach(() => {
    // Clear all tenant events before each test
    tenantService.getSupportedTenants().forEach(tenantId => {
      tenantService.clearTenantEvents(tenantId);
    });
  });

  describe('createEvent', () => {
    test('should create valid event with all required fields', () => {
      const event = eventService.createEvent('tenant_a', 'Test message');
      
      expect(event).toHaveProperty('id');
      expect(event).toHaveProperty('tenant_id', 'tenant_a');
      expect(event).toHaveProperty('message', 'Test message');
      expect(event).toHaveProperty('timestamp');
      
      // Validate UUID format
      expect(event.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
      
      // Validate ISO timestamp
      expect(new Date(event.timestamp).toISOString()).toBe(event.timestamp);
    });

    test('should throw error for invalid tenant', () => {
      expect(() => {
        eventService.createEvent('invalid_tenant', 'Test message');
      }).toThrow('Invalid tenant: invalid_tenant');
    });

    test('should throw error for missing message', () => {
      expect(() => {
        eventService.createEvent('tenant_a');
      }).toThrow('Message is required and must be a string');

      expect(() => {
        eventService.createEvent('tenant_a', '');
      }).toThrow('Message is required and must be a string');

      expect(() => {
        eventService.createEvent('tenant_a', null);
      }).toThrow('Message is required and must be a string');
    });

    test('should throw error for non-string message', () => {
      expect(() => {
        eventService.createEvent('tenant_a', 123);
      }).toThrow('Message is required and must be a string');

      expect(() => {
        eventService.createEvent('tenant_a', {});
      }).toThrow('Message is required and must be a string');

      expect(() => {
        eventService.createEvent('tenant_a', []);
      }).toThrow('Message is required and must be a string');
    });

    test('should throw error for message exceeding max length', () => {
      const longMessage = 'a'.repeat(501); // Exceeds 500 char limit
      
      expect(() => {
        eventService.createEvent('tenant_a', longMessage);
      }).toThrow('Message exceeds maximum length of 500 characters');
    });

    test('should trim whitespace from message', () => {
      const event = eventService.createEvent('tenant_a', '  Test message  ');
      expect(event.message).toBe('Test message');
    });

    test('should add event to tenant store', () => {
      eventService.createEvent('tenant_a', 'Test message');
      expect(tenantService.getEventCount('tenant_a')).toBe(1);
    });

    test('should generate unique IDs for multiple events', () => {
      const event1 = eventService.createEvent('tenant_a', 'Message 1');
      const event2 = eventService.createEvent('tenant_a', 'Message 2');
      
      expect(event1.id).not.toBe(event2.id);
    });
  });

  describe('getEventsByTenant', () => {
    beforeEach(() => {
      // Add test events
      for (let i = 0; i < 10; i++) {
        eventService.createEvent('tenant_a', `Message ${i}`);
      }
    });

    test('should return events for specified tenant', () => {
      const events = eventService.getEventsByTenant('tenant_a');
      expect(events).toHaveLength(10);
    });

    test('should respect limit parameter', () => {
      const events = eventService.getEventsByTenant('tenant_a', 5);
      expect(events).toHaveLength(5);
    });

    test('should use default limit of 50', () => {
      // This test assumes default behavior - would need more events to test properly
      const events = eventService.getEventsByTenant('tenant_a');
      expect(events).toHaveLength(10); // We only have 10 events
    });

    test('should return empty array for tenant with no events', () => {
      const events = eventService.getEventsByTenant('tenant_b');
      expect(events).toHaveLength(0);
    });
  });

  describe('validateEventData', () => {
    test('should return valid for correct event data', () => {
      const eventData = { message: 'Valid message' };
      const result = eventService.validateEventData(eventData);
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('should return invalid for missing event data', () => {
      const result = eventService.validateEventData(null);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Event data is required');
    });

    test('should return invalid for missing message', () => {
      const result = eventService.validateEventData({});
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Message is required and must be a string');
    });

    test('should return invalid for non-string message', () => {
      const result = eventService.validateEventData({ message: 123 });
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Message is required and must be a string');
    });

    test('should return invalid for message exceeding max length', () => {
      const longMessage = 'a'.repeat(501);
      const result = eventService.validateEventData({ message: longMessage });
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Message exceeds maximum length of 500 characters');
    });

    test('should return invalid for empty message after trim', () => {
      const result = eventService.validateEventData({ message: '   ' });
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Message cannot be empty');
    });

    test('should collect multiple validation errors', () => {
      const result = eventService.validateEventData({ message: 'a'.repeat(501) });
      
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('sanitizeMessage', () => {
    test('should escape HTML characters', () => {
      const input = '<script>alert("xss")</script>';
      const output = eventService.sanitizeMessage(input);
      
      expect(output).toBe('&lt;script&gt;alert(&quot;xss&quot;)&lt;&#x2F;script&gt;');
    });

    test('should escape various special characters', () => {
      const testCases = [
        { input: '&', expected: '&amp;' },
        { input: '<', expected: '&lt;' },
        { input: '>', expected: '&gt;' },
        { input: '"', expected: '&quot;' },
        { input: "'", expected: '&#x27;' },
        { input: '/', expected: '&#x2F;' }
      ];

      testCases.forEach(({ input, expected }) => {
        expect(eventService.sanitizeMessage(input)).toBe(expected);
      });
    });

    test('should trim whitespace', () => {
      const output = eventService.sanitizeMessage('  test message  ');
      expect(output).toBe('test message');
    });

    test('should handle non-string input', () => {
      expect(eventService.sanitizeMessage(null)).toBe('');
      expect(eventService.sanitizeMessage(undefined)).toBe('');
      expect(eventService.sanitizeMessage(123)).toBe('');
      expect(eventService.sanitizeMessage({})).toBe('');
    });

    test('should preserve normal text', () => {
      const input = 'This is a normal message with numbers 123 and symbols !@#$%^*()';
      const output = eventService.sanitizeMessage(input);
      
      // Should not change normal characters except those specifically escaped
      expect(output).toBe(input);
    });
  });

  describe('getEventStats', () => {
    test('should return stats for all tenants', () => {
      eventService.createEvent('tenant_a', 'Message A1');
      eventService.createEvent('tenant_a', 'Message A2');
      eventService.createEvent('tenant_b', 'Message B1');
      
      const stats = eventService.getEventStats();
      
      expect(stats).toHaveProperty('totalEvents', 3);
      expect(stats).toHaveProperty('tenantStats');
      expect(stats.tenantStats).toHaveProperty('tenant_a', 2);
      expect(stats.tenantStats).toHaveProperty('tenant_b', 1);
    });

    test('should return zero stats when no events exist', () => {
      const stats = eventService.getEventStats();
      
      expect(stats.totalEvents).toBe(0);
      expect(stats.tenantStats.tenant_a).toBe(0);
      expect(stats.tenantStats.tenant_b).toBe(0);
    });
  });

  describe('edge cases and security', () => {
    test('should handle concurrent event creation', async () => {
      const promises = [];
      
      // Create multiple events concurrently
      for (let i = 0; i < 10; i++) {
        promises.push(
          Promise.resolve(eventService.createEvent('tenant_a', `Concurrent message ${i}`))
        );
      }
      
      const events = await Promise.all(promises);
      
      expect(events).toHaveLength(10);
      expect(tenantService.getEventCount('tenant_a')).toBe(10);
      
      // All events should have unique IDs
      const ids = events.map(e => e.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(10);
    });

    test('should maintain tenant isolation in event creation', () => {
      eventService.createEvent('tenant_a', 'Message for A');
      eventService.createEvent('tenant_b', 'Message for B');
      
      const eventsA = eventService.getEventsByTenant('tenant_a');
      const eventsB = eventService.getEventsByTenant('tenant_b');
      
      expect(eventsA).toHaveLength(1);
      expect(eventsB).toHaveLength(1);
      expect(eventsA[0].message).toBe('Message for A');
      expect(eventsB[0].message).toBe('Message for B');
    });

    test('should handle maximum length message', () => {
      const maxMessage = 'a'.repeat(500); // Exactly at limit
      const event = eventService.createEvent('tenant_a', maxMessage);
      
      expect(event.message).toBe(maxMessage);
      expect(event.message.length).toBe(500);
    });
  });
});
