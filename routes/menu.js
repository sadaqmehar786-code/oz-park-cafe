const express = require('express');
const router = express.Router();
const { get, query, run } = require('../db');
const { authenticate, requirePermission, logAudit, logRevision } = require('../middleware/auth');

// GET /api/v1/menu/categories
router.get('/categories', async (req, res) => {
  try {
    const categories = await query('SELECT * FROM menu_categories ORDER BY display_order ASC, id ASC');
    res.json({ success: true, data: categories });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to fetch menu categories' });
  }
});

// POST /api/v1/menu/categories
router.post('/categories', authenticate, requirePermission('manage_menu'), async (req, res) => {
  try {
    const { name_en, name_ar, icon, description_en, description_ar, display_order, status } = req.body;
    if (!name_en || !name_ar) {
      return res.status(400).json({ success: false, error: 'Category names in English and Arabic are required' });
    }

    const slug = name_en.toLowerCase().replace(/[^a-z0-9-]/g, '-');
    const result = await run(`
      INSERT INTO menu_categories (name_en, name_ar, slug, icon, description_en, description_ar, display_order, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [name_en, name_ar, slug, icon || '☕', description_en || '', description_ar || '', display_order || 0, status || 'active']);

    await logAudit(req, 'CREATE_MENU_CATEGORY', `Created category '${name_en}'`);
    res.json({ success: true, message: 'Category created', id: result.id });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to create category' });
  }
});

// PUT /api/v1/menu/categories/:id
router.put('/categories/:id', authenticate, requirePermission('manage_menu'), async (req, res) => {
  try {
    const { name_en, name_ar, icon, description_en, description_ar, display_order, status } = req.body;
    await run(`
      UPDATE menu_categories SET
        name_en = ?, name_ar = ?, icon = ?, description_en = ?, description_ar = ?,
        display_order = ?, status = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [name_en, name_ar, icon, description_en, description_ar, display_order, status, req.params.id]);

    await logAudit(req, 'UPDATE_MENU_CATEGORY', `Updated category ID ${req.params.id}`);
    res.json({ success: true, message: 'Category updated' });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to update category' });
  }
});

// GET /api/v1/menu/items
router.get('/items', async (req, res) => {
  try {
    const { category, availability, featured, search, sort } = req.query;

    let sql = `
      SELECT m.*, c.name_en as category_name_en, c.name_ar as category_name_ar
      FROM menu_items m
      LEFT JOIN menu_categories c ON m.category_id = c.id
      WHERE m.deleted_at IS NULL
    `;
    const params = [];

    if (category) {
      sql += ' AND (c.slug = ? OR m.category_id = ?)';
      params.push(category, category);
    }
    if (availability) {
      sql += ' AND m.availability_status = ?';
      params.push(availability);
    }
    if (featured === 'true' || featured === '1') {
      sql += ' AND m.is_featured = 1';
    }
    if (search) {
      sql += ' AND (m.name_en LIKE ? OR m.name_ar LIKE ? OR m.description_en LIKE ? OR m.description_ar LIKE ?)';
      const term = `%${search}%`;
      params.push(term, term, term, term);
    }

    if (sort === 'price_asc') {
      sql += ' ORDER BY m.price ASC';
    } else if (sort === 'price_desc') {
      sql += ' ORDER BY m.price DESC';
    } else {
      sql += ' ORDER BY m.display_order ASC, m.id DESC';
    }

    const items = await query(sql, params);

    // Attach sizes
    for (const item of items) {
      item.sizes = await query('SELECT * FROM menu_item_sizes WHERE menu_item_id = ? ORDER BY price ASC', [item.id]);
    }

    res.json({ success: true, data: items });
  } catch (err) {
    console.error('Fetch items error:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch menu items' });
  }
});

// GET /api/v1/menu/items/:id
router.get('/items/:id', async (req, res) => {
  try {
    const item = await get(`
      SELECT m.*, c.name_en as category_name_en, c.name_ar as category_name_ar
      FROM menu_items m
      LEFT JOIN menu_categories c ON m.category_id = c.id
      WHERE (m.id = ? OR m.slug = ?) AND m.deleted_at IS NULL
    `, [req.params.id, req.params.id]);

    if (!item) {
      return res.status(404).json({ success: false, error: 'Menu item not found' });
    }

    item.sizes = await query('SELECT * FROM menu_item_sizes WHERE menu_item_id = ? ORDER BY price ASC', [item.id]);
    res.json({ success: true, data: item });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to fetch menu item' });
  }
});

