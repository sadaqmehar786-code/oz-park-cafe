const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const { get, query, run } = require('../db');
const { authenticate, requirePermission, logAudit } = require('../middleware/auth');

// GET /api/v1/restaurant/categories (With item count)
router.get('/categories', async (req, res) => {
  try {
    const categories = await query(`
      SELECT c.*, COUNT(m.id) as item_count
      FROM restaurant_categories c
      LEFT JOIN restaurant_items m ON m.category_id = c.id AND m.deleted_at IS NULL
      GROUP BY c.id
      ORDER BY c.display_order ASC, c.id ASC
    `);
    res.json({ success: true, data: categories });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to fetch restaurant categories' });
  }
});

// POST /api/v1/restaurant/categories
router.post('/categories', authenticate, requirePermission('manage_menu'), async (req, res) => {
  if (req.user.role === 'menu_editor') {
    return res.status(403).json({ success: false, error: 'Forbidden: Category management is restricted to Administrators' });
  }
  try {
    const { name_en, name_ar, icon, display_order, status } = req.body;
    if (!name_en || !name_ar) {
      return res.status(400).json({ success: false, error: 'Category names in English and Arabic are required' });
    }

    const cleanEn = name_en.trim();
    const cleanAr = name_ar.trim();

    const existing = await get(`
      SELECT id FROM restaurant_categories
      WHERE TRIM(LOWER(name_en)) = LOWER(?) OR TRIM(LOWER(name_ar)) = LOWER(?)
    `, [cleanEn, cleanAr]);

    if (existing) {
      return res.status(400).json({ success: false, error: 'A restaurant category with this name already exists' });
    }

    const slug = cleanEn.toLowerCase().replace(/[^a-z0-9-]/g, '-') + '-' + Date.now().toString().slice(-4);
    const result = await run(`
      INSERT INTO restaurant_categories (name_en, name_ar, slug, icon, display_order, status)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [cleanEn, cleanAr, slug, icon || '🍽️', display_order || 0, status || 'active']);

    await logAudit(req, 'CREATE_RESTAURANT_CATEGORY', `Created restaurant category '${cleanEn}'`);
    res.json({ success: true, message: 'Restaurant category created successfully', id: result.id });
  } catch (err) {
    console.error('Create restaurant category error:', err);
    res.status(500).json({ success: false, error: 'Failed to create restaurant category' });
  }
});

// PUT /api/v1/restaurant/categories/:id
router.put('/categories/:id', authenticate, requirePermission('manage_menu'), async (req, res) => {
  if (req.user.role === 'menu_editor') {
    return res.status(403).json({ success: false, error: 'Forbidden: Category management is restricted to Administrators' });
  }
  try {
    const categoryId = parseInt(req.params.id);
    const category = await get('SELECT * FROM restaurant_categories WHERE id = ?', [categoryId]);
    if (!category) {
      return res.status(404).json({ success: false, error: 'Category not found' });
    }

    const { name_en, name_ar, icon, display_order } = req.body;
    if (!name_en || !name_ar) {
      return res.status(400).json({ success: false, error: 'Both English and Arabic category names are required' });
    }

    const cleanEn = name_en.trim();
    const cleanAr = name_ar.trim();

    const duplicate = await get(`
      SELECT id FROM restaurant_categories 
      WHERE (TRIM(LOWER(name_en)) = LOWER(?) OR TRIM(LOWER(name_ar)) = LOWER(?)) 
      AND id != ?
    `, [cleanEn, cleanAr, categoryId]);

    if (duplicate) {
      return res.status(400).json({ success: false, error: 'Another category with this name already exists' });
    }

    await run(`
      UPDATE restaurant_categories 
      SET name_en = ?, name_ar = ?, icon = ?, display_order = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [cleanEn, cleanAr, icon || category.icon || '🍽️', display_order !== undefined ? display_order : category.display_order, categoryId]);

    await logAudit(req, 'UPDATE_RESTAURANT_CATEGORY', `Updated category #${categoryId} to '${cleanEn}'`);
    res.json({ success: true, message: 'Restaurant category updated successfully' });
  } catch (err) {
    console.error('Update restaurant category error:', err);
    res.status(500).json({ success: false, error: 'Failed to update category' });
  }
});

