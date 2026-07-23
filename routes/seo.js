const express = require('express');
const router = express.Router();
const { get, query, run } = require('../db');
const { authenticate, requirePermission, logAudit } = require('../middleware/auth');

// GET /api/v1/seo/overview
router.get('/overview', authenticate, requirePermission('manage_seo'), async (req, res) => {
  try {
    const pagesMissingMeta = await query(`
      SELECT id, slug, title_en, title_ar, seo_title_ar, meta_desc_ar, og_image
      FROM pages
      WHERE deleted_at IS NULL AND (seo_title_ar IS NULL OR seo_title_ar = '' OR meta_desc_ar IS NULL OR meta_desc_ar = '')
    `);

    const postsMissingMeta = await query(`
      SELECT id, slug, title_en, title_ar, seo_title_ar, meta_desc_ar, og_image
      FROM blog_posts
      WHERE deleted_at IS NULL AND (seo_title_ar IS NULL OR seo_title_ar = '' OR meta_desc_ar IS NULL OR meta_desc_ar = '')
    `);

    const itemsMissingMeta = await query(`
      SELECT id, slug, name_en, name_ar, seo_title, meta_desc, image_url
      FROM menu_items
      WHERE deleted_at IS NULL AND (seo_title IS NULL OR seo_title = '' OR meta_desc IS NULL OR meta_desc = '')
    `);

    const mediaMissingAlt = await query(`
      SELECT id, original_name, file_path
      FROM media_library
      WHERE alt_text_ar IS NULL OR alt_text_ar = ''
    `);

    res.json({
      success: true,
      data: {
        summary: {
          pagesMissingMetaCount: pagesMissingMeta.length,
          postsMissingMetaCount: postsMissingMeta.length,
          itemsMissingMetaCount: itemsMissingMeta.length,
          mediaMissingAltCount: mediaMissingAlt.length,
          totalIssues: pagesMissingMeta.length + postsMissingMeta.length + itemsMissingMeta.length + mediaMissingAlt.length
        },
        pagesMissingMeta,
        postsMissingMeta,
        itemsMissingMeta,
        mediaMissingAlt
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to fetch SEO overview' });
  }
});

// GET /api/v1/seo/metadata (Unified metadata list for Pages, Blog Posts, and Menu Items)
router.get('/metadata', authenticate, requirePermission('manage_seo'), async (req, res) => {
  try {
    const pages = await query(`
      SELECT id, 'page' as entity_type, slug, title_en as name_en, title_ar as name_ar,
             seo_title_en, seo_title_ar, meta_desc_en, meta_desc_ar, og_image
      FROM pages WHERE deleted_at IS NULL
    `);

    const posts = await query(`
      SELECT id, 'post' as entity_type, slug, title_en as name_en, title_ar as name_ar,
             seo_title_en, seo_title_ar, meta_desc_en, meta_desc_ar, og_image
      FROM blog_posts WHERE deleted_at IS NULL
    `);

    const items = await query(`
      SELECT id, 'menu_item' as entity_type, slug, name_en, name_ar,
             seo_title as seo_title_en, seo_title as seo_title_ar,
             meta_desc as meta_desc_en, meta_desc as meta_desc_ar, image_url as og_image
      FROM menu_items WHERE deleted_at IS NULL
    `);

    res.json({
      success: true,
      data: [...pages, ...posts, ...items]
    });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to fetch metadata list' });
  }
});

// PUT /api/v1/seo/metadata/:entityType/:id (Quick edit metadata)
router.put('/metadata/:entityType/:id', authenticate, requirePermission('manage_seo'), async (req, res) => {
  try {
    const { entityType, id } = req.params;
    const { seo_title_en, seo_title_ar, meta_desc_en, meta_desc_ar, og_image } = req.body;

    if (entityType === 'page') {
      await run(`
        UPDATE pages SET
          seo_title_en = ?, seo_title_ar = ?, meta_desc_en = ?, meta_desc_ar = ?, og_image = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `, [seo_title_en, seo_title_ar, meta_desc_en, meta_desc_ar, og_image, id]);
    } else if (entityType === 'post') {
      await run(`
        UPDATE blog_posts SET
          seo_title_en = ?, seo_title_ar = ?, meta_desc_en = ?, meta_desc_ar = ?, og_image = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `, [seo_title_en, seo_title_ar, meta_desc_en, meta_desc_ar, og_image, id]);
    } else if (entityType === 'menu_item') {
      await run(`
        UPDATE menu_items SET
          seo_title = ?, meta_desc = ?, image_url = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `, [seo_title_ar || seo_title_en, meta_desc_ar || meta_desc_en, og_image, id]);
    } else {
      return res.status(400).json({ success: false, error: 'Invalid entity type' });
    }

    await logAudit(req, 'UPDATE_SEO_METADATA', `Updated metadata for ${entityType} ID ${id}`);
    res.json({ success: true, message: 'Metadata updated successfully' });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to update metadata' });
  }
});

// GET /sitemap.xml (Dynamic Sitemap Generator)
router.get('/sitemap.xml', async (req, res) => {
  try {
    const baseUrl = req.protocol + '://' + req.get('host');

    const pages = await query('SELECT slug, updated_at FROM pages WHERE status = "published" AND deleted_at IS NULL');
    const posts = await query('SELECT slug, updated_at FROM blog_posts WHERE status = "published" AND deleted_at IS NULL');
    const items = await query('SELECT slug, updated_at FROM menu_items WHERE availability_status = "available" AND deleted_at IS NULL');

    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += '<urlset xmlns="http://www.sitemap.org/schemas/sitemap/0.9">\n';

    // Static core pages
    xml += `  <url><loc>${baseUrl}/</loc><priority>1.0</priority><changefreq>daily</changefreq></url>\n`;
    xml += `  <url><loc>${baseUrl}/menu</loc><priority>0.9</priority><changefreq>daily</changefreq></url>\n`;

    for (const p of pages) {
      if (p.slug !== 'home' && p.slug !== 'menu') {
        xml += `  <url><loc>${baseUrl}/${p.slug}</loc><lastmod>${new Date(p.updated_at).toISOString()}</lastmod><priority>0.8</priority></url>\n`;
      }
    }

    for (const post of posts) {
      xml += `  <url><loc>${baseUrl}/blog/${post.slug}</loc><lastmod>${new Date(post.updated_at).toISOString()}</lastmod><priority>0.7</priority></url>\n`;
    }

    xml += '</urlset>';

    res.header('Content-Type', 'application/xml');
    res.send(xml);
  } catch (err) {
    res.status(500).send('Error generating sitemap');
  }
});

// GET /robots.txt
router.get('/robots.txt', async (req, res) => {
  try {
    const settings = await get('SELECT robots_txt FROM website_settings WHERE id = 1');
    const defaultRobots = "User-agent: *\nAllow: /\nDisallow: /admin/\nSitemap: " + req.protocol + '://' + req.get('host') + '/sitemap.xml';
    res.header('Content-Type', 'text/plain');
    res.send(settings?.robots_txt || defaultRobots);
  } catch (err) {
    res.status(500).send('Error loading robots.txt');
  }
});

module.exports = router;
