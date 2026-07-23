const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { get, query, run } = require('../db');
const { authenticate, requirePermission, logAudit } = require('../middleware/auth');

// GET /api/v1/users
router.get('/', authenticate, requirePermission('manage_users'), async (req, res) => {
  try {
    const users = await query(`
      SELECT u.id, u.full_name, u.email, u.phone, u.status, u.preferred_lang, u.last_login_at, u.created_at,
             r.id as role_id, r.name as role_name, r.slug as role_slug
      FROM users u
      JOIN roles r ON u.role_id = r.id
      ORDER BY u.id ASC
    `);

    res.json({ success: true, data: users });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to fetch users' });
  }
});

// POST /api/v1/users
router.post('/', authenticate, requirePermission('manage_users'), async (req, res) => {
  try {
    const { full_name, email, password, phone, role_id, status, preferred_lang } = req.body;
    if (!full_name || !email || !password || !role_id) {
      return res.status(400).json({ success: false, error: 'Full name, email, password, and role are required' });
    }

    const existing = await get('SELECT id FROM users WHERE email = ?', [email.trim().toLowerCase()]);
    if (existing) {
      return res.status(400).json({ success: false, error: 'User with this email already exists' });
    }

    const passwordHash = bcrypt.hashSync(password, 10);
    const result = await run(`
      INSERT INTO users (full_name, email, password_hash, phone, role_id, status, preferred_lang)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [full_name, email.trim().toLowerCase(), passwordHash, phone || '', role_id, status || 'active', preferred_lang || 'ar']);

    await logAudit(req, 'CREATE_USER', `Created staff user '${email}'`);
    res.json({ success: true, message: 'User created successfully', id: result.id });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to create user' });
  }
});

// PUT /api/v1/users/:id
router.put('/:id', authenticate, requirePermission('manage_users'), async (req, res) => {
  try {
    const user = await get('SELECT * FROM users WHERE id = ?', [req.params.id]);
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    const { full_name, email, phone, role_id, status, preferred_lang, password } = req.body;

    let newHash = user.password_hash;
    if (password && password.length >= 6) {
      newHash = bcrypt.hashSync(password, 10);
    }

    await run(`
      UPDATE users SET
        full_name = ?, email = ?, password_hash = ?, phone = ?, role_id = ?, status = ?, preferred_lang = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [
      full_name || user.full_name,
      email ? email.trim().toLowerCase() : user.email,
      newHash,
      phone !== undefined ? phone : user.phone,
      role_id || user.role_id,
      status || user.status,
      preferred_lang || user.preferred_lang,
      user.id
    ]);

    await logAudit(req, 'UPDATE_USER', `Updated user details for ${user.email}`);
    res.json({ success: true, message: 'User updated successfully' });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to update user' });
  }
});

// PATCH /api/v1/users/:id/status
router.patch('/:id/status', authenticate, requirePermission('manage_users'), async (req, res) => {
  try {
    const { status } = req.body;
    if (!['active', 'inactive'].includes(status)) {
      return res.status(400).json({ success: false, error: 'Invalid status' });
    }

    await run('UPDATE users SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [status, req.params.id]);
    await logAudit(req, 'TOGGLE_USER_STATUS', `Set user ID ${req.params.id} status to '${status}'`);
    res.json({ success: true, message: `User status changed to ${status}` });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to update status' });
  }
});

module.exports = router;
