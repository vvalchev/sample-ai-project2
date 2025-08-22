/**
 * Application Configuration
 * Environment-based configuration management
 */

const config = {
  development: {
    port: process.env.PORT || 3000,
    cors: {
      origin: process.env.CORS_ORIGIN || "http://localhost:3000",
      credentials: true
    },
    rateLimit: {
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100 // limit each IP to 100 requests per windowMs
    },
    maxEventMessageLength: 500,
    supportedTenants: ['tenant_a', 'tenant_b'],
    logLevel: 'debug'
  },
  
  production: {
    port: process.env.PORT || 3000,
    cors: {
      origin: process.env.CORS_ORIGIN,
      credentials: true
    },
    rateLimit: {
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 50 // more restrictive in production
    },
    maxEventMessageLength: 500,
    supportedTenants: ['tenant_a', 'tenant_b'],
    logLevel: 'info'
  },
  
  test: {
    port: process.env.PORT || 3001,
    cors: {
      origin: "http://localhost:3001",
      credentials: true
    },
    rateLimit: {
      windowMs: 15 * 60 * 1000,
      max: 1000 // relaxed for testing
    },
    maxEventMessageLength: 500,
    supportedTenants: ['tenant_a', 'tenant_b'],
    logLevel: 'error'
  }
};

const env = process.env.NODE_ENV || 'development';

module.exports = config[env];