// DELETE /api/v1/restaurant/categories/:id
router.delete('/categories/:id', authenticate, requirePermission('manage_menu'), async (req, res) => {
  if (req.user.role === 'menu_editor') {
    return res.status(403).json({ success: false, error: 'Forbidden: Category management is restricted to Administrators' });
  }
  try {
    const categoryId = parseInt(req.params.id);
    const category = await get('SELECT * FROM restaurant_categories WHERE id = ?', [categoryId]);
    if (!category) {
      return res.status(404).json({ success: false, error: 'Category not found' });
    }

    const itemCount = await get('SELECT COUNT(*) as count FROM restaurant_items WHERE category_id = ? AND deleted_at IS NULL', [categoryId]);
    if (itemCount && itemCount.count > 0) {
      return res.status(400).json({
        success: false,
        error: `Cannot delete category: It contains ${itemCount.count} active items. Please move or delete the items first.`
      });
    }

    await run('DELETE FROM restaurant_categories WHERE id = ?', [categoryId]);
    await logAudit(req, 'DELETE_RESTAURANT_CATEGORY', `Deleted category '${category.name_en}'`);
    res.json({ success: true, message: 'Restaurant category deleted successfully' });
  } catch (err) {
    console.error('Delete restaurant category error:', err);
    res.status(500).json({ success: false, error: 'Failed to delete category' });
  }
});

// GET /api/v1/restaurant/items
router.get('/items', async (req, res) => {
  try {
    const { category, search, status } = req.query;

    let sql = `
      SELECT m.*, c.name_en as category_name_en, c.name_ar as category_name_ar, c.slug as category_slug, c.icon as category_icon
      FROM restaurant_items m
      LEFT JOIN restaurant_categories c ON m.category_id = c.id
      WHERE m.deleted_at IS NULL
    `;
    const params = [];

    if (category && category !== 'all') {
      sql += ' AND (m.category_id = ? OR c.slug = ?)';
      params.push(category, category);
    }

    if (search) {
      sql += ' AND (m.name_en LIKE ? OR m.name_ar LIKE ? OR m.description_en LIKE ? OR m.description_ar LIKE ?)';
      params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
    }

    if (status) {
      sql += ' AND m.availability_status = ?';
      params.push(status);
    }

    sql += ' ORDER BY c.display_order ASC, m.display_order ASC, m.id ASC';

    const items = await query(sql, params);
    res.json({ success: true, data: items });
  } catch (err) {
    console.error('Fetch restaurant items error:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch restaurant items' });
  }
});

// GET /api/v1/restaurant/items/:id
router.get('/items/:id', async (req, res) => {
  try {
    const item = await get(`
      SELECT m.*, c.name_en as category_name_en, c.name_ar as category_name_ar
      FROM restaurant_items m
      LEFT JOIN restaurant_categories c ON m.category_id = c.id
      WHERE (m.id = ? OR m.slug = ?) AND m.deleted_at IS NULL
    `, [req.params.id, req.params.id]);

    if (!item) {
      return res.status(404).json({ success: false, error: 'Restaurant menu item not found' });
    }

    res.json({ success: true, data: item });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to fetch item' });
  }
});

