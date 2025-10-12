const express = require('express');
const router = express.Router();
const emergencyController = require('../controllers/emergency.controller');
const { authenticateToken, requireRole } = require('../middleware/auth');

// GET /api/emergencies - Get active emergencies (any authenticated user)
router.get('/', 
  authenticateToken, 
  emergencyController.getActiveEmergencies.bind(emergencyController)
);

// POST /api/emergencies - Create new emergency (super_admin only)
router.post('/', 
  authenticateToken, 
  requireRole('super_admin'), 
  emergencyController.createEmergency.bind(emergencyController)
);

// POST /api/emergencies/:id/force-clear - Force clear emergency (super_admin only)
router.post('/:id/force-clear', 
  authenticateToken, 
  requireRole('super_admin'), 
  emergencyController.forceClearEmergency.bind(emergencyController)
);

module.exports = router;
