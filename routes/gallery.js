const express = require('express');
const router = express.Router();
const { get, query, run } = require('../db');
const { authenticate, requirePermission, logAudit } = require('../middleware/auth');

// GET /api/v1/gallery
router.get('/', async (req, res) => {
  try {
    const { category, featured } = req.query;
    let sql = 'SELECT * FROM gallery WHERE is_hidden = 0';
    const params = [];

    if (req.headers.authorization || req.cookies?.oz_admin_token) {
      sql = 'SELECT * FROM gallery WHERE 1=1'; // Admin sees all including hidden
    }

    if (category) {
      sql += ' AND category = ?';
      params.push(category);
    }
    if (featured === 'true' || featured === '1') {
      sql += ' AND is_featured = 1';
    }

    sql += ' ORDER BY display_order ASC, id DESC';
    const items = await query(sql, params);
    res.json({ success: true, data: items });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to fetch gallery items' });
  }
});

// POST /api/v1/gallery
router.post('/', authenticate, requirePermission('manage_gallery'), async (req, res) => {
  try {
    const { title_en, title_ar, category, image_url, caption_en, caption_ar, alt_text_en, alt_text_ar, is_featured, display_order } = req.body;
    if (!image_url || !category) {
      return res.status(400).json({ success: false, error: 'Image URL and Category are required' });
    }

    const result = await run(`
      INSERT INTO gallery (
        title_en, title_ar, category, image_url, caption_en, caption_ar, alt_text_en, alt_text_ar, is_featured, display_order
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      title_en || '', title_ar || '', category, image_url,
      caption_en || '', caption_ar || '', alt_text_en || '', alt_text_ar || '',
      is_featured ? 1 : 0, display_order || 0
    ]);

    await logAudit(req, 'ADD_GALLERY_ITEM', `Added image to gallery category '${category}'`);
    res.json({ success: true, message: 'Gallery item added', id: result.id });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to add gallery item' });
  }
});

// PUT /api/v1/gallery/:id
router.put('/:id', authenticate, requirePermission('manage_gallery'), async (req, res) => {
  try {
    const { title_en, title_ar, category, image_url, caption_en, caption_ar, alt_text_en, alt_text_ar, is_featured, is_hidden, display_order } = req.body;

    await run(`
      UPDATE gallery SET
        title_en = ?, title_ar = ?, category = ?, image_url = ?, caption_en = ?, caption_ar = ?,
        alt_text_en = ?, alt_text_ar = ?, is_featured = ?, is_hidden = ?, display_order = ?
      WHERE id = ?
    `, [
      title_en || '', title_ar || '', category, image_url, caption_en || '', caption_ar || '',
      alt_text_en || '', alt_text_ar || '', is_featured ? 1 : 0, is_hidden ? 1 : 0, display_order || 0,
      req.params.id
    ]);

    await logAudit(req, 'UPDATE_GALLERY_ITEM', `Updated gallery item ID ${req.params.id}`);
    res.json({ success: true, message: 'Gallery item updated' });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to update gallery item' });
  }
});

// DELETE /api/v1/gallery/:id
router.delete('/:id', authenticate, requirePermission('manage_gallery'), async (req, res) => {
  try {
    await run('DELETE FROM gallery WHERE id = ?', [req.params.id]);
    await logAudit(req, 'DELETE_GALLERY_ITEM', `Deleted gallery item ID ${req.params.id}`);
    res.json({ success: true, message: 'Gallery item deleted' });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to delete gallery item' });
  }
});

module.exports = router;
