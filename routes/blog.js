const express = require('express');
const router = express.Router();
const { get, query, run } = require('../db');
const { authenticate, requirePermission, logAudit, logRevision } = require('../middleware/auth');

// GET /api/v1/blog/posts
router.get('/posts', async (req, res) => {
  try {
    const { status, search, category } = req.query;
    let sql = `
      SELECT b.*, u.full_name as author_name
      FROM blog_posts b
      LEFT JOIN users u ON b.author_id = u.id
      WHERE b.deleted_at IS NULL
    `;
    const params = [];

    if (status) {
      sql += ' AND b.status = ?';
      params.push(status);
    } else if (!req.headers.authorization && !req.cookies?.oz_admin_token) {
      sql += ' AND b.status = "published"';
    }

    if (category) {
      sql += ' AND b.category_name = ?';
      params.push(category);
    }

    if (search) {
      sql += ' AND (b.title_en LIKE ? OR b.title_ar LIKE ? OR b.excerpt_en LIKE ? OR b.excerpt_ar LIKE ?)';
      const term = `%${search}%`;
      params.push(term, term, term, term);
    }

    sql += ' ORDER BY b.publish_date DESC, b.id DESC';
    const posts = await query(sql, params);
    res.json({ success: true, data: posts });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to fetch blog posts' });
  }
});

// GET /api/v1/blog/posts/:slug
router.get('/posts/:slug', async (req, res) => {
  try {
    const post = await get(`
      SELECT b.*, u.full_name as author_name
      FROM blog_posts b
      LEFT JOIN users u ON b.author_id = u.id
      WHERE (b.slug = ? OR b.id = ?) AND b.deleted_at IS NULL
    `, [req.params.slug, req.params.slug]);

    if (!post) {
      return res.status(404).json({ success: false, error: 'Blog post not found' });
    }

    res.json({ success: true, data: post });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to fetch blog post' });
  }
});

// POST /api/v1/blog/posts
router.post('/posts', authenticate, requirePermission('manage_blog'), async (req, res) => {
  try {
    const {
      title_en, title_ar, slug, excerpt_en, excerpt_ar, content_en, content_ar,
      featured_image, category_name, tags, status, publish_date,
      seo_title_en, seo_title_ar, meta_desc_en, meta_desc_ar, canonical_url, og_image, index_control
    } = req.body;

    if (!title_en || !title_ar) {
      return res.status(400).json({ success: false, error: 'Post title in English and Arabic is required' });
    }

    const cleanSlug = (slug || title_en).toLowerCase().replace(/[^a-z0-9-]/g, '-') + '-' + Date.now().toString().slice(-4);

    const result = await run(`
      INSERT INTO blog_posts (
        title_en, title_ar, slug, excerpt_en, excerpt_ar, content_en, content_ar,
        featured_image, author_id, category_name, tags, status, publish_date,
        seo_title_en, seo_title_ar, meta_desc_en, meta_desc_ar, canonical_url, og_image, index_control
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      title_en, title_ar, cleanSlug, excerpt_en || '', excerpt_ar || '',
      content_en || '', content_ar || '', featured_image || 'assets/images/coffee.jpg',
      req.user.id, category_name || 'General', typeof tags === 'object' ? JSON.stringify(tags) : (tags || '[]'),
      status || 'published', publish_date || new Date().toISOString(),
      seo_title_en || title_en, seo_title_ar || title_ar,
      meta_desc_en || excerpt_en || '', meta_desc_ar || excerpt_ar || '',
      canonical_url || '', og_image || featured_image || '', index_control || 'index'
    ]);

    await logAudit(req, 'CREATE_BLOG_POST', `Created post '${title_en}'`);
    await logRevision('blog_post', result.id, 'CREATE', null, req.body, req.user.id);

    res.json({ success: true, message: 'Blog post created successfully', id: result.id, slug: cleanSlug });
  } catch (err) {
    console.error('Create blog post error:', err);
    res.status(500).json({ success: false, error: 'Failed to create blog post' });
  }
});

// PUT /api/v1/blog/posts/:id
router.put('/posts/:id', authenticate, requirePermission('manage_blog'), async (req, res) => {
  try {
    const post = await get('SELECT * FROM blog_posts WHERE id = ? AND deleted_at IS NULL', [req.params.id]);
    if (!post) {
      return res.status(404).json({ success: false, error: 'Blog post not found' });
    }

    const {
      title_en, title_ar, excerpt_en, excerpt_ar, content_en, content_ar,
      featured_image, category_name, tags, status, publish_date,
      seo_title_en, seo_title_ar, meta_desc_en, meta_desc_ar, canonical_url, og_image, index_control
    } = req.body;

    await run(`
      UPDATE blog_posts SET
        title_en = ?, title_ar = ?, excerpt_en = ?, excerpt_ar = ?, content_en = ?, content_ar = ?,
        featured_image = ?, category_name = ?, tags = ?, status = ?, publish_date = ?,
        seo_title_en = ?, seo_title_ar = ?, meta_desc_en = ?, meta_desc_ar = ?,
        canonical_url = ?, og_image = ?, index_control = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [
      title_en || post.title_en,
      title_ar || post.title_ar,
      excerpt_en !== undefined ? excerpt_en : post.excerpt_en,
      excerpt_ar !== undefined ? excerpt_ar : post.excerpt_ar,
      content_en !== undefined ? content_en : post.content_en,
      content_ar !== undefined ? content_ar : post.content_ar,
      featured_image !== undefined ? featured_image : post.featured_image,
      category_name !== undefined ? category_name : post.category_name,
      tags !== undefined ? (typeof tags === 'object' ? JSON.stringify(tags) : tags) : post.tags,
      status !== undefined ? status : post.status,
      publish_date !== undefined ? publish_date : post.publish_date,
      seo_title_en !== undefined ? seo_title_en : post.seo_title_en,
      seo_title_ar !== undefined ? seo_title_ar : post.seo_title_ar,
      meta_desc_en !== undefined ? meta_desc_en : post.meta_desc_en,
      meta_desc_ar !== undefined ? meta_desc_ar : post.meta_desc_ar,
      canonical_url !== undefined ? canonical_url : post.canonical_url,
      og_image !== undefined ? og_image : post.og_image,
      index_control !== undefined ? index_control : post.index_control,
      post.id
    ]);

    await logAudit(req, 'UPDATE_BLOG_POST', `Updated post '${post.title_en}'`);
    await logRevision('blog_post', post.id, 'UPDATE', post, req.body, req.user.id);

    res.json({ success: true, message: 'Blog post updated successfully' });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to update blog post' });
  }
});

// DELETE /api/v1/blog/posts/:id (Soft Delete)
router.delete('/posts/:id', authenticate, requirePermission('manage_blog'), async (req, res) => {
  try {
    await run('UPDATE blog_posts SET deleted_at = CURRENT_TIMESTAMP WHERE id = ?', [req.params.id]);
    await logAudit(req, 'DELETE_BLOG_POST', `Deleted post ID ${req.params.id}`);
    res.json({ success: true, message: 'Blog post moved to trash' });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to delete blog post' });
  }
});

module.exports = router;
