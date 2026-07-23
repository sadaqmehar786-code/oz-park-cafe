const express = require('express');
const router = express.Router();
const { query } = require('../db');
const { authenticate, requirePermission } = require('../middleware/auth');

// GET /api/v1/roles
router.get('/', authenticate, requirePermission('manage_users'), async (req, res) => {
  try {
    const roles = await query('SELECT * FROM roles ORDER BY id ASC');
    const parsed = roles.map(r => ({
      ...r,
      permissions: JSON.parse(r.permissions || '[]')
    }));
    res.json({ success: true, data: parsed });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to fetch roles' });
  }
});

module.exports = router;
