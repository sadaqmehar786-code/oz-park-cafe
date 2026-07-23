const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { get, run } = require('../db');
const { JWT_SECRET, authenticate, logAudit } = require('../middleware/auth');

// Simple rate limiter tracking for login attempts
const loginAttempts = new Map();

// POST /api/v1/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';

    // Check rate limit (max 5 attempts per minute)
    const attempts = loginAttempts.get(ip) || { count: 0, firstAttempt: Date.now() };
    if (Date.now() - attempts.firstAttempt > 60000) {
      attempts.count = 0;
      attempts.firstAttempt = Date.now();
    }
    if (attempts.count >= 5) {
      return res.status(429).json({
        success: false,
        error: 'Too many login attempts. Please wait 1 minute before trying again.'
      });
    }

    if (!email || !password) {
      return res.status(400).json({ success: false, error: 'Email and password are required' });
    }

    const user = await get(`
      SELECT u.id, u.full_name, u.email, u.password_hash, u.status, u.preferred_lang, r.name as role_name, r.slug as role_slug, r.permissions
      FROM users u
      JOIN roles r ON u.role_id = r.id
      WHERE u.email = ?
    `, [email.trim().toLowerCase()]);

    if (!user || user.status !== 'active') {
      attempts.count += 1;
      loginAttempts.set(ip, attempts);
      await logAudit({ user: null, headers: req.headers, socket: req.socket }, 'FAILED_LOGIN', `Failed login attempt for email: ${email}`);
      return res.status(401).json({ success: false, error: 'Invalid email or password' });
    }

    const isValidPassword = bcrypt.compareSync(password, user.password_hash);
    if (!isValidPassword) {
      attempts.count += 1;
      loginAttempts.set(ip, attempts);
      await logAudit({ user: null, headers: req.headers, socket: req.socket }, 'FAILED_LOGIN', `Invalid password for user: ${email}`);
      return res.status(401).json({ success: false, error: 'Invalid email or password' });
    }

    // Reset rate limiter
    loginAttempts.delete(ip);

    // Update last login
    await run('UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = ?', [user.id]);

    // Sign JWT token
    const token = jwt.sign(
      { userId: user.id, email: user.email, role: user.role_slug },
      JWT_SECRET,
      { expiresIn: '12h' }
    );

    // Set secure HTTP-only cookie
    res.cookie('oz_admin_token', token, {
      httpOnly: true,
      secure: false, // Set true in HTTPS production
      maxAge: 12 * 60 * 60 * 1000, // 12 hours
      sameSite: 'lax'
    });

    const reqWithUser = { user: { id: user.id, email: user.email }, headers: req.headers, socket: req.socket };
    await logAudit(reqWithUser, 'LOGIN_SUCCESS', `User ${user.email} logged in successfully`);

    return res.json({
      success: true,
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        name: user.full_name,
        email: user.email,
        role: user.role_slug,
        roleName: user.role_name,
        preferredLang: user.preferred_lang,
        permissions: JSON.parse(user.permissions || '[]')
      }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ success: false, error: 'Server error during login' });
  }
});

// GET /api/v1/auth/me
router.get('/me', authenticate, (req, res) => {
  res.json({
    success: true,
    user: req.user
  });
});

// POST /api/v1/auth/logout
router.post('/logout', authenticate, async (req, res) => {
  await logAudit(req, 'LOGOUT', `User ${req.user.email} logged out`);
  res.clearCookie('oz_admin_token');
  res.json({ success: true, message: 'Logged out successfully' });
});

// POST /api/v1/auth/reset-password
router.post('/reset-password', authenticate, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword || newPassword.length < 6) {
      return res.status(400).json({ success: false, error: 'New password must be at least 6 characters' });
    }

    const user = await get('SELECT password_hash FROM users WHERE id = ?', [req.user.id]);
    if (!bcrypt.compareSync(currentPassword, user.password_hash)) {
      return res.status(400).json({ success: false, error: 'Incorrect current password' });
    }

    const newHash = bcrypt.hashSync(newPassword, 10);
    await run('UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [newHash, req.user.id]);
    await logAudit(req, 'PASSWORD_RESET', `Password reset for user ${req.user.email}`);

    res.json({ success: true, message: 'Password updated successfully' });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Server error during password reset' });
  }
});

module.exports = router;
