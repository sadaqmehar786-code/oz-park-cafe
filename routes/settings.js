const express = require('express');
const router = express.Router();
const { get, run } = require('../db');
const { authenticate, requirePermission, logAudit } = require('../middleware/auth');

// GET /api/v1/settings/cafe
router.get('/cafe', async (req, res) => {
  try {
    const cafe = await get('SELECT * FROM cafe_info WHERE id = 1');
    if (cafe && cafe.social_links) {
      cafe.social_links = JSON.parse(cafe.social_links);
    }
    res.json({ success: true, data: cafe });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to fetch café info' });
  }
});

// PUT /api/v1/settings/cafe
router.put('/cafe', authenticate, requirePermission('manage_settings'), async (req, res) => {
  try {
    const {
      name_en, name_ar, short_desc_en, short_desc_ar, full_desc_en, full_desc_ar,
      phone, whatsapp, email, address_en, address_ar, google_maps_url,
      latitude, longitude, opening_hours_en, opening_hours_ar, social_links
    } = req.body;

    await run(`
      UPDATE cafe_info SET
        name_en = ?, name_ar = ?, short_desc_en = ?, short_desc_ar = ?,
        full_desc_en = ?, full_desc_ar = ?, phone = ?, whatsapp = ?, email = ?,
        address_en = ?, address_ar = ?, google_maps_url = ?, latitude = ?, longitude = ?,
        opening_hours_en = ?, opening_hours_ar = ?, social_links = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = 1
    `, [
      name_en, name_ar, short_desc_en, short_desc_ar, full_desc_en, full_desc_ar,
      phone, whatsapp, email, address_en, address_ar, google_maps_url,
      latitude ? parseFloat(latitude) : null, longitude ? parseFloat(longitude) : null,
      opening_hours_en, opening_hours_ar,
      typeof social_links === 'object' ? JSON.stringify(social_links) : (social_links || '{}')
    ]);

    await logAudit(req, 'UPDATE_CAFE_SETTINGS', 'Updated OZ Park Café contact & location information');
    res.json({ success: true, message: 'Café information updated successfully' });
  } catch (err) {
    console.error('Update cafe settings error:', err);
    res.status(500).json({ success: false, error: 'Failed to update café info' });
  }
});

// GET /api/v1/settings/general
router.get('/general', async (req, res) => {
  try {
    const settings = await get('SELECT * FROM website_settings WHERE id = 1');
    if (settings) {
      settings.integrations = JSON.parse(settings.integrations || '{}');
      settings.brand_colors = JSON.parse(settings.brand_colors || '{}');
    }
    res.json({ success: true, data: settings });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to fetch general settings' });
  }
});

// PUT /api/v1/settings/general
router.put('/general', authenticate, requirePermission('manage_settings'), async (req, res) => {
  try {
    const { site_name_en, site_name_ar, default_lang, currency_en, currency_ar, integrations, robots_txt, sitemap_enabled } = req.body;

    await run(`
      UPDATE website_settings SET
        site_name_en = ?, site_name_ar = ?, default_lang = ?, currency_en = ?, currency_ar = ?,
        integrations = ?, robots_txt = ?, sitemap_enabled = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = 1
    `, [
      site_name_en, site_name_ar, default_lang || 'ar', currency_en || 'SAR', currency_ar || 'ر.س',
      typeof integrations === 'object' ? JSON.stringify(integrations) : (integrations || '{}'),
      robots_txt, sitemap_enabled ? 1 : 0
    ]);

    await logAudit(req, 'UPDATE_GENERAL_SETTINGS', 'Updated general website settings');
    res.json({ success: true, message: 'General settings updated successfully' });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to update settings' });
  }
});

module.exports = router;
