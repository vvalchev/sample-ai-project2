/**
 * Main Application File
 * Express.js server with Socket.io integration for real-time event broadcasting
 */

const express = require('express');
const http = require('node:http');
const path = require('node:path');
const helmet = require('helmet');
const cors = require('cors');
const compression = require('compression');
const rateLimit = require('express-rate-limit');

// Application modules
const config = require('../config/config');
const eventRoutes = require('./routes/eventRoutes');
const socketService = require('./services/socketService');
const eventService = require('./services/eventService');
const { errorHandler, notFoundHandler } = require('./middleware/errorMiddleware');

// Create Express application
const app = express();
const server = http.createServer(app);

// Security middleware
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        connectSrc: ["'self'", 'ws:', 'wss:'],
        imgSrc: ["'self'", 'data:', 'https:'],
      },
    },
  })
);

// CORS configuration
app.use(cors(config.cors));

// Rate limiting
const limiter = rateLimit(config.rateLimit);
app.use('/api/', limiter);

// Body parsing middleware
app.use(compression());
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Trust proxy for accurate IP addresses
app.set('trust proxy', 1);

// Static file serving
app.use(express.static(path.join(__dirname, '../public')));

// Request logging middleware
app.use((req, _res, next) => {
  console.log(`[HTTP] ${new Date().toISOString()} - ${req.method} ${req.path} - IP: ${req.ip}`);
  next();
});

// API routes
app.use('/api', eventRoutes);

// Serve main HTML page
app.get('/', (_req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// 404 handler
app.use(notFoundHandler);

// Global error handler
app.use(errorHandler);

// Initialize Socket.io
socketService.initialize(server, config.cors);

// Subscribe SocketService to EventService for automatic broadcasting
socketService.subscribeToEventService(eventService);

// Graceful shutdown handling
process.on('SIGTERM', () => {
  console.log('[APP] SIGTERM received, shutting down gracefully');

  socketService.disconnectAll();

  server.close(() => {
    console.log('[APP] Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('[APP] SIGINT received, shutting down gracefully');

  socketService.disconnectAll();

  server.close(() => {
    console.log('[APP] Server closed');
    process.exit(0);
  });
});

// Unhandled promise rejection handler
process.on('unhandledRejection', (reason, promise) => {
  console.error('[APP] Unhandled Rejection at:', promise, 'reason:', reason);
  // Don't exit in production, just log
  if (process.env.NODE_ENV !== 'production') {
    process.exit(1);
  }
});

// Start server only if not in test environment or when explicitly required
if (process.env.NODE_ENV !== 'test' || require.main === module) {
  const PORT = config.port;
  server.listen(PORT, () => {
    console.log(`[APP] Server running on port ${PORT}`);
    console.log(`[APP] Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`[APP] Supported tenants: ${config.supportedTenants.join(', ')}`);
  });
}

// Export for testing
module.exports = { app, server };