// POST /api/v1/menu/items
router.post('/items', authenticate, requirePermission('manage_menu'), async (req, res) => {
  try {
    const {
      category_id, name_en, name_ar, description_en, description_ar,
      price, discount_price, image_url, ingredients_en, ingredients_ar,
      allergens, calories, is_hot, is_cold, is_featured, is_new, is_bestseller,
      is_seasonal, availability_status, display_order, seo_title, meta_desc, sizes
    } = req.body;

    if (!name_en || !name_ar || !price || !category_id) {
      return res.status(400).json({ success: false, error: 'Name (EN & AR), Category, and Price are required' });
    }

    const slug = name_en.toLowerCase().replace(/[^a-z0-9-]/g, '-') + '-' + Date.now().toString().slice(-4);

    const result = await run(`
      INSERT INTO menu_items (
        category_id, name_en, name_ar, slug, description_en, description_ar,
        price, discount_price, image_url, ingredients_en, ingredients_ar,
        allergens, calories, is_hot, is_cold, is_featured, is_new, is_bestseller,
        is_seasonal, availability_status, display_order, seo_title, meta_desc
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      category_id, name_en, name_ar, slug, description_en || '', description_ar || '',
      parseFloat(price), discount_price ? parseFloat(discount_price) : null,
      image_url || 'assets/images/coffee.jpg', ingredients_en || '', ingredients_ar || '',
      allergens || '', calories ? parseInt(calories) : null,
      is_hot ? 1 : 0, is_cold ? 1 : 0, is_featured ? 1 : 0, is_new ? 1 : 0, is_bestseller ? 1 : 0,
      is_seasonal ? 1 : 0, availability_status || 'available', display_order || 0,
      seo_title || `${name_ar} - أوز بارك كافيه`, meta_desc || description_ar || ''
    ]);

    // Insert sizes if present
    if (sizes && Array.isArray(sizes)) {
      for (const s of sizes) {
        if (s.size_en && s.price) {
          await run('INSERT INTO menu_item_sizes (menu_item_id, size_en, size_ar, price, is_default) VALUES (?, ?, ?, ?, ?)', [
            result.id, s.size_en, s.size_ar || s.size_en, parseFloat(s.price), s.is_default ? 1 : 0
          ]);
        }
      }
    }

    await logAudit(req, 'CREATE_MENU_ITEM', `Created menu item '${name_en}' (${price} SAR)`);
    await logRevision('menu_item', result.id, 'CREATE', null, req.body, req.user.id);

    res.json({ success: true, message: 'Menu item created successfully', id: result.id });
  } catch (err) {
    console.error('Create item error:', err);
    res.status(500).json({ success: false, error: 'Failed to create menu item' });
  }
});

// PUT /api/v1/menu/items/:id
router.put('/items/:id', authenticate, requirePermission('manage_menu'), async (req, res) => {
  try {
    const item = await get('SELECT * FROM menu_items WHERE id = ? AND deleted_at IS NULL', [req.params.id]);
    if (!item) {
      return res.status(404).json({ success: false, error: 'Menu item not found' });
    }

    const {
      category_id, name_en, name_ar, description_en, description_ar,
      price, discount_price, image_url, ingredients_en, ingredients_ar,
      allergens, calories, is_hot, is_cold, is_featured, is_new, is_bestseller,
      is_seasonal, availability_status, display_order, seo_title, meta_desc, sizes
    } = req.body;

    // Track price change in audit log
    if (price && parseFloat(price) !== item.price) {
      await logAudit(req, 'MENU_PRICE_CHANGE', `Price changed for '${item.name_en}' from ${item.price} SAR to ${price} SAR`);
    }

    await run(`
      UPDATE menu_items SET
        category_id = ?, name_en = ?, name_ar = ?, description_en = ?, description_ar = ?,
        price = ?, discount_price = ?, image_url = ?, ingredients_en = ?, ingredients_ar = ?,
        allergens = ?, calories = ?, is_hot = ?, is_cold = ?, is_featured = ?, is_new = ?,
        is_bestseller = ?, is_seasonal = ?, availability_status = ?, display_order = ?,
        seo_title = ?, meta_desc = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [
      category_id || item.category_id,
      name_en || item.name_en,
      name_ar || item.name_ar,
      description_en !== undefined ? description_en : item.description_en,
      description_ar !== undefined ? description_ar : item.description_ar,
      price !== undefined ? parseFloat(price) : item.price,
      discount_price !== undefined ? (discount_price ? parseFloat(discount_price) : null) : item.discount_price,
      image_url !== undefined ? image_url : item.image_url,
      ingredients_en !== undefined ? ingredients_en : item.ingredients_en,
      ingredients_ar !== undefined ? ingredients_ar : item.ingredients_ar,
      allergens !== undefined ? allergens : item.allergens,
      calories !== undefined ? (calories ? parseInt(calories) : null) : item.calories,
      is_hot !== undefined ? (is_hot ? 1 : 0) : item.is_hot,
      is_cold !== undefined ? (is_cold ? 1 : 0) : item.is_cold,
      is_featured !== undefined ? (is_featured ? 1 : 0) : item.is_featured,
      is_new !== undefined ? (is_new ? 1 : 0) : item.is_new,
      is_bestseller !== undefined ? (is_bestseller ? 1 : 0) : item.is_bestseller,
      is_seasonal !== undefined ? (is_seasonal ? 1 : 0) : item.is_seasonal,
      availability_status !== undefined ? availability_status : item.availability_status,
      display_order !== undefined ? parseInt(display_order) : item.display_order,
      seo_title !== undefined ? seo_title : item.seo_title,
      meta_desc !== undefined ? meta_desc : item.meta_desc,
      item.id
    ]);

    if (sizes && Array.isArray(sizes)) {
      await run('DELETE FROM menu_item_sizes WHERE menu_item_id = ?', [item.id]);
      for (const s of sizes) {
        if (s.size_en && s.price) {
          await run('INSERT INTO menu_item_sizes (menu_item_id, size_en, size_ar, price, is_default) VALUES (?, ?, ?, ?, ?)', [
            item.id, s.size_en, s.size_ar || s.size_en, parseFloat(s.price), s.is_default ? 1 : 0
          ]);
        }
      }
    }

    await logAudit(req, 'UPDATE_MENU_ITEM', `Updated menu item '${item.name_en}'`);
    await logRevision('menu_item', item.id, 'UPDATE', item, req.body, req.user.id);

    res.json({ success: true, message: 'Menu item updated successfully' });
  } catch (err) {
    console.error('Update item error:', err);
    res.status(500).json({ success: false, error: 'Failed to update menu item' });
  }
});

