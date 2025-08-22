/**
 * Tenant Middleware
 * Validates and extracts tenant information from requests
 */

const tenantService = require('../services/tenantService');

/**
 * Middleware to validate tenant ID from X-Tenant-ID header
 */
const validateTenant = (req, res, next) => {
  const tenantId = req.headers['x-tenant-id'];

  // Check if tenant header is present
  if (!tenantId) {
    return res.status(400).json({
      error: 'Missing X-Tenant-ID header',
      code: 'MISSING_TENANT_HEADER'
    });
  }

  // Validate tenant ID format and value
  if (!tenantService.isValidTenant(tenantId)) {
    return res.status(400).json({
      error: 'Invalid tenant ID',
      code: 'INVALID_TENANT_ID',
      supportedTenants: tenantService.getSupportedTenants()
    });
  }

  // Add tenant ID to request object for downstream use
  req.tenantId = tenantId;
  
  // Log tenant access for security monitoring
  console.log(`[TENANT_ACCESS] ${new Date().toISOString()} - Tenant: ${tenantId}, IP: ${req.ip}, Path: ${req.path}`);

  next();
};

/**
 * Middleware to validate tenant ID from query parameters (for WebSocket connections)
 */
const validateTenantQuery = (req, res, next) => {
  const tenantId = req.query.tenant;

  if (!tenantId) {
    return res.status(400).json({
      error: 'Missing tenant query parameter',
      code: 'MISSING_TENANT_QUERY'
    });
  }

  if (!tenantService.isValidTenant(tenantId)) {
    return res.status(400).json({
      error: 'Invalid tenant ID',
      code: 'INVALID_TENANT_ID',
      supportedTenants: tenantService.getSupportedTenants()
    });
  }

  req.tenantId = tenantId;
  next();
};

/**
 * Middleware to sanitize tenant ID input
 */
const sanitizeTenant = (req, res, next) => {
  const tenantId = req.headers['x-tenant-id'] || req.query.tenant;
  
  if (tenantId) {
    // Basic sanitization - remove any potentially dangerous characters
    const sanitized = tenantId.toString().toLowerCase().replace(/[^a-z0-9_-]/g, '');
    
    if (req.headers['x-tenant-id']) {
      req.headers['x-tenant-id'] = sanitized;
    }
    if (req.query.tenant) {
      req.query.tenant = sanitized;
    }
  }
  
  next();
};

/**
 * Socket.io middleware for tenant validation
 */
const validateSocketTenant = (socket, next) => {
  const tenantId = socket.handshake.query.tenant;

  if (!tenantId) {
    return next(new Error('Missing tenant query parameter'));
  }

  if (!tenantService.isValidTenant(tenantId)) {
    return next(new Error('Invalid tenant ID'));
  }

  // Add tenant ID to socket object
  socket.tenantId = tenantId;
  
  // Log WebSocket connection for security monitoring
  console.log(`[WEBSOCKET_CONNECT] ${new Date().toISOString()} - Tenant: ${tenantId}, Socket: ${socket.id}`);

  next();
};

module.exports = {
  validateTenant,
  validateTenantQuery,
  sanitizeTenant,
  validateSocketTenant
};
