const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const { get, query, run } = require('../db');
const { authenticate, requirePermission, logAudit, logRevision } = require('../middleware/auth');

// Helper function to safely delete physical upload file if no other record uses it
async function cleanupUnusedProductImage(imagePath) {
  if (!imagePath || !imagePath.startsWith('/uploads/')) return;

  try {
    const filename = path.basename(imagePath);

    // Check if any other active menu item uses this image
    const menuUsage = await get('SELECT COUNT(*) as count FROM menu_items WHERE image_url = ? AND deleted_at IS NULL', [imagePath]);
    if (menuUsage && menuUsage.count > 0) return;

    // Check gallery, offers, blog
    const galleryUsage = await get('SELECT COUNT(*) as count FROM gallery WHERE image_url = ?', [imagePath]);
    if (galleryUsage && galleryUsage.count > 0) return;

    const offerUsage = await get('SELECT COUNT(*) as count FROM offers WHERE image_url = ?', [imagePath]);
    if (offerUsage && offerUsage.count > 0) return;

    const blogUsage = await get('SELECT COUNT(*) as count FROM blog_posts WHERE featured_image = ?', [imagePath]);
    if (blogUsage && blogUsage.count > 0) return;

    // If unused, remove physical file from disk
    const fullPath = path.join(__dirname, '../uploads', filename);
    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath);
      console.log(`[Storage Cleanup] Deleted physical file ${filename}`);
    }

    // Also remove from media_library table if present
    await run('DELETE FROM media_library WHERE file_name = ? OR file_path = ?', [filename, imagePath]);
  } catch (err) {
    console.error('Failed to cleanup unused image:', err);
  }
}

// GET /api/v1/menu/categories (With item count)
router.get('/categories', async (req, res) => {
  try {
    const categories = await query(`
      SELECT c.*, COUNT(m.id) as item_count
      FROM menu_categories c
      LEFT JOIN menu_items m ON m.category_id = c.id AND m.deleted_at IS NULL
      GROUP BY c.id
      ORDER BY c.display_order ASC, c.id ASC
    `);
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

    const cleanEn = name_en.trim();
    const cleanAr = name_ar.trim();

    // Check duplicate category names (case-insensitive & whitespace trimmed)
    const existing = await get(`
      SELECT id FROM menu_categories
      WHERE TRIM(LOWER(name_en)) = LOWER(?) OR TRIM(LOWER(name_ar)) = LOWER(?)
    `, [cleanEn, cleanAr]);

    if (existing) {
      return res.status(400).json({ success: false, error: 'A category with this name already exists' });
    }

    const slug = cleanEn.toLowerCase().replace(/[^a-z0-9-]/g, '-');
    const result = await run(`
      INSERT INTO menu_categories (name_en, name_ar, slug, icon, description_en, description_ar, display_order, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [cleanEn, cleanAr, slug, icon || '☕', description_en || '', description_ar || '', display_order || 0, status || 'active']);

    await logAudit(req, 'CREATE_MENU_CATEGORY', `Created category '${cleanEn}'`);
    res.json({ success: true, message: 'Category created successfully', id: result.id });
  } catch (err) {
    console.error('Create category error:', err);
    res.status(500).json({ success: false, error: 'Failed to create category' });
  }
});

// PUT /api/v1/menu/categories/:id (Rename / Edit Category)
router.put('/categories/:id', authenticate, requirePermission('manage_menu'), async (req, res) => {
  try {
    const categoryId = parseInt(req.params.id);
    const category = await get('SELECT * FROM menu_categories WHERE id = ?', [categoryId]);
    if (!category) {
      return res.status(404).json({ success: false, error: 'Category not found' });
    }

    const { name_en, name_ar, icon, description_en, description_ar, display_order, status } = req.body;
    const cleanEn = (name_en || category.name_en).trim();
    const cleanAr = (name_ar || category.name_ar).trim();

    // Check duplicate category names against other categories
    const existing = await get(`
      SELECT id FROM menu_categories
      WHERE (TRIM(LOWER(name_en)) = LOWER(?) OR TRIM(LOWER(name_ar)) = LOWER(?)) AND id != ?
    `, [cleanEn, cleanAr, categoryId]);

    if (existing) {
      return res.status(400).json({ success: false, error: 'Another category with this name already exists' });
    }

    const nameChanged = cleanEn !== category.name_en || cleanAr !== category.name_ar;
    const newSlug = cleanEn.toLowerCase().replace(/[^a-z0-9-]/g, '-');

    await run(`
      UPDATE menu_categories SET
        name_en = ?, name_ar = ?, slug = ?, icon = ?, description_en = ?, description_ar = ?,
        display_order = ?, status = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [
      cleanEn, cleanAr, newSlug,
      icon || category.icon,
      description_en !== undefined ? description_en : category.description_en,
      description_ar !== undefined ? description_ar : category.description_ar,
      display_order !== undefined ? parseInt(display_order) : category.display_order,
      status || category.status,
      categoryId
    ]);

    if (nameChanged) {
      await logAudit(req, 'category_renamed', `Renamed category ID ${categoryId} from '${category.name_en}' / '${category.name_ar}' to '${cleanEn}' / '${cleanAr}'`);
    } else {
      await logAudit(req, 'UPDATE_MENU_CATEGORY', `Updated category ID ${categoryId}`);
    }

    res.json({ success: true, message: 'Category updated successfully' });
  } catch (err) {
    console.error('Update category error:', err);
    res.status(500).json({ success: false, error: 'Failed to update category' });
  }
});