// POST /api/v1/restaurant/items
router.post('/items', authenticate, requirePermission('manage_menu'), async (req, res) => {
  if (req.user.role === 'menu_editor') {
    return res.status(403).json({ success: false, error: 'Forbidden: Creating new items is restricted to Administrators. You can edit existing items.' });
  }
  try {
    const {
      category_id, name_en, name_ar, description_en, description_ar,
      price, discount_price, image_url, calories, availability_status, display_order
    } = req.body;

    if (!name_en || !name_ar || !price || !category_id) {
      return res.status(400).json({ success: false, error: 'Name (EN & AR), Category, and Price are required' });
    }

    const slug = name_en.toLowerCase().replace(/[^a-z0-9-]/g, '-') + '-' + Date.now().toString().slice(-4);

    function sanitizeImg(url) {
      if (!url) return '';
      const str = url.trim();
      if (str.startsWith('data:image/') || str.startsWith('/api/') || str.startsWith('/uploads/') || str.startsWith('uploads/') || str.startsWith('http://') || str.startsWith('https://')) {
        return str;
      }
      return '';
    }

    const finalImageUrl = sanitizeImg(image_url);

    const result = await run(`
      INSERT INTO restaurant_items (
        category_id, name_en, name_ar, slug, description_en, description_ar,
        price, discount_price, image_url, calories, availability_status, display_order
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      category_id, name_en.trim(), name_ar.trim(), slug, description_en || '', description_ar || '',
      parseFloat(price), discount_price ? parseFloat(discount_price) : null,
      finalImageUrl, calories ? parseInt(calories) : null,
      availability_status || 'available', display_order || 0
    ]);

    await logAudit(req, 'CREATE_RESTAURANT_ITEM', `Created item '${name_en}'`);
    res.json({ success: true, message: 'Restaurant item created successfully', id: result.id });
  } catch (err) {
    console.error('Create restaurant item error:', err);
    res.status(500).json({ success: false, error: 'Failed to create restaurant item' });
  }
});

// PUT /api/v1/restaurant/items/:id
router.put('/items/:id', authenticate, requirePermission('manage_menu'), async (req, res) => {
  try {
    const itemId = parseInt(req.params.id);
    const existing = await get('SELECT * FROM restaurant_items WHERE id = ? AND deleted_at IS NULL', [itemId]);
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Restaurant menu item not found' });
    }

    const {
      category_id, name_en, name_ar, description_en, description_ar,
      price, discount_price, image_url, calories, availability_status, display_order
    } = req.body;

    function sanitizeImg(url) {
      if (!url) return '';
      const str = url.trim();
      if (str.startsWith('data:image/') || str.startsWith('/api/') || str.startsWith('/uploads/') || str.startsWith('uploads/') || str.startsWith('http://') || str.startsWith('https://')) {
        return str;
      }
      return '';
    }

    const isMenuEditor = req.user.role === 'menu_editor';
    const targetCategoryId = isMenuEditor ? existing.category_id : (category_id || existing.category_id);
    const targetPrice = isMenuEditor ? existing.price : (price ? parseFloat(price) : existing.price);
    const targetDiscount = isMenuEditor ? existing.discount_price : (discount_price !== undefined ? (discount_price ? parseFloat(discount_price) : null) : existing.discount_price);
    const targetCalories = isMenuEditor ? existing.calories : (calories !== undefined ? (calories ? parseInt(calories) : null) : existing.calories);

    await run(`
      UPDATE restaurant_items SET
        category_id = COALESCE(?, category_id),
        name_en = COALESCE(?, name_en),
        name_ar = COALESCE(?, name_ar),
        description_en = COALESCE(?, description_en),
        description_ar = COALESCE(?, description_ar),
        price = COALESCE(?, price),
        discount_price = ?,
        image_url = ?,
        calories = ?,
        availability_status = COALESCE(?, availability_status),
        display_order = COALESCE(?, display_order),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [
      targetCategoryId, name_en ? name_en.trim() : null, name_ar ? name_ar.trim() : null,
      description_en !== undefined ? description_en : null, description_ar !== undefined ? description_ar : null,
      targetPrice, targetDiscount,
      finalImageUrl, targetCalories,
      availability_status, display_order, itemId
    ]);

    await logAudit(req, 'UPDATE_RESTAURANT_ITEM', `Updated item #${itemId}`);
    res.json({ success: true, message: 'Restaurant item updated successfully' });
  } catch (err) {
    console.error('Update restaurant item error:', err);
    res.status(500).json({ success: false, error: 'Failed to update restaurant item' });
  }
});

// PATCH /api/v1/restaurant/items/:id/availability
router.patch('/items/:id/availability', authenticate, requirePermission('manage_menu'), async (req, res) => {
  try {
    const { status } = req.body;
    await run('UPDATE restaurant_items SET availability_status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [status, req.params.id]);
    res.json({ success: true, message: 'Status updated' });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to update status' });
  }
});

// DELETE /api/v1/restaurant/items/:id
router.delete('/items/:id', authenticate, requirePermission('manage_menu'), async (req, res) => {
  if (req.user.role === 'menu_editor') {
    return res.status(403).json({ success: false, error: 'Forbidden: Deleting restaurant items is restricted to Administrators' });
  }
  try {
    const itemId = parseInt(req.params.id);
    const item = await get('SELECT * FROM restaurant_items WHERE id = ?', [itemId]);
    if (!item) {
      return res.status(404).json({ success: false, error: 'Item not found' });
    }

    await run('UPDATE restaurant_items SET deleted_at = CURRENT_TIMESTAMP WHERE id = ?', [itemId]);
    await logAudit(req, 'DELETE_RESTAURANT_ITEM', `Soft deleted item #${itemId}`);
    res.json({ success: true, message: 'Restaurant item deleted successfully' });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to delete restaurant item' });
  }
});

module.exports = router;
