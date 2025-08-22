/**
 * Event Service
 * Manages event creation and validation with event emission
 */

const { v4: uuidv4 } = require('uuid');
const { EventEmitter } = require('node:events');
const config = require('../../config/config');
const tenantService = require('./tenantService');

class EventService extends EventEmitter {
  /**
   * Creates a new event
   * @param {string} tenantId - The tenant identifier
   * @param {string} message - The event message
   * @returns {Object} - The created event object
   */
  createEvent(tenantId, message) {
    // Validate tenant
    if (!tenantService.isValidTenant(tenantId)) {
      throw new Error(`Invalid tenant: ${tenantId}`);
    }

    // Validate message
    if (!message || typeof message !== 'string') {
      throw new Error('Message is required and must be a string');
    }

    if (message.length > config.maxEventMessageLength) {
      throw new Error(
        `Message exceeds maximum length of ${config.maxEventMessageLength} characters`
      );
    }

    // Create event object
    const event = {
      id: uuidv4(),
      tenant_id: tenantId,
      message: message.trim(),
      timestamp: new Date().toISOString(),
    };

    // Add to tenant's event store
    tenantService.addEvent(tenantId, event);

    // Emit event for WebSocket broadcasting
    this.emit('eventCreated', {
      tenantId,
      event,
    });

    return event;
  }

  /**
   * Retrieves events for a specific tenant
   * @param {string} tenantId - The tenant identifier
   * @param {number} limit - Maximum number of events to return
   * @returns {Array} - Array of events
   */
  getEventsByTenant(tenantId, limit = 50) {
    return tenantService.getEvents(tenantId, limit);
  }

  /**
   * Validates event data
   * @param {Object} eventData - The event data to validate
   * @returns {Object} - Validation result
   */
  validateEventData(eventData) {
    const errors = [];

    if (!eventData) {
      errors.push('Event data is required');
      return { isValid: false, errors };
    }

    if (!eventData.message || typeof eventData.message !== 'string') {
      errors.push('Message is required and must be a string');
    } else if (eventData.message.length > config.maxEventMessageLength) {
      errors.push(`Message exceeds maximum length of ${config.maxEventMessageLength} characters`);
    } else if (eventData.message.trim().length === 0) {
      errors.push('Message cannot be empty');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Sanitizes message content to prevent XSS
   * @param {string} message - The message to sanitize
   * @returns {string} - Sanitized message
   */
  sanitizeMessage(message) {
    if (typeof message !== 'string') {
      return '';
    }

    // Basic XSS prevention - escape HTML characters
    return message
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;')
      .replace(/\//g, '&#x2F;')
      .trim();
  }

  /**
   * Gets event statistics for monitoring
   * @returns {Object} - Event statistics
   */
  getEventStats() {
    const stats = {
      totalEvents: 0,
      tenantStats: {},
    };

    for (const tenantId of tenantService.getSupportedTenants()) {
      const count = tenantService.getEventCount(tenantId);
      stats.tenantStats[tenantId] = count;
      stats.totalEvents += count;
    }

    return stats;
  }
}

// Export singleton instance
module.exports = new EventService();
