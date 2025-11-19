const express = require('express');
const router = express.Router();

// Import API route modules
const authRoutes = require('./api/auth');
const projectRoutes = require('./api/projects');
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
      notes: '/api/notes',
      tickets: '/api/tickets',
      rules: '/api/rules',
    },
    documentation: '/api/docs',
  });
});

// Mount route modules
router.use('/auth', authRoutes);
router.use('/projects', projectRoutes);
router.use('/notes', noteRoutes);
router.use('/tickets', ticketRoutes);
router.use('/rules', ruleRoutes);

module.exports = router;
