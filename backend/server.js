require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const compression = require('compression');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const swaggerUi = require('swagger-ui-express');

// Import configurations
const { pool } = require('./src/config/database');
const { redisClient } = require('./src/config/redis');
const swaggerSpec = require('./src/config/swagger');

// Import middleware
const { generalLimiter } = require('./src/middleware/rateLimiter');
const { setCsrfToken, getCsrfToken } = require('./src/middleware/csrf');

// Import WebSocket
const { initializeWebSocket } = require('./src/config/websocket');

// Import routes
const apiRoutes = require('./src/routes');

const app = express();
const PORT = process.env.PORT || 3000;

// ============================================
// Middleware Configuration
// ============================================

// Security headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"],
      scriptSrc: ["'self'", "https://cdn.jsdelivr.net"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
}));

// CORS configuration
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:8080',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Compression
app.use(compression());

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// Logging
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined'));
}

// CSRF token setup (for cookie-based sessions)
app.use(setCsrfToken);

// ============================================
// Routes
// ============================================

// Health check endpoint
app.get('/health', async (req, res) => {
  try {
    // Check database connection
    await pool.query('SELECT 1');
    
    // Check Redis connection
    await redisClient.ping();
    
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      services: {
        database: 'connected',
        redis: 'connected'
      }
    });
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error.message
    });
  }
});

// API Documentation (Swagger)
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'Collaborative Dev Platform API Docs'
}));

// Swagger JSON endpoint
app.get('/api/docs.json', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.send(swaggerSpec);
});

// CSRF token endpoint
app.get('/api/csrf-token', getCsrfToken);

// API routes with rate limiting
app.use('/api', generalLimiter, apiRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found',
    path: req.path
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Error:', err);
  
  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal server error';
  
  res.status(statusCode).json({
    success: false,
    message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// ============================================
// Server Initialization
// ============================================

async function startServer() {
  try {
    // Test database connection
    await pool.query('SELECT NOW()');
    console.log('✓ Database connected');
    
    // Test Redis connection
    await redisClient.ping();
    console.log('✓ Redis connected');
    
    // Start HTTP server
    const server = app.listen(PORT, () => {
      console.log(`
╔════════════════════════════════════════════════╗
║   Collaborative Dev Platform - Backend API     ║
╠════════════════════════════════════════════════╣
║   Environment: ${process.env.NODE_ENV?.toUpperCase().padEnd(33)}║
║   Server:      http://localhost:${PORT.toString().padEnd(23)}║
║   Status:      Running ✓                       ║
╚════════════════════════════════════════════════╝
      `);
    });

    // Initialize WebSocket
    initializeWebSocket(server);
    
    return server;
    
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully...');
  await pool.end();
  await redisClient.quit();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down gracefully...');
  await pool.end();
  await redisClient.quit();
  process.exit(0);
});

// Start the server
let server;
if (require.main === module) {
  server = startServer();
}

module.exports = { app, server };
