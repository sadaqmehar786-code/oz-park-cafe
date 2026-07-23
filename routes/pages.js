const express = require('express');
const router = express.Router();
const { get, query, run } = require('../db');
const { authenticate, requirePermission, logAudit, logRevision } = require('../middleware/auth');

// GET /api/v1/pages
router.get('/', authenticate, requirePermission('manage_pages'), async (req, res) => {
  try {
    const pages = await query(`
      SELECT p.*, u.full_name as updated_by_name
      FROM pages p
      LEFT JOIN users u ON p.updated_by = u.id
      WHERE p.deleted_at IS NULL
      ORDER BY p.display_order ASC, p.id ASC
    `);

    res.json({ success: true, data: pages });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to fetch pages' });
  }
});

// GET /api/v1/pages/:slug
router.get('/:slug', authenticate, requirePermission('manage_pages'), async (req, res) => {
  try {
    const page = await get('SELECT * FROM pages WHERE slug = ? AND deleted_at IS NULL', [req.params.slug]);
    if (!page) {
      return res.status(404).json({ success: false, error: 'Page not found' });
    }

    const sections = await query('SELECT * FROM page_sections WHERE page_id = ? ORDER BY display_order ASC', [page.id]);

    res.json({
      success: true,
      data: {
        ...page,
        sections
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to fetch page details' });
  }
});

// POST /api/v1/pages (Create Page)
router.post('/', authenticate, requirePermission('manage_pages'), async (req, res) => {
  try {
    const { title_en, title_ar, slug, template, status, seo_title_en, seo_title_ar, meta_desc_en, meta_desc_ar } = req.body;
    if (!title_en || !title_ar || !slug) {
      return res.status(400).json({ success: false, error: 'Title (EN & AR) and Slug are required' });
    }

    const cleanSlug = slug.toLowerCase().replace(/[^a-z0-9-]/g, '-');
    const existing = await get('SELECT id FROM pages WHERE slug = ?', [cleanSlug]);
    if (existing) {
      return res.status(400).json({ success: false, error: 'Page slug already exists' });
    }

    const result = await run(`
      INSERT INTO pages (slug, title_en, title_ar, template, status, seo_title_en, seo_title_ar, meta_desc_en, meta_desc_ar, created_by, updated_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      cleanSlug, title_en, title_ar, template || 'default', status || 'draft',
      seo_title_en || title_en, seo_title_ar || title_ar, meta_desc_en || '', meta_desc_ar || '',
      req.user.id, req.user.id
    ]);

    await logAudit(req, 'CREATE_PAGE', `Created new page '${title_en}' (${cleanSlug})`);
    await logRevision('page', result.id, 'CREATE', null, req.body, req.user.id);

    res.json({ success: true, message: 'Page created successfully', id: result.id, slug: cleanSlug });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to create page' });
  }
});

// PUT /api/v1/pages/:slug (Update Page & Sections)
router.put('/:slug', authenticate, requirePermission('manage_pages'), async (req, res) => {
  try {
    const page = await get('SELECT * FROM pages WHERE slug = ? AND deleted_at IS NULL', [req.params.slug]);
    if (!page) {
      return res.status(404).json({ success: false, error: 'Page not found' });
    }

    const { title_en, title_ar, status, template, seo_title_en, seo_title_ar, meta_desc_en, meta_desc_ar, sections } = req.body;

    await run(`
      UPDATE pages SET
        title_en = ?, title_ar = ?, status = ?, template = ?,
        seo_title_en = ?, seo_title_ar = ?, meta_desc_en = ?, meta_desc_ar = ?,
        updated_by = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [
      title_en || page.title_en,
      title_ar || page.title_ar,
      status || page.status,
      template || page.template,
      seo_title_en !== undefined ? seo_title_en : page.seo_title_en,
      seo_title_ar !== undefined ? seo_title_ar : page.seo_title_ar,
      meta_desc_en !== undefined ? meta_desc_en : page.meta_desc_en,
      meta_desc_ar !== undefined ? meta_desc_ar : page.meta_desc_ar,
      req.user.id,
      page.id
    ]);

    // Update section fields if provided
    if (sections && Array.isArray(sections)) {
      for (const sec of sections) {
        if (sec.id) {
          await run(`
            UPDATE page_sections SET
              title_en = ?, title_ar = ?, subtitle_en = ?, subtitle_ar = ?,
              content_en = ?, content_ar = ?, media_url = ?, is_visible = ?, display_order = ?
            WHERE id = ? AND page_id = ?
          `, [
            sec.title_en || '', sec.title_ar || '',
            sec.subtitle_en || '', sec.subtitle_ar || '',
            sec.content_en || '', sec.content_ar || '',
            sec.media_url || '', sec.is_visible !== undefined ? (sec.is_visible ? 1 : 0) : 1,
            sec.display_order || 0,
            sec.id, page.id
          ]);
        } else if (sec.section_key) {
          await run(`
            INSERT INTO page_sections (page_id, section_key, title_en, title_ar, subtitle_en, subtitle_ar, content_en, content_ar, media_url, display_order)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `, [
            page.id, sec.section_key,
            sec.title_en || '', sec.title_ar || '',
            sec.subtitle_en || '', sec.subtitle_ar || '',
            sec.content_en || '', sec.content_ar || '',
            sec.media_url || '', sec.display_order || 0
          ]);
        }
      }
    }

    await logAudit(req, 'UPDATE_PAGE', `Updated page '${page.title_en}' (${page.slug})`);
    await logRevision('page', page.id, 'UPDATE', page, req.body, req.user.id);

    res.json({ success: true, message: 'Page updated successfully' });
  } catch (err) {
    console.error('Update page error:', err);
    res.status(500).json({ success: false, error: 'Failed to update page' });
  }
});

// DELETE /api/v1/pages/:slug (Soft delete)
router.delete('/:slug', authenticate, requirePermission('manage_pages'), async (req, res) => {
  try {
    const page = await get('SELECT * FROM pages WHERE slug = ? AND deleted_at IS NULL', [req.params.slug]);
    if (!page) {
      return res.status(404).json({ success: false, error: 'Page not found' });
    }

    // Core pages cannot be deleted
    if (['home', 'menu', 'contact'].includes(page.slug)) {
      return res.status(400).json({ success: false, error: 'Core system page cannot be deleted. You can unpublish or save it as draft.' });
    }

    await run('UPDATE pages SET deleted_at = CURRENT_TIMESTAMP WHERE id = ?', [page.id]);
    await logAudit(req, 'DELETE_PAGE', `Deleted page '${page.title_en}' (${page.slug})`);

    res.json({ success: true, message: 'Page moved to archive' });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to delete page' });
  }
});

module.exports = router;
