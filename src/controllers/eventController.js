/**
 * Event Controller
 * Handles HTTP requests for event management
 */

const { validationResult } = require('express-validator');
const eventService = require('../services/eventService');
const { AppError, formatValidationErrors } = require('../middleware/errorMiddleware');

/**
 * Create a new event
 * POST /api/events
 */
const createEvent = async (req, res, next) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const formattedErrors = formatValidationErrors(errors.array());
      return res.status(400).json({
        error: 'Validation failed',
        code: 'VALIDATION_ERROR',
        details: formattedErrors,
        timestamp: new Date().toISOString(),
      });
    }

    const { message } = req.body;
    const tenantId = req.tenantId; // Set by tenant middleware

    // Sanitize message content
    const sanitizedMessage = eventService.sanitizeMessage(message);

    // Create event
    const event = eventService.createEvent(tenantId, sanitizedMessage);

    // Log event creation for monitoring
    console.log(
      `[EVENT_CREATED] ${new Date().toISOString()} - Tenant: ${tenantId}, Event: ${event.id}`
    );

    res.status(201).json({
      success: true,
      data: event,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get events for a tenant
 * GET /api/events
 */
const getEvents = async (req, res, next) => {
  try {
    const tenantId = req.tenantId; // Set by tenant middleware
    const limitParam = req.query.limit;
    const limit = limitParam ? Number.parseInt(limitParam, 10) : 50;

    // Validate limit parameter
    if (limitParam && (Number.isNaN(limit) || limit < 1 || limit > 100)) {
      throw new AppError('Limit must be between 1 and 100', 400, 'INVALID_LIMIT');
    }

    const events = eventService.getEventsByTenant(tenantId, limit);

    res.status(200).json({
      success: true,
      data: {
        events,
        count: events.length,
        tenant: tenantId,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get event statistics
 * GET /api/events/stats
 */
const getEventStats = async (_req, res, next) => {
  try {
    const stats = eventService.getEventStats();

    res.status(200).json({
      success: true,
      data: stats,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Health check endpoint
 * GET /api/health
 */
const healthCheck = async (_req, res) => {
  const stats = eventService.getEventStats();

  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0',
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    eventStats: stats,
  });
};

module.exports = {
  createEvent,
  getEvents,
  getEventStats,
  healthCheck,
};
