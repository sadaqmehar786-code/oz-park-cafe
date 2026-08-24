const express = require('express');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const { initDb } = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize Database
initDb().then(async () => {
  console.log('[Server] Database initialized successfully');
  try {
    const { updateDessertsMenu } = require('./db');
    await updateDessertsMenu();
  } catch (e) {
    console.error('[Server] Failed to auto-update desserts on boot:', e);
  }
}).catch(err => {
  console.error('[Server] Database initialization failed:', err);
});

// Middleware
app.use(cors());
app.use(cookieParser());
app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));

// Serve uploads statically via public API path for Amplify proxying
app.use('/api/v1/public/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Direct dynamic API asset endpoints to bypass static caches (Express 5 compatible)
app.get('/api/v1/public/admin-app-js', (req, res) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.type('application/javascript');
  res.sendFile(path.join(__dirname, 'assets', 'admin_app_v2.js'));
});

app.get('/admin-assets/app.js', (req, res) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.type('application/javascript');
  res.sendFile(path.join(__dirname, 'assets', 'admin_app_v2.js'));
});

app.get('/admin/app.js', (req, res) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.type('application/javascript');
  res.sendFile(path.join(__dirname, 'assets', 'admin_app_v2.js'));
});

app.get('/assets/admin_app_v2.js', (req, res) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.type('application/javascript');
  res.sendFile(path.join(__dirname, 'assets', 'admin_app_v2.js'));
});

app.get('/admin-assets/style.css', (req, res) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.type('text/css');
  res.sendFile(path.join(__dirname, 'admin', 'style.css'));
});

app.get('/admin/style.css', (req, res) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.type('text/css');
  res.sendFile(path.join(__dirname, 'admin', 'style.css'));
});

app.use('/admin-assets', express.static(path.join(__dirname, 'admin')));

// API Routes
app.get('/api/v1/public/force-sync-menu', async (req, res) => {
  try {
    const { syncFinalizedMenu, query } = require('./db');
    await syncFinalizedMenu();
    const items = await query('SELECT id, name_en, price FROM menu_items ORDER BY id ASC');
    res.json({ success: true, count: items.length, sample: items.slice(0, 5) });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});
app.use('/api/v1/auth', require('./routes/auth'));
app.use('/api/v1/dashboard', require('./routes/dashboard'));
app.use('/api/v1/pages', require('./routes/pages'));
app.use('/api/v1/menu', require('./routes/menu'));
app.use('/api/v1/offers', require('./routes/offers'));
app.use('/api/v1/blog', require('./routes/blog'));
app.use('/api/v1/seo', require('./routes/seo'));
app.use('/api/v1/media', require('./routes/media'));
app.use('/api/v1/gallery', require('./routes/gallery'));
app.use('/api/v1/users', require('./routes/users'));
app.use('/api/v1/roles', require('./routes/roles'));
app.use('/api/v1/settings', require('./routes/settings'));
app.use('/api/v1/activity', require('./routes/activity'));
app.use('/api/v1/public', require('./routes/public'));

// SEO Dynamic Endpoint Routes
app.get('/sitemap.xml', require('./routes/seo'));
app.get('/robots.txt', require('./routes/seo'));

// Serve Admin SPA Dashboard
app.use('/admin', express.static(path.join(__dirname, 'admin')));
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'admin', 'index.html'));
});

// Express 5 regex route for admin subroutes
app.get(/^\/admin\/.*/, (req, res) => {
  res.sendFile(path.join(__dirname, 'admin', 'index.html'));
});

// Clean URL Redirects: /menu.html -> /menu
app.get('/menu.html', (req, res) => {
  res.redirect(301, '/menu');
});

app.get('/menu', (req, res) => {
  res.sendFile(path.join(__dirname, 'menu.html'));
});

// Serve Public Website Static Assets
app.use(express.static(__dirname));

// Catch-all handler for public website
app.use((req, res) => {
  if (req.path.startsWith('/api/') || req.path.startsWith('/admin')) {
    return res.status(404).json({ success: false, error: 'Endpoint or page not found' });
  }
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Start Server
app.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(`  OZ PARK CAFÉ SERVER RUNNING ON PORT ${PORT}`);
  console.log(`  Public Website:   http://localhost:${PORT}/`);
  console.log(`  Admin Dashboard:  http://localhost:${PORT}/admin/login`);
  console.log(`  API Base:         http://localhost:${PORT}/api/v1/`);
  console.log(`====================================================`);
});

module.exports = app;
