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
             r.id as role_id, r.name as role_name, r.slug as role_slug, r.permissions
      FROM users u
      JOIN roles r ON u.role_id = r.id
      WHERE u.status != 'deleted'
      ORDER BY u.id ASC
    `);

    res.json({ success: true, data: users });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to fetch users' });
  }
});

// GET /api/v1/users/:id
router.get('/:id', authenticate, requirePermission('manage_users'), async (req, res) => {
  try {
    const user = await get(`
      SELECT u.id, u.full_name, u.email, u.phone, u.status, u.preferred_lang, u.last_login_at, u.created_at,
             r.id as role_id, r.name as role_name, r.slug as role_slug, r.permissions
      FROM users u
      JOIN roles r ON u.role_id = r.id
      WHERE u.id = ? AND u.status != 'deleted'
    `, [req.params.id]);

    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    res.json({ success: true, data: user });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to fetch user details' });
  }
});

// POST /api/v1/users
router.post('/', authenticate, requirePermission('manage_users'), async (req, res) => {
  try {
    const { full_name, email, password, phone, role_id, status, preferred_lang } = req.body;
    if (!full_name || !email || !password || !role_id) {
      return res.status(400).json({ success: false, error: 'Full name, email, password, and role are required' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const existing = await get('SELECT id, status FROM users WHERE email = ?', [cleanEmail]);
    if (existing && existing.status !== 'deleted') {
      return res.status(400).json({ success: false, error: 'User with this email already exists' });
    }

    const passwordHash = bcrypt.hashSync(password, 10);
    let result;

    if (existing && existing.status === 'deleted') {
      // Reactivate previously deleted account slot
      await run(`
        UPDATE users SET
          full_name = ?, password_hash = ?, phone = ?, role_id = ?, status = ?, preferred_lang = ?,
          deleted_at = NULL, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `, [full_name.trim(), passwordHash, phone || '', role_id, status || 'active', preferred_lang || 'ar', existing.id]);
      result = { id: existing.id };
    } else {
      result = await run(`
        INSERT INTO users (full_name, email, password_hash, phone, role_id, status, preferred_lang)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `, [full_name.trim(), cleanEmail, passwordHash, phone || '', role_id, status || 'active', preferred_lang || 'ar']);
    }

    await logAudit(req, 'CREATE_USER', `Created staff user '${cleanEmail}'`);
    res.json({ success: true, message: 'User created successfully', id: result.id });
  } catch (err) {
    console.error('Create user error:', err);
    res.status(500).json({ success: false, error: 'Failed to create user' });
  }
});

// PUT /api/v1/users/:id
router.put('/:id', authenticate, requirePermission('manage_users'), async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    const user = await get('SELECT * FROM users WHERE id = ? AND status != "deleted"', [userId]);
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    const { full_name, email, phone, role_id, status, preferred_lang, password } = req.body;
    let newHash = user.password_hash;
    if (password && password.length >= 6) {
      newHash = bcrypt.hashSync(password, 10);
    }

    const roleChanged = role_id && parseInt(role_id) !== user.role_id;

    await run(`
      UPDATE users SET
        full_name = ?, email = ?, password_hash = ?, phone = ?, role_id = ?, status = ?, preferred_lang = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [
      full_name ? full_name.trim() : user.full_name,
      email ? email.trim().toLowerCase() : user.email,
      newHash,
      phone !== undefined ? phone : user.phone,
      role_id || user.role_id,
      status || user.status,
      preferred_lang || user.preferred_lang,
      user.id
    ]);

    if (roleChanged) {
      await logAudit(req, 'permissions_changed', `Updated role and permissions for user ${user.email}`);
    } else {
      await logAudit(req, 'UPDATE_USER', `Updated user details for ${user.email}`);
    }

    res.json({ success: true, message: 'User updated successfully' });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to update user' });
  }
});

// PATCH /api/v1/users/:id/status
router.patch('/:id/status', authenticate, requirePermission('manage_users'), async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    const { status } = req.body;
    if (!['active', 'inactive'].includes(status)) {
      return res.status(400).json({ success: false, error: 'Invalid status' });
    }

    if (userId === req.user.id && status === 'inactive') {
      return res.status(400).json({ success: false, error: 'You cannot deactivate your own account' });
    }

    const user = await get('SELECT email FROM users WHERE id = ?', [userId]);
    await run('UPDATE users SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [status, userId]);

    await logAudit(req, 'user_deactivated', `Changed status of user '${user ? user.email : userId}' to '${status}'`);
    res.json({ success: true, message: `User status changed to ${status}` });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to update status' });
  }
});

// DELETE /api/v1/users/:id (Soft-delete & session revocation)
router.delete('/:id', authenticate, requirePermission('manage_users'), async (req, res) => {
  try {
    const targetUserId = parseInt(req.params.id);

    // 1. Prevent current logged in user from deleting their own account
    if (targetUserId === req.user.id) {
      return res.status(400).json({ success: false, error: 'You cannot delete your own account' });
    }

    // 2. Check target user details
    const targetUser = await get(`
      SELECT u.id, u.email, u.full_name, r.slug as role_slug
      FROM users u
      JOIN roles r ON u.role_id = r.id
      WHERE u.id = ? AND u.status != 'deleted'
    `, [targetUserId]);

    if (!targetUser) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    // 3. Prevent deleting the last remaining Super Admin
    if (targetUser.role_slug === 'super_admin') {
      const superAdminCount = await get(`
        SELECT COUNT(*) as count
        FROM users u
        JOIN roles r ON u.role_id = r.id
        WHERE r.slug = 'super_admin' AND u.status = 'active' AND u.id != ?
      `, [targetUserId]);

      if (!superAdminCount || superAdminCount.count === 0) {
        return res.status(400).json({ success: false, error: 'Cannot delete the last remaining Super Admin account' });
      }
    }

    // 4. Soft delete user (Sets status to 'deleted', immediately invalidates JWT session checks)
    await run(`
      UPDATE users SET
        status = 'deleted',
        deleted_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [targetUserId]);

    // 5. Audit Log
    await logAudit(req, 'user_deleted', `Deleted user account '${targetUser.email}' (${targetUser.full_name})`);

    res.json({ success: true, message: `User '${targetUser.full_name}' (${targetUser.email}) has been deleted successfully` });
  } catch (err) {
    console.error('Delete user error:', err);
    res.status(500).json({ success: false, error: 'Failed to delete user' });
  }
});

module.exports = router;
