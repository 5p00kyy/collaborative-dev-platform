const express = require('express');
const router = express.Router();

// Import rate limiters
const { authLimiter, createLimiter } = require('../middleware/rateLimiter');

// Import API route modules
const authRoutes = require('./api/auth');
const projectRoutes = require('./api/projects');
const collaboratorRoutes = require('./api/collaborators');
const noteRoutes = require('./api/notes');
const ticketRoutes = require('./api/tickets');
const ruleRoutes = require('./api/rules');

// API version info
router.get('/', (req, res) => {
  res.json({
    name: 'Collaborative Dev Platform API',
    version: '0.1.0',
    status: 'active',
    endpoints: {
      auth: '/api/auth',
      projects: '/api/projects',
      collaborators: '/api/collaborators',
      notes: '/api/notes',
      tickets: '/api/tickets',
      rules: '/api/rules',
    },
    documentation: '/api/docs',
  });
});

// Mount route modules with specific rate limiters
router.use('/auth', authLimiter, authRoutes);
router.use('/projects', projectRoutes);
router.use('/collaborators', collaboratorRoutes);
router.use('/notes', noteRoutes);
router.use('/tickets', ticketRoutes);
router.use('/rules', ruleRoutes);

module.exports = router;
