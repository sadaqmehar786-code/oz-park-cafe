const express = require('express');
const router = express.Router();
const { get, query, run } = require('../db');
const { authenticate, requirePermission, logAudit } = require('../middleware/auth');

// GET /api/v1/offers
router.get('/', async (req, res) => {
  try {
    const { status } = req.query;
    let sql = 'SELECT * FROM offers WHERE 1=1';
    const params = [];

    if (status) {
      sql += ' AND status = ?';
      params.push(status);
    } else if (!req.headers.authorization && !req.cookies?.oz_admin_token) {
      // Public request: only show active and unexpired offers
      sql += ' AND status = "active" AND (end_date IS NULL OR datetime(end_date) >= datetime("now"))';
    }

    sql += ' ORDER BY display_order ASC, id DESC';
    const offers = await query(sql, params);
    res.json({ success: true, data: offers });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to fetch offers' });
  }
});

// POST /api/v1/offers
router.post('/', authenticate, requirePermission('manage_offers'), async (req, res) => {
  try {
    const {
      title_en, title_ar, description_en, description_ar, image_url,
      original_price, offer_price, start_date, end_date, terms_en, terms_ar,
      cta_text_en, cta_text_ar, cta_link, is_featured, status, display_order
    } = req.body;

    if (!title_en || !title_ar) {
      return res.status(400).json({ success: false, error: 'Offer title (EN & AR) is required' });
    }

    const slug = title_en.toLowerCase().replace(/[^a-z0-9-]/g, '-') + '-' + Date.now().toString().slice(-4);

    const result = await run(`
      INSERT INTO offers (
        title_en, title_ar, slug, description_en, description_ar, image_url,
        original_price, offer_price, start_date, end_date, terms_en, terms_ar,
        cta_text_en, cta_text_ar, cta_link, is_featured, status, display_order
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      title_en, title_ar, slug, description_en || '', description_ar || '',
      image_url || 'assets/images/coffee.jpg',
      original_price ? parseFloat(original_price) : null,
      offer_price ? parseFloat(offer_price) : null,
      start_date || null, end_date || null,
      terms_en || '', terms_ar || '',
      cta_text_en || 'Order Offer', cta_text_ar || 'اطلب العرض الآن',
      cta_link || '/#menu', is_featured ? 1 : 0, status || 'active', display_order || 0
    ]);

    await logAudit(req, 'CREATE_OFFER', `Created offer '${title_en}'`);
    res.json({ success: true, message: 'Offer created successfully', id: result.id });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to create offer' });
  }
});

// PUT /api/v1/offers/:id
router.put('/:id', authenticate, requirePermission('manage_offers'), async (req, res) => {
  try {
    const offer = await get('SELECT * FROM offers WHERE id = ?', [req.params.id]);
    if (!offer) {
      return res.status(404).json({ success: false, error: 'Offer not found' });
    }

    const {
      title_en, title_ar, description_en, description_ar, image_url,
      original_price, offer_price, start_date, end_date, terms_en, terms_ar,
      cta_text_en, cta_text_ar, cta_link, is_featured, status, display_order
    } = req.body;

    await run(`
      UPDATE offers SET
        title_en = ?, title_ar = ?, description_en = ?, description_ar = ?, image_url = ?,
        original_price = ?, offer_price = ?, start_date = ?, end_date = ?, terms_en = ?, terms_ar = ?,
        cta_text_en = ?, cta_text_ar = ?, cta_link = ?, is_featured = ?, status = ?, display_order = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [
      title_en || offer.title_en,
      title_ar || offer.title_ar,
      description_en !== undefined ? description_en : offer.description_en,
      description_ar !== undefined ? description_ar : offer.description_ar,
      image_url !== undefined ? image_url : offer.image_url,
      original_price !== undefined ? (original_price ? parseFloat(original_price) : null) : offer.original_price,
      offer_price !== undefined ? (offer_price ? parseFloat(offer_price) : null) : offer.offer_price,
      start_date !== undefined ? start_date : offer.start_date,
      end_date !== undefined ? end_date : offer.end_date,
      terms_en !== undefined ? terms_en : offer.terms_en,
      terms_ar !== undefined ? terms_ar : offer.terms_ar,
      cta_text_en !== undefined ? cta_text_en : offer.cta_text_en,
      cta_text_ar !== undefined ? cta_text_ar : offer.cta_text_ar,
      cta_link !== undefined ? cta_link : offer.cta_link,
      is_featured !== undefined ? (is_featured ? 1 : 0) : offer.is_featured,
      status !== undefined ? status : offer.status,
      display_order !== undefined ? parseInt(display_order) : offer.display_order,
      offer.id
    ]);

    await logAudit(req, 'UPDATE_OFFER', `Updated offer '${offer.title_en}'`);
    res.json({ success: true, message: 'Offer updated successfully' });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to update offer' });
  }
});

// DELETE /api/v1/offers/:id
router.delete('/:id', authenticate, requirePermission('manage_offers'), async (req, res) => {
  try {
    await run('DELETE FROM offers WHERE id = ?', [req.params.id]);
    await logAudit(req, 'DELETE_OFFER', `Deleted offer ID ${req.params.id}`);
    res.json({ success: true, message: 'Offer deleted' });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to delete offer' });
  }
});

module.exports = router;
