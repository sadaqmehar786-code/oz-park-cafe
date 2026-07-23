const express = require('express');
const router = express.Router();
const { query } = require('../db');
const { authenticate, requirePermission } = require('../middleware/auth');

// GET /api/v1/activity
router.get('/', authenticate, requirePermission('view_dashboard'), async (req, res) => {
  try {
    const logs = await query('SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 100');
    res.json({ success: true, data: logs });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to fetch audit log' });
  }
});

module.exports = router;
