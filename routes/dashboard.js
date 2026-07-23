const express = require('express');
const router = express.Router();
const { get, query } = require('../db');
const { authenticate, requirePermission } = require('../middleware/auth');

// GET /api/v1/dashboard/stats
router.get('/stats', authenticate, requirePermission('view_dashboard'), async (req, res) => {
  try {
    const totalPages = await get('SELECT COUNT(*) as count FROM pages WHERE deleted_at IS NULL');
    const publishedPages = await get('SELECT COUNT(*) as count FROM pages WHERE status = "published" AND deleted_at IS NULL');
    const draftPages = await get('SELECT COUNT(*) as count FROM pages WHERE status = "draft" AND deleted_at IS NULL');

    const totalMenuItems = await get('SELECT COUNT(*) as count FROM menu_items WHERE deleted_at IS NULL');
    const activeMenuItems = await get('SELECT COUNT(*) as count FROM menu_items WHERE availability_status = "available" AND deleted_at IS NULL');
    const hiddenMenuItems = await get('SELECT COUNT(*) as count FROM menu_items WHERE availability_status = "unavailable" AND deleted_at IS NULL');
    const totalCategories = await get('SELECT COUNT(*) as count FROM menu_categories');

    const totalBlogPosts = await get('SELECT COUNT(*) as count FROM blog_posts WHERE deleted_at IS NULL');
    const publishedBlogPosts = await get('SELECT COUNT(*) as count FROM blog_posts WHERE status = "published" AND deleted_at IS NULL');
    const draftBlogPosts = await get('SELECT COUNT(*) as count FROM blog_posts WHERE status = "draft" AND deleted_at IS NULL');

    const totalMedia = await get('SELECT COUNT(*) as count FROM media_library');
    const totalUsers = await get('SELECT COUNT(*) as count FROM users');

    const recentPages = await query('SELECT id, slug, title_en, title_ar, status, updated_at FROM pages WHERE deleted_at IS NULL ORDER BY updated_at DESC LIMIT 5');
    const recentMenuItems = await query(`
      SELECT m.id, m.name_en, m.name_ar, m.price, m.availability_status, c.name_ar as category_name
      FROM menu_items m
      LEFT JOIN menu_categories c ON m.category_id = c.id
      WHERE m.deleted_at IS NULL
      ORDER BY m.updated_at DESC LIMIT 5
    `);
    const recentBlogPosts = await query('SELECT id, slug, title_en, title_ar, status, publish_date FROM blog_posts WHERE deleted_at IS NULL ORDER BY created_at DESC LIMIT 5');
    const recentActivity = await query('SELECT user_email, action, details, created_at FROM audit_logs ORDER BY created_at DESC LIMIT 8');

    // Calculate SEO Warnings from real DB data
    const missingSeoPages = await get('SELECT COUNT(*) as count FROM pages WHERE (seo_title_ar IS NULL OR seo_title_ar = "" OR meta_desc_ar IS NULL OR meta_desc_ar = "") AND deleted_at IS NULL');
    const missingSeoPosts = await get('SELECT COUNT(*) as count FROM blog_posts WHERE (seo_title_ar IS NULL OR seo_title_ar = "" OR meta_desc_ar IS NULL OR meta_desc_ar = "") AND deleted_at IS NULL');
    const missingSeoItems = await get('SELECT COUNT(*) as count FROM menu_items WHERE (seo_title IS NULL OR seo_title = "" OR meta_desc IS NULL OR meta_desc = "") AND deleted_at IS NULL');
    const missingAltMedia = await get('SELECT COUNT(*) as count FROM media_library WHERE (alt_text_ar IS NULL OR alt_text_ar = "")');

    res.json({
      success: true,
      data: {
        pages: {
          total: totalPages.count,
          published: publishedPages.count,
          draft: draftPages.count
        },
        menu: {
          total: totalMenuItems.count,
          active: activeMenuItems.count,
          hidden: hiddenMenuItems.count,
          categories: totalCategories.count
        },
        blog: {
          total: totalBlogPosts.count,
          published: publishedBlogPosts.count,
          draft: draftBlogPosts.count
        },
        media: {
          total: totalMedia.count
        },
        users: {
          total: totalUsers.count
        },
        seoIssues: {
          missingPages: missingSeoPages.count,
          missingPosts: missingSeoPosts.count,
          missingItems: missingSeoItems.count,
          missingAltMedia: missingAltMedia.count,
          totalIssues: missingSeoPages.count + missingSeoPosts.count + missingSeoItems.count + missingAltMedia.count
        },
        recentPages,
        recentMenuItems,
        recentBlogPosts,
        recentActivity
      }
    });
  } catch (err) {
    console.error('Dashboard stats error:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch dashboard statistics' });
  }
});

module.exports = router;
