/**
 * Unit tests for TenantService
 */

const tenantService = require('../../src/services/tenantService');

describe('TenantService', () => {
  beforeEach(() => {
    // Clear all tenant events before each test
    tenantService.getSupportedTenants().forEach(tenantId => {
      tenantService.clearTenantEvents(tenantId);
    });
  });

  describe('isValidTenant', () => {
    test('should return true for valid tenant IDs', () => {
      expect(tenantService.isValidTenant('tenant_a')).toBe(true);
      expect(tenantService.isValidTenant('tenant_b')).toBe(true);
    });

    test('should return false for invalid tenant IDs', () => {
      expect(tenantService.isValidTenant('invalid_tenant')).toBe(false);
      expect(tenantService.isValidTenant('tenant_c')).toBe(false);
      expect(tenantService.isValidTenant('')).toBe(false);
      expect(tenantService.isValidTenant(null)).toBe(false);
      expect(tenantService.isValidTenant(undefined)).toBe(false);
      expect(tenantService.isValidTenant(123)).toBe(false);
    });
  });

  describe('addEvent', () => {
    test('should add event to valid tenant', () => {
      const event = global.testUtils.createTestEvent('tenant_a');
      const result = tenantService.addEvent('tenant_a', event);
      
      expect(result).toBe(true);
      expect(tenantService.getEventCount('tenant_a')).toBe(1);
    });

    test('should throw error for invalid tenant', () => {
      const event = global.testUtils.createTestEvent('invalid_tenant');
      
      expect(() => {
        tenantService.addEvent('invalid_tenant', event);
      }).toThrow('Invalid tenant: invalid_tenant');
    });

    test('should maintain chronological order (newest first)', () => {
      const event1 = { ...global.testUtils.createTestEvent('tenant_a'), id: '1', timestamp: '2023-01-01T10:00:00Z' };
      const event2 = { ...global.testUtils.createTestEvent('tenant_a'), id: '2', timestamp: '2023-01-01T11:00:00Z' };
      
      tenantService.addEvent('tenant_a', event1);
      tenantService.addEvent('tenant_a', event2);
      
      const events = tenantService.getEvents('tenant_a');
      expect(events[0].id).toBe('2'); // Newer event first
      expect(events[1].id).toBe('1');
    });

    test('should limit events per tenant to prevent memory issues', () => {
      // Add more than the limit (assuming 1000 is the limit)
      for (let i = 0; i < 1001; i++) {
        const event = { ...global.testUtils.createTestEvent('tenant_a'), id: `event_${i}` };
        tenantService.addEvent('tenant_a', event);
      }
      
      expect(tenantService.getEventCount('tenant_a')).toBeLessThanOrEqual(1000);
    });
  });

  describe('getEvents', () => {
    beforeEach(() => {
      // Add test events
      for (let i = 0; i < 5; i++) {
        const event = { ...global.testUtils.createTestEvent('tenant_a'), id: `event_${i}` };
        tenantService.addEvent('tenant_a', event);
      }
    });

    test('should return all events for valid tenant', () => {
      const events = tenantService.getEvents('tenant_a');
      expect(events).toHaveLength(5);
    });

    test('should return limited events when limit specified', () => {
      const events = tenantService.getEvents('tenant_a', 3);
      expect(events).toHaveLength(3);
    });

    test('should throw error for invalid tenant', () => {
      expect(() => {
        tenantService.getEvents('invalid_tenant');
      }).toThrow('Invalid tenant: invalid_tenant');
    });

    test('should return copy of events (not reference)', () => {
      const events = tenantService.getEvents('tenant_a');
      events.push({ id: 'new_event' });
      
      const eventsAgain = tenantService.getEvents('tenant_a');
      expect(eventsAgain).toHaveLength(5); // Original length unchanged
    });
  });

  describe('getEventCount', () => {
    test('should return correct count for valid tenant', () => {
      expect(tenantService.getEventCount('tenant_a')).toBe(0);
      
      tenantService.addEvent('tenant_a', global.testUtils.createTestEvent('tenant_a'));
      expect(tenantService.getEventCount('tenant_a')).toBe(1);
    });

    test('should return 0 for invalid tenant', () => {
      expect(tenantService.getEventCount('invalid_tenant')).toBe(0);
    });
  });

  describe('getSupportedTenants', () => {
    test('should return array of supported tenant IDs', () => {
      const tenants = tenantService.getSupportedTenants();
      expect(Array.isArray(tenants)).toBe(true);
      expect(tenants).toContain('tenant_a');
      expect(tenants).toContain('tenant_b');
    });

    test('should return copy of supported tenants (not reference)', () => {
      const tenants = tenantService.getSupportedTenants();
      tenants.push('new_tenant');
      
      const tenantsAgain = tenantService.getSupportedTenants();
      expect(tenantsAgain).not.toContain('new_tenant');
    });
  });

  describe('clearTenantEvents', () => {
    test('should clear events for valid tenant', () => {
      tenantService.addEvent('tenant_a', global.testUtils.createTestEvent('tenant_a'));
      expect(tenantService.getEventCount('tenant_a')).toBe(1);
      
      tenantService.clearTenantEvents('tenant_a');
      expect(tenantService.getEventCount('tenant_a')).toBe(0);
    });

    test('should throw error for invalid tenant', () => {
      expect(() => {
        tenantService.clearTenantEvents('invalid_tenant');
      }).toThrow('Invalid tenant: invalid_tenant');
    });
  });

  describe('getMemoryStats', () => {
    test('should return memory statistics for all tenants', () => {
      tenantService.addEvent('tenant_a', global.testUtils.createTestEvent('tenant_a'));
      tenantService.addEvent('tenant_b', global.testUtils.createTestEvent('tenant_b'));
      
      const stats = tenantService.getMemoryStats();
      
      expect(stats).toHaveProperty('tenant_a');
      expect(stats).toHaveProperty('tenant_b');
      expect(stats.tenant_a).toHaveProperty('eventCount', 1);
      expect(stats.tenant_b).toHaveProperty('eventCount', 1);
      expect(stats.tenant_a).toHaveProperty('memoryEstimate');
    });
  });

  describe('tenant isolation', () => {
    test('should maintain strict isolation between tenants', () => {
      const eventA = { ...global.testUtils.createTestEvent('tenant_a'), message: 'Event for A' };
      const eventB = { ...global.testUtils.createTestEvent('tenant_b'), message: 'Event for B' };
      
      tenantService.addEvent('tenant_a', eventA);
      tenantService.addEvent('tenant_b', eventB);
      
      const eventsA = tenantService.getEvents('tenant_a');
      const eventsB = tenantService.getEvents('tenant_b');
      
      expect(eventsA).toHaveLength(1);
      expect(eventsB).toHaveLength(1);
      expect(eventsA[0].message).toBe('Event for A');
      expect(eventsB[0].message).toBe('Event for B');
      
      // Ensure no cross-contamination
      expect(eventsA.some(e => e.message === 'Event for B')).toBe(false);
      expect(eventsB.some(e => e.message === 'Event for A')).toBe(false);
    });
  });
});