// PATCH /api/v1/menu/items/:id/availability
router.patch('/items/:id/availability', authenticate, requirePermission('manage_menu'), async (req, res) => {
  try {
    const { status } = req.body; // 'available' or 'unavailable'
    if (!['available', 'unavailable'].includes(status)) {
      return res.status(400).json({ success: false, error: 'Invalid availability status' });
    }

    const item = await get('SELECT name_en FROM menu_items WHERE id = ?', [req.params.id]);
    await run('UPDATE menu_items SET availability_status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [status, req.params.id]);

    await logAudit(req, 'TOGGLE_MENU_AVAILABILITY', `Set availability of '${item ? item.name_en : req.params.id}' to '${status}'`);
    res.json({ success: true, message: `Menu item status updated to ${status}` });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to update availability' });
  }
});

// DELETE /api/v1/menu/items/:id (Soft Delete)
router.delete('/items/:id', authenticate, requirePermission('manage_menu'), async (req, res) => {
  try {
    const item = await get('SELECT name_en FROM menu_items WHERE id = ?', [req.params.id]);
    await run('UPDATE menu_items SET deleted_at = CURRENT_TIMESTAMP WHERE id = ?', [req.params.id]);

    await logAudit(req, 'DELETE_MENU_ITEM', `Deleted menu item '${item ? item.name_en : req.params.id}'`);
    res.json({ success: true, message: 'Menu item deleted' });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to delete menu item' });
  }
});

module.exports = router;
