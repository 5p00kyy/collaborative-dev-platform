const express = require('express');
const router = express.Router();

// Placeholder routes - will be implemented in Phase 1
router.get('/', (req, res) => {
  res.status(501).json({ message: 'List projects endpoint - Coming soon' });
});

router.post('/', (req, res) => {
  res.status(501).json({ message: 'Create project endpoint - Coming soon' });
});

router.get('/:id', (req, res) => {
  res.status(501).json({ message: 'Get project endpoint - Coming soon' });
});

router.put('/:id', (req, res) => {
  res.status(501).json({ message: 'Update project endpoint - Coming soon' });
});

router.delete('/:id', (req, res) => {
  res.status(501).json({ message: 'Delete project endpoint - Coming soon' });
});

module.exports = router;