// DELETE /api/v1/menu/categories/:id (With product handling options)
router.delete('/categories/:id', authenticate, requirePermission('manage_menu'), async (req, res) => {
  try {
    const categoryId = parseInt(req.params.id);
    const category = await get('SELECT * FROM menu_categories WHERE id = ?', [categoryId]);
    if (!category) {
      return res.status(404).json({ success: false, error: 'Category not found' });
    }

    // Check count of items in this category
    const itemsCountRow = await get('SELECT COUNT(*) as count FROM menu_items WHERE category_id = ? AND deleted_at IS NULL', [categoryId]);
    const itemsCount = itemsCountRow ? itemsCountRow.count : 0;

    const { action, target_category_id } = req.query.action ? req.query : req.body;

    if (itemsCount > 0 && !action) {
      return res.status(400).json({
        success: false,
        has_products: true,
        item_count: itemsCount,
        error: `Category '${category.name_en}' contains ${itemsCount} product(s). Specify action to move products or mark as uncategorized before deleting.`
      });
    }

    if (itemsCount > 0) {
      if (action === 'move') {
        const targetId = parseInt(target_category_id);
        if (!targetId || targetId === categoryId) {
          return res.status(400).json({ success: false, error: 'Invalid target category selected for moving products' });
        }
        const targetCategory = await get('SELECT id, name_en FROM menu_categories WHERE id = ?', [targetId]);
        if (!targetCategory) {
          return res.status(400).json({ success: false, error: 'Target category does not exist' });
        }

        // Reassign all items to target category
        await run('UPDATE menu_items SET category_id = ? WHERE category_id = ? AND deleted_at IS NULL', [targetId, categoryId]);
        await logAudit(req, 'MOVE_CATEGORY_ITEMS', `Moved ${itemsCount} items from category '${category.name_en}' to '${targetCategory.name_en}'`);

      } else if (action === 'uncategorize') {
        // Ensure an 'Uncategorized' category exists or pick the first available alternative category
        let uncategorized = await get('SELECT id FROM menu_categories WHERE slug = "uncategorized" AND id != ?', [categoryId]);
        if (!uncategorized) {
          const createUncat = await run(`
            INSERT INTO menu_categories (name_en, name_ar, slug, icon, description_en, description_ar, display_order)
            VALUES ('Uncategorized', 'غير مصنف', 'uncategorized', '📂', 'Default category for items', 'التصنيف الافتراضي للأصناف', 999)
          `);
          uncategorized = { id: createUncat.id };
        }

        await run('UPDATE menu_items SET category_id = ? WHERE category_id = ? AND deleted_at IS NULL', [uncategorized.id, categoryId]);
        await logAudit(req, 'UNCATEGORIZE_ITEMS', `Marked ${itemsCount} items from category '${category.name_en}' as uncategorized`);
      } else {
        return res.status(400).json({ success: false, error: 'Invalid deletion action specified' });
      }
    }

    // Delete category
    await run('DELETE FROM menu_categories WHERE id = ?', [categoryId]);
    await logAudit(req, 'category_deleted', `Deleted category '${category.name_en}' (ID ${categoryId})`);

    res.json({ success: true, message: 'Category deleted successfully' });
  } catch (err) {
    console.error('Delete category error:', err);
    res.status(500).json({ success: false, error: 'Failed to delete category' });
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
    const finalImageUrl = (image_url && (image_url.startsWith('/uploads/') || image_url.startsWith('uploads/') || image_url.startsWith('http'))) ? image_url : '';

    const result = await run(`
      INSERT INTO menu_items (
        category_id, name_en, name_ar, slug, description_en, description_ar,
        price, discount_price, image_url, ingredients_en, ingredients_ar,
        allergens, calories, is_hot, is_cold, is_featured, is_new, is_bestseller,
        is_seasonal, availability_status, display_order, seo_title, meta_desc
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      category_id, name_en.trim(), name_ar.trim(), slug, description_en || '', description_ar || '',
      parseFloat(price), discount_price ? parseFloat(discount_price) : null,
      finalImageUrl, ingredients_en || '', ingredients_ar || '',
      allergens || '', calories ? parseInt(calories) : null,
      is_hot ? 1 : 0, is_cold ? 1 : 0, is_featured ? 1 : 0, is_new ? 1 : 0, is_bestseller ? 1 : 0,
      is_seasonal ? 1 : 0, availability_status || 'available', display_order || 0,
      seo_title || `${name_ar} - أوز بارك كافيه`, meta_desc || description_ar || ''
    ]);

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

// PUT /api/v1/menu/items/:id (Update product details & handle image replacement/cleanup)
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

    const oldImageUrl = item.image_url;
    let targetImgUrl = image_url !== undefined ? image_url : item.image_url;
    if (targetImgUrl) {
      const cleanStr = targetImgUrl.trim();
      if (!cleanStr.startsWith('/uploads/') && !cleanStr.startsWith('uploads/') && !cleanStr.startsWith('http')) {
        targetImgUrl = '';
      }
    }
    const newImageUrl = targetImgUrl;
    const imageChanged = oldImageUrl !== newImageUrl;

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
      newImageUrl,
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

    // Handle image audit logging and physical storage cleanup
    if (imageChanged) {
      if (newImageUrl === 'assets/images/coffee.jpg' || !newImageUrl) {
        await logAudit(req, 'product_image_removed', `Removed product image for '${item.name_en}' (ID ${item.id})`);
      } else {
        await logAudit(req, 'product_image_changed', `Replaced product image for '${item.name_en}' (ID ${item.id})`);
      }
      // Cleanup old physical upload file if no longer referenced anywhere
      await cleanupUnusedProductImage(oldImageUrl);
    } else {
      await logAudit(req, 'UPDATE_MENU_ITEM', `Updated menu item '${item.name_en}'`);
    }

    await logRevision('menu_item', item.id, 'UPDATE', item, req.body, req.user.id);
    res.json({ success: true, message: 'Menu item updated successfully' });
  } catch (err) {
    console.error('Update item error:', err);
    res.status(500).json({ success: false, error: 'Failed to update menu item' });
  }
});

// DELETE /api/v1/menu/items/:id/image (Explicit endpoint to remove image & reset to default)
router.delete('/items/:id/image', authenticate, requirePermission('manage_menu'), async (req, res) => {
  try {
    const item = await get('SELECT * FROM menu_items WHERE id = ? AND deleted_at IS NULL', [req.params.id]);
    if (!item) {
      return res.status(404).json({ success: false, error: 'Menu item not found' });
    }

    const oldImageUrl = item.image_url;
    const defaultPlaceholder = 'assets/images/coffee.jpg';

    await run('UPDATE menu_items SET image_url = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [defaultPlaceholder, item.id]);
    await logAudit(req, 'product_image_removed', `Removed product image for '${item.name_en}' (ID ${item.id})`);

    // Cleanup old physical file
    await cleanupUnusedProductImage(oldImageUrl);

    res.json({ success: true, message: 'Product image removed successfully', image_url: defaultPlaceholder });
  } catch (err) {
    console.error('Remove image error:', err);
    res.status(500).json({ success: false, error: 'Failed to remove product image' });
  }
});

// PATCH /api/v1/menu/items/:id/availability
router.patch('/items/:id/availability', authenticate, requirePermission('manage_menu'), async (req, res) => {
  try {
    const { status } = req.body;
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
    res.json({ success: true, message: 'Menu item deleted successfully' });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to delete menu item' });
  }
});

module.exports = router;
