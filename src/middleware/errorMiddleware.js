/**
 * Error Handling Middleware
 * Centralized error handling for the application
 */

const config = require('../../config/config');

/**
 * Global error handler middleware
 */
const errorHandler = (err, req, res, _next) => {
  // Log error for debugging
  console.error(`[ERROR] ${new Date().toISOString()} - ${err.message}`);
  console.error(err.stack);

  // Default error response
  let statusCode = 500;
  let message = 'Internal Server Error';
  let code = 'INTERNAL_ERROR';

  // Handle specific error types
  if (err.name === 'ValidationError') {
    statusCode = 400;
    message = 'Validation Error';
    code = 'VALIDATION_ERROR';
  } else if (err.message.includes('Invalid tenant')) {
    statusCode = 400;
    message = 'Invalid tenant ID';
    code = 'INVALID_TENANT';
  } else if (err.message.includes('Message exceeds maximum length')) {
    statusCode = 400;
    message = 'Message too long';
    code = 'MESSAGE_TOO_LONG';
  } else if (err.message.includes('Message is required')) {
    statusCode = 400;
    message = 'Message is required';
    code = 'MISSING_MESSAGE';
  } else if (err.statusCode) {
    statusCode = err.statusCode;
    message = err.message;
  }

  // Prepare error response
  const errorResponse = {
    error: message,
    code: code,
    timestamp: new Date().toISOString()
  };

  // Include stack trace in development mode only
  if (config.logLevel === 'debug' && process.env.NODE_ENV !== 'production') {
    errorResponse.stack = err.stack;
  }

  // Include additional error details if available
  if (err.details) {
    errorResponse.details = err.details;
  }

  res.status(statusCode).json(errorResponse);
};

/**
 * 404 Not Found handler
 */
const notFoundHandler = (req, res) => {
  const errorResponse = {
    error: 'Not Found',
    code: 'NOT_FOUND',
    message: `Route ${req.method} ${req.path} not found`,
    timestamp: new Date().toISOString()
  };

  res.status(404).json(errorResponse);
};

/**
 * Async error wrapper for route handlers
 */
const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

/**
 * Validation error formatter
 */
const formatValidationErrors = (errors) => {
  return errors.map(error => ({
    field: error.path || error.param,
    message: error.msg || error.message,
    value: error.value
  }));
};

/**
 * Custom error class for application-specific errors
 */
class AppError extends Error {
  constructor(message, statusCode = 500, code = 'APP_ERROR') {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

module.exports = {
  errorHandler,
  notFoundHandler,
  asyncHandler,
  formatValidationErrors,
  AppError
};
