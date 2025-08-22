/**
 * Event Routes
 * Defines API routes for event management
 */

const express = require('express');
const { body } = require('express-validator');
const eventController = require('../controllers/eventController');
const { validateTenant, sanitizeTenant } = require('../middleware/tenantMiddleware');
const { asyncHandler } = require('../middleware/errorMiddleware');
const config = require('../../config/config');

const router = express.Router();

// Validation rules for event creation
const createEventValidation = [
  body('message')
    .isString()
    .withMessage('Message must be a string')
    .isLength({ min: 1 })
    .withMessage('Message cannot be empty')
    .isLength({ max: config.maxEventMessageLength })
    .withMessage(`Message cannot exceed ${config.maxEventMessageLength} characters`)
    .trim()
];

// Routes
router.post('/events', 
  sanitizeTenant,
  validateTenant,
  createEventValidation,
  asyncHandler(eventController.createEvent)
);

router.get('/events',
  sanitizeTenant,
  validateTenant,
  asyncHandler(eventController.getEvents)
);

router.get('/events/stats',
  asyncHandler(eventController.getEventStats)
);

router.get('/health',
  asyncHandler(eventController.healthCheck)
);

module.exports = router;
