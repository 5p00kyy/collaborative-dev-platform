const express = require('express');
const router = express.Router();

// Placeholder routes - will be implemented in Phase 3
router.get('/', (req, res) => {
  res.status(501).json({ message: 'List rules endpoint - Coming in Phase 3' });
});

router.post('/', (req, res) => {
  res.status(501).json({ message: 'Create rule endpoint - Coming in Phase 3' });
});

router.post('/validate', (req, res) => {
  res.status(501).json({ message: 'Validate code endpoint - Coming in Phase 3' });
});

module.exports = router;
