const express = require('express');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const { initDb } = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize Database
initDb().then(() => {
  console.log('[Server] Database initialized successfully');
}).catch(err => {
  console.error('[Server] Database initialization failed:', err);
});

// Middleware
app.use(cors());
app.use(cookieParser());
app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true, limit: '15mb' }));

// Static file serving
app.use('/assets', express.static(path.join(__dirname, 'assets')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
// Explicit non-cached admin asset routes
app.get(['/admin-assets/app.js', '/admin/app.js'], (req, res) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.sendFile(path.join(__dirname, 'admin', 'app.js'));
});

app.get(['/admin-assets/style.css', '/admin/style.css'], (req, res) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.sendFile(path.join(__dirname, 'admin', 'style.css'));
});

app.use('/admin-assets', express.static(path.join(__dirname, 'admin')));

// API Routes
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

// Serve Admin SPA Dashboard for any /admin* URL
app.use('/admin', express.static(path.join(__dirname, 'admin')));
app.get(['/admin', '/admin/*'], (req, res) => {
  res.sendFile(path.join(__dirname, 'admin', 'index.html'));
});

// Serve Public Website
app.use(express.static(__dirname));

app.get('/menu', (req, res) => {
  res.sendFile(path.join(__dirname, 'menu.html'));
});

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
