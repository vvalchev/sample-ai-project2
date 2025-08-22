/**
 * Tenant Service
 * Manages tenant isolation and validation
 */

const config = require('../../config/config');

class TenantService {
  constructor() {
    // In-memory storage for tenant events - Map for better performance
    this.tenantEvents = new Map();
    
    // Initialize supported tenants
    config.supportedTenants.forEach(tenantId => {
      this.tenantEvents.set(tenantId, []);
    });
  }

  /**
   * Validates if tenant ID is supported
   * @param {string} tenantId - The tenant identifier
   * @returns {boolean} - True if tenant is valid
   */
  isValidTenant(tenantId) {
    if (!tenantId || typeof tenantId !== 'string') {
      return false;
    }
    return config.supportedTenants.includes(tenantId);
  }

  /**
   * Adds an event to a tenant's event store
   * @param {string} tenantId - The tenant identifier
   * @param {Object} event - The event object
   * @returns {boolean} - True if event was added successfully
   */
  addEvent(tenantId, event) {
    if (!this.isValidTenant(tenantId)) {
      throw new Error(`Invalid tenant: ${tenantId}`);
    }

    const tenantEvents = this.tenantEvents.get(tenantId);
    tenantEvents.unshift(event); // Add to beginning for chronological order (newest first)
    
    // Optional: Implement memory management (limit number of events per tenant)
    const MAX_EVENTS_PER_TENANT = 1000;
    if (tenantEvents.length > MAX_EVENTS_PER_TENANT) {
      tenantEvents.splice(MAX_EVENTS_PER_TENANT);
    }

    return true;
  }

  /**
   * Retrieves events for a specific tenant
   * @param {string} tenantId - The tenant identifier
   * @param {number} limit - Maximum number of events to return (optional)
   * @returns {Array} - Array of events for the tenant
   */
  getEvents(tenantId, limit = null) {
    if (!this.isValidTenant(tenantId)) {
      throw new Error(`Invalid tenant: ${tenantId}`);
    }

    const events = this.tenantEvents.get(tenantId);
    return limit ? events.slice(0, limit) : [...events];
  }

  /**
   * Gets the count of events for a tenant
   * @param {string} tenantId - The tenant identifier
   * @returns {number} - Number of events for the tenant
   */
  getEventCount(tenantId) {
    if (!this.isValidTenant(tenantId)) {
      return 0;
    }
    return this.tenantEvents.get(tenantId).length;
  }

  /**
   * Gets all supported tenant IDs
   * @returns {Array} - Array of supported tenant IDs
   */
  getSupportedTenants() {
    return [...config.supportedTenants];
  }

  /**
   * Clears all events for a tenant (useful for testing)
   * @param {string} tenantId - The tenant identifier
   */
  clearTenantEvents(tenantId) {
    if (!this.isValidTenant(tenantId)) {
      throw new Error(`Invalid tenant: ${tenantId}`);
    }
    this.tenantEvents.set(tenantId, []);
  }

  /**
   * Gets memory usage statistics
   * @returns {Object} - Memory usage statistics
   */
  getMemoryStats() {
    const stats = {};
    for (const [tenantId, events] of this.tenantEvents) {
      stats[tenantId] = {
        eventCount: events.length,
        memoryEstimate: JSON.stringify(events).length // Rough estimate
      };
    }
    return stats;
  }
}

// Export singleton instance
module.exports = new TenantService();
