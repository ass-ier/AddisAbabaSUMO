const express = require('express');
const router = express.Router();
const settingsController = require('../controllers/settings.controller');
const { authenticateToken, requireRole } = require('../middleware/auth');

// GET /api/settings - Get settings (super_admin only)
router.get('/', 
  authenticateToken, 
  requireRole('super_admin'), 
  settingsController.getSettings.bind(settingsController)
);

// PUT /api/settings - Update settings (super_admin only)
router.put('/', 
  authenticateToken, 
  requireRole('super_admin'), 
  settingsController.updateSettings.bind(settingsController)
);

module.exports = router;
