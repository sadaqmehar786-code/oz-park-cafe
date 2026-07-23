const jwt = require('jsonwebtoken');
const { get, run } = require('../db');

const JWT_SECRET = process.env.JWT_SECRET || 'oz_park_cafe_ultra_secret_key_2026';

// Parse cookies helper
function parseCookies(req) {
  const list = {};
  const rc = req.headers.cookie;

  if (rc) {
    rc.split(';').forEach(cookie => {
      const parts = cookie.split('=');
      list[parts.shift().trim()] = decodeURI(parts.join('='));
    });
  }
  return list;
}

// Authentication middleware
async function authenticate(req, res, next) {
  try {
    const cookies = parseCookies(req);
    let token = cookies.oz_admin_token;

    if (!token && req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return res.status(401).json({ success: false, error: 'Unauthorized: No token provided' });
    }

    const decoded = jwt.verify(token, JWT_SECRET);

    // Fetch user and permissions
    const user = await get(`
      SELECT u.id, u.full_name, u.email, u.phone, u.profile_image, u.status, u.preferred_lang, r.name as role_name, r.slug as role_slug, r.permissions
      FROM users u
      JOIN roles r ON u.role_id = r.id
      WHERE u.id = ? AND u.status = 'active'
    `, [decoded.userId]);

    if (!user) {
      return res.status(401).json({ success: false, error: 'Unauthorized: User not found or inactive' });
    }

    req.user = {
      id: user.id,
      name: user.full_name,
      email: user.email,
      role: user.role_slug,
      roleName: user.role_name,
      permissions: JSON.parse(user.permissions || '[]')
    };

    next();
  } catch (err) {
    return res.status(401).json({ success: false, error: 'Unauthorized: Invalid or expired token' });
  }
}

// RBAC Permission Check middleware builder
function requirePermission(permission) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Unauthorized access' });
    }

    const userPerms = req.user.permissions;
    if (userPerms.includes('*') || userPerms.includes(permission)) {
      return next();
    }

    return res.status(403).json({ success: false, error: `Forbidden: Permission '${permission}' required` });
  };
}

// Audit Logger helper
async function logAudit(req, action, details) {
  try {
    const userId = req.user ? req.user.id : null;
    const userEmail = req.user ? req.user.email : 'System/Guest';
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';

    await run(`
      INSERT INTO audit_logs (user_id, user_email, action, details, ip_address)
      VALUES (?, ?, ?, ?, ?)
    `, [userId, userEmail, action, typeof details === 'object' ? JSON.stringify(details) : details, ip]);
  } catch (err) {
    console.error('Failed to log audit event:', err);
  }
}

// Revision tracker helper
async function logRevision(entityType, entityId, changeType, dataBefore, dataAfter, userId) {
  try {
    await run(`
      INSERT INTO revisions (entity_type, entity_id, change_type, data_before, data_after, changed_by)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [
      entityType,
      entityId,
      changeType,
      dataBefore ? JSON.stringify(dataBefore) : null,
      dataAfter ? JSON.stringify(dataAfter) : null,
      userId || null
    ]);
  } catch (err) {
    console.error('Failed to log revision:', err);
  }
}

module.exports = {
  JWT_SECRET,
  authenticate,
  requirePermission,
  logAudit,
  logRevision,
  parseCookies
};
