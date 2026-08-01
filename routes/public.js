const express = require('express');
const router = express.Router();
const path = require('path');
const { get, query } = require('../db');

// GET /api/v1/public/admin-app-js - Serve latest admin app.js directly without caching
router.get('/admin-app-js', (req, res) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.type('application/javascript');
  res.sendFile(path.join(__dirname, '..', 'admin', 'app.js'));
});

// GET /api/v1/public/force-sync-menu - Force sync finalized 52 menu items
router.get('/force-sync-menu', async (req, res) => {
  try {
    const { syncFinalizedMenu } = require('../db');
    if (typeof syncFinalizedMenu === 'function') {
      await syncFinalizedMenu();
    }
    const items = await query('SELECT id, name_en, price FROM menu_items ORDER BY id ASC');
    res.json({ success: true, count: items.length, sample: items.slice(0, 5) });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/v1/public/init - Single aggregated payload for public website frontend initialization
router.get('/init', async (req, res) => {
  try {
    const cafe = await get('SELECT * FROM cafe_info WHERE id = 1');
    if (cafe && cafe.social_links) {
      try { cafe.social_links = JSON.parse(cafe.social_links); } catch(e){}
    }

    const settings = await get('SELECT * FROM website_settings WHERE id = 1');
    if (settings) {
      try { settings.integrations = JSON.parse(settings.integrations || '{}'); } catch(e){}
      try { settings.brand_colors = JSON.parse(settings.brand_colors || '{}'); } catch(e){}
    }

    const categories = await query('SELECT * FROM menu_categories ORDER BY display_order ASC, id ASC');
    const menuItems = await query(`
      SELECT m.*, c.slug as category_slug, c.name_en as category_name_en, c.name_ar as category_name_ar
      FROM menu_items m
      LEFT JOIN menu_categories c ON m.category_id = c.id
      WHERE m.deleted_at IS NULL
      ORDER BY m.display_order ASC, m.id ASC
    `);

    // Clean invalid placeholder image URLs
    for (const item of menuItems) {
      if (item.image_url && !item.image_url.startsWith('/uploads/') && !item.image_url.startsWith('uploads/') && !item.image_url.startsWith('http')) {
        item.image_url = null;
      }
    }

    const offers = await query(`
      SELECT * FROM offers
      WHERE status = 'active' AND (end_date IS NULL OR datetime(end_date) >= datetime('now'))
      ORDER BY display_order ASC, id DESC
    `);

    const gallery = await query('SELECT * FROM gallery WHERE is_hidden = 0 ORDER BY display_order ASC, id DESC');
    const navigation = await query('SELECT * FROM navigation WHERE is_active = 1 ORDER BY display_order ASC');

    const homePage = await get('SELECT * FROM pages WHERE slug = "home" AND status = "published"');
    let homeSections = [];
    if (homePage) {
      homeSections = await query('SELECT * FROM page_sections WHERE page_id = ? AND is_visible = 1 ORDER BY display_order ASC', [homePage.id]);
    }

    res.json({
      success: true,
      data: {
        cafe,
        settings,
        categories,
        menuItems,
        offers,
        gallery,
        navigation,
        homePage: homePage ? { ...homePage, sections: homeSections } : null
      }
    });
  } catch (err) {
    console.error('Public init error:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch public website data: ' + err.message });
  }
});

module.exports = router;
