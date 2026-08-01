const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');

const dbDir = path.join(__dirname, 'data');
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const dbPath = path.join(dbDir, 'oz_park_cafe.db');
const db = new sqlite3.Database(dbPath);

const query = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
};

const get = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
};

const run = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve({ id: this.lastID, changes: this.changes });
    });
  });
};

async function initDb() {
  await run('PRAGMA foreign_keys = ON;');

  await run(`
    CREATE TABLE IF NOT EXISTS roles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      description TEXT,
      permissions TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      full_name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      phone TEXT,
      profile_image TEXT,
      role_id INTEGER NOT NULL,
      status TEXT DEFAULT 'active',
      preferred_lang TEXT DEFAULT 'ar',
      last_login_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (role_id) REFERENCES roles(id)
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS pages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slug TEXT UNIQUE NOT NULL,
      title_en TEXT NOT NULL,
      title_ar TEXT NOT NULL,
      template TEXT DEFAULT 'default',
      status TEXT DEFAULT 'published',
      publish_date DATETIME DEFAULT CURRENT_TIMESTAMP,
      seo_title_en TEXT,
      seo_title_ar TEXT,
      meta_desc_en TEXT,
      meta_desc_ar TEXT,
      og_image TEXT,
      is_in_nav INTEGER DEFAULT 1,
      display_order INTEGER DEFAULT 0,
      created_by INTEGER,
      updated_by INTEGER,
      deleted_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS page_sections (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      page_id INTEGER NOT NULL,
      section_key TEXT NOT NULL,
      title_en TEXT,
      title_ar TEXT,
      subtitle_en TEXT,
      subtitle_ar TEXT,
      content_en TEXT,
      content_ar TEXT,
      media_url TEXT,
      settings TEXT,
      display_order INTEGER DEFAULT 0,
      is_visible INTEGER DEFAULT 1,
      FOREIGN KEY (page_id) REFERENCES pages(id) ON DELETE CASCADE
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS menu_categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name_en TEXT NOT NULL,
      name_ar TEXT NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      description_en TEXT,
      description_ar TEXT,
      image_url TEXT,
      icon TEXT,
      display_order INTEGER DEFAULT 0,
      status TEXT DEFAULT 'active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS menu_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category_id INTEGER NOT NULL,
      name_en TEXT NOT NULL,
      name_ar TEXT NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      description_en TEXT,
      description_ar TEXT,
      price REAL NOT NULL,
      discount_price REAL,
      image_url TEXT,
      gallery TEXT,
      ingredients_en TEXT,
      ingredients_ar TEXT,
      allergens TEXT,
      calories INTEGER,
      is_hot INTEGER DEFAULT 0,
      is_cold INTEGER DEFAULT 0,
      is_featured INTEGER DEFAULT 0,
      is_new INTEGER DEFAULT 0,
      is_bestseller INTEGER DEFAULT 0,
      is_seasonal INTEGER DEFAULT 0,
      availability_status TEXT DEFAULT 'available',
      display_order INTEGER DEFAULT 0,
      seo_title TEXT,
      meta_desc TEXT,
      deleted_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (category_id) REFERENCES menu_categories(id)
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS menu_item_sizes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      menu_item_id INTEGER NOT NULL,
      size_en TEXT NOT NULL,
      size_ar TEXT NOT NULL,
      price REAL NOT NULL,
      is_default INTEGER DEFAULT 0,
      FOREIGN KEY (menu_item_id) REFERENCES menu_items(id) ON DELETE CASCADE
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS offers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title_en TEXT NOT NULL,
      title_ar TEXT NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      description_en TEXT,
      description_ar TEXT,
      image_url TEXT,
      original_price REAL,
      offer_price REAL,
      start_date DATETIME,
      end_date DATETIME,
      terms_en TEXT,
      terms_ar TEXT,
      cta_text_en TEXT,
      cta_text_ar TEXT,
      cta_link TEXT,
      is_featured INTEGER DEFAULT 0,
      status TEXT DEFAULT 'active',
      display_order INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS blog_posts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title_en TEXT NOT NULL,
      title_ar TEXT NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      excerpt_en TEXT,
      excerpt_ar TEXT,
      content_en TEXT,
      content_ar TEXT,
      featured_image TEXT,
      author_id INTEGER,
      category_name TEXT,
      tags TEXT,
      status TEXT DEFAULT 'published',
      publish_date DATETIME DEFAULT CURRENT_TIMESTAMP,
      seo_title_en TEXT,
      seo_title_ar TEXT,
      meta_desc_en TEXT,
      meta_desc_ar TEXT,
      canonical_url TEXT,
      og_image TEXT,
      index_control TEXT DEFAULT 'index',
      deleted_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (author_id) REFERENCES users(id)
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS media_library (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      file_name TEXT NOT NULL,
      original_name TEXT NOT NULL,
      file_path TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      file_size INTEGER NOT NULL,
      width INTEGER,
      height INTEGER,
      alt_text_en TEXT,
      alt_text_ar TEXT,
      caption_en TEXT,
      caption_ar TEXT,
      uploaded_by INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (uploaded_by) REFERENCES users(id)
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS gallery (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title_en TEXT,
      title_ar TEXT,
      category TEXT NOT NULL,
      image_url TEXT NOT NULL,
      caption_en TEXT,
      caption_ar TEXT,
      alt_text_en TEXT,
      alt_text_ar TEXT,
      is_featured INTEGER DEFAULT 0,
      is_hidden INTEGER DEFAULT 0,
      display_order INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS navigation (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      menu_location TEXT NOT NULL,
      label_en TEXT NOT NULL,
      label_ar TEXT NOT NULL,
      link_url TEXT NOT NULL,
      target_blank INTEGER DEFAULT 0,
      parent_id INTEGER DEFAULT NULL,
      display_order INTEGER DEFAULT 0,
      is_active INTEGER DEFAULT 1
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS cafe_info (
      id INTEGER PRIMARY KEY DEFAULT 1,
      name_en TEXT NOT NULL,
      name_ar TEXT NOT NULL,
      short_desc_en TEXT,
      short_desc_ar TEXT,
      full_desc_en TEXT,
      full_desc_ar TEXT,
      phone TEXT,
      whatsapp TEXT,
      email TEXT,
      address_en TEXT,
      address_ar TEXT,
      google_maps_url TEXT,
      latitude REAL,
      longitude REAL,
      opening_hours_en TEXT,
      opening_hours_ar TEXT,
      social_links TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS website_settings (
      id INTEGER PRIMARY KEY DEFAULT 1,
      site_name_en TEXT NOT NULL,
      site_name_ar TEXT NOT NULL,
      main_logo TEXT,
      alt_logo TEXT,
      favicon TEXT,
      default_lang TEXT DEFAULT 'ar',
      currency_en TEXT DEFAULT 'SAR',
      currency_ar TEXT DEFAULT 'ر.س',
      integrations TEXT,
      brand_colors TEXT,
      robots_txt TEXT,
      sitemap_enabled INTEGER DEFAULT 1,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS revisions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      entity_type TEXT NOT NULL,
      entity_id INTEGER NOT NULL,
      change_type TEXT NOT NULL,
      data_before TEXT,
      data_after TEXT,
      changed_by INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (changed_by) REFERENCES users(id)
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      user_email TEXT,
      action TEXT NOT NULL,
      details TEXT,
      ip_address TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  try {
    const items = await query('SELECT id, image_url FROM menu_items');
    for (const i of items) {
      if (i.image_url && !i.image_url.startsWith('/') && !i.image_url.startsWith('http')) {
        await run('UPDATE menu_items SET image_url = ? WHERE id = ?', ['/' + i.image_url, i.id]);
      }
    }
  } catch (e) {}

  await seedData();
  try {
    await run("UPDATE menu_items SET image_url = '' WHERE image_url LIKE '%assets/images%' OR image_url IS NULL");
  } catch (e) {}
}

async function seedData() {
  // 1. Roles
  const roleCount = await get('SELECT COUNT(*) as count FROM roles');
  if (roleCount.count === 0) {
    const defaultRoles = [
      { name: 'Super Admin', slug: 'super_admin', description: 'Full access to all features.', permissions: JSON.stringify(['*']) },
      { name: 'Administrator', slug: 'administrator', description: 'Manage pages, menu, offers, blog, media, and staff.', permissions: JSON.stringify(['view_dashboard', 'manage_pages', 'manage_menu', 'manage_offers', 'manage_blog', 'manage_seo', 'manage_media', 'manage_gallery', 'manage_users', 'manage_settings']) },
      { name: 'Content Editor', slug: 'content_editor', description: 'Manage content and media.', permissions: JSON.stringify(['view_dashboard', 'manage_pages', 'manage_offers', 'manage_blog', 'manage_media', 'manage_gallery']) },
      { name: 'Menu Manager', slug: 'menu_manager', description: 'Manage menu items and pricing.', permissions: JSON.stringify(['view_dashboard', 'manage_menu', 'manage_media']) },
      { name: 'SEO Manager', slug: 'seo_manager', description: 'Manage SEO titles and metadata.', permissions: JSON.stringify(['view_dashboard', 'manage_seo', 'manage_blog']) },
      { name: 'Viewer', slug: 'viewer', description: 'Read-only access.', permissions: JSON.stringify(['view_dashboard']) }
    ];

    for (const r of defaultRoles) {
      await run('INSERT INTO roles (name, slug, description, permissions) VALUES (?, ?, ?, ?)', [r.name, r.slug, r.description, r.permissions]);
    }
  }

  // 2. Users
  const userCount = await get('SELECT COUNT(*) as count FROM users');
  if (userCount.count === 0) {
    const superAdminRole = await get('SELECT id FROM roles WHERE slug = "super_admin"');
    const passwordHash = bcrypt.hashSync('admin123', 10);
    await run(`
      INSERT INTO users (full_name, email, password_hash, phone, role_id, status, preferred_lang)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, ['OZ Park Super Admin', 'admin@ozparkcafe.com', passwordHash, '+966500000000', superAdminRole.id, 'active', 'ar']);
  }

  // 3. Categories (Matching site filters: hot, cold, juice, addons)
  const catCount = await get('SELECT COUNT(*) as count FROM menu_categories');
  if (catCount.count === 0) {
    const categories = [
      { name_en: 'Hot Drinks', name_ar: 'المشروبات الساخنة', slug: 'hot', icon: '☕', order: 1 },
      { name_en: 'Cold Drinks', name_ar: 'المشروبات الباردة', slug: 'cold', icon: '🥤', order: 2 },
      { name_en: 'Fresh Juices & Smoothies', name_ar: 'العصائر الطازجة والسموذي', slug: 'juice', icon: '🍹', order: 3 },
      { name_en: 'Add-ons & Flavors', name_ar: 'الإضافات والنكهات', slug: 'addons', icon: '✨', order: 4 }
    ];

    for (const c of categories) {
      await run(`
        INSERT INTO menu_categories (name_en, name_ar, slug, icon, display_order)
        VALUES (?, ?, ?, ?, ?)
      `, [c.name_en, c.name_ar, c.slug, c.icon, c.order]);
    }
  }

  // 4. Load ALL extracted menu items from JSON file
  const itemCount = await get('SELECT COUNT(*) as count FROM menu_items');
  if (itemCount.count === 0) {
    const categories = await query('SELECT id, slug FROM menu_categories');
    const catMap = {};
    categories.forEach(c => catMap[c.slug] = c.id);

    let extractedItems = [];
    const jsonPath = path.join(__dirname, 'scratch/extracted_menu_items.json');
    if (fs.existsSync(jsonPath)) {
      extractedItems = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
    }

    for (const item of extractedItems) {
      const catId = catMap[item.category_slug] || catMap['hot'];
      const slug = item.name_en.toLowerCase().replace(/[^a-z0-9-]/g, '-') + '-' + Math.floor(Math.random()*1000);
      const isHot = item.category_slug === 'hot' ? 1 : 0;
      const isCold = item.category_slug === 'cold' || item.category_slug === 'juice' ? 1 : 0;
      const isFeatured = ['Spanish Latte', 'Café Latte', 'Iced Spanish Latte', 'Oreo Frappuccino', 'Avocado with Honey', 'V60 Pour Over'].includes(item.name_en) ? 1 : 0;
      const imagePath = '';

      await run(`
        INSERT INTO menu_items (
          category_id, name_en, name_ar, slug, description_en, description_ar,
          price, image_url, calories, is_hot, is_cold, is_featured
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        catId, item.name_en, item.name_ar, slug, item.description_en, item.description_ar,
        item.price, imagePath, item.calories, isHot, isCold, isFeatured
      ]);
    }
  }

  // 5. Seed Media Library Assets
  const mediaCount = await get('SELECT COUNT(*) as count FROM media_library');
  if (mediaCount.count === 0) {
    const adminUser = await get('SELECT id FROM users WHERE email = "admin@ozparkcafe.com"');
    const initialMedia = [
      { name: 'hero-seaview.jpg', path: '/assets/images/hero-seaview.jpg', alt_ar: 'إطلالة بحرية بانورامية فندق أوز بارك', alt_en: 'Panoramic Sea View Lounge' },
      { name: 'coffee.jpg', path: '/assets/images/coffee.jpg', alt_ar: 'مشروبات قهوة مختصة ساخنة وباردة', alt_en: 'Specialty Coffee Beverage' },
      { name: 'fresh-juice.jpg', path: '/assets/images/fresh-juice.jpg', alt_ar: 'عصائر وموكتيل فواكه استوائية طازجة', alt_en: 'Fresh Tropical Juices' },
      { name: 'dessert.jpg', path: '/assets/images/dessert.jpg', alt_ar: 'حلويات كيك ومخبوزات راقية', alt_en: 'Fine Pastries and Desserts' },
      { name: 'lounge.jpg', path: '/assets/images/lounge.jpg', alt_ar: 'جلسات مقهى أوز بارك الداخلي الأنيق', alt_en: 'OZ Park Cafe Interior Lounge' },
      { name: 'about-us.jpg', path: '/assets/images/about-us.jpg', alt_ar: 'من نحن - مقهى أوز بارك', alt_en: 'About OZ Park Cafe' }
    ];

    for (const m of initialMedia) {
      await run(`
        INSERT INTO media_library (file_name, original_name, file_path, mime_type, file_size, alt_text_ar, alt_text_en, uploaded_by)
        VALUES (?, ?, ?, 'image/jpeg', 500000, ?, ?, ?)
      `, [m.name, m.name, m.path, m.alt_ar, m.alt_en, adminUser ? adminUser.id : 1]);
    }
  }

  // 6. Seed Pages & Sections
  const pageCount = await get('SELECT COUNT(*) as count FROM pages');
  if (pageCount.count === 0) {
    const pages = [
      { slug: 'home', title_en: 'Home Page', title_ar: 'الصفحة الرئيسية', seo_en: 'OZ Park Café - Luxury Sea-view Coffee Lounge in Al Qunfudhah', seo_ar: 'أوز بارك كافيه - تجربة قهوة فاخرة على البحر بالقنفذة', desc_en: 'Experience premium coffee, fresh juices, fine bakery and desserts with panoramic sea views at OZ Park Cafe inside 5-star hotel in Al Qunfudhah.', desc_ar: 'مقهى أوز بارك كافيه في فندق 5 نجوم بالقنفذة - إطلالة بانورامية على البحر، قهوة فاخرة، عصائر طازجة، وحلويات راقية.' },
      { slug: 'menu', title_en: 'Café Menu Page', title_ar: 'صفحة قائمة المأكولات والمشروبات', seo_en: 'OZ Park Café Full Menu - Premium Coffee & Beverages', seo_ar: 'قائمة المأكولات والمشروبات - أوز بارك كافيه', desc_en: 'Explore the complete beverage and dessert menu of OZ Park Cafe inside 5-star hotel in Al Qunfudhah.', desc_ar: 'استكشف القائمة الكاملة للمشروبات الساخنة والباردة والحلويات في مقهى أوز بارك كافيه بالقنفذة.' },
      { slug: 'about', title_en: 'About Us', title_ar: 'عن أوز بارك كافيه', seo_en: 'About OZ Park Café - 5-Star Hotel Coffee Lounge', seo_ar: 'عن أوز بارك كافيه - مقهى فندق 5 نجوم بالقنفذة', desc_en: 'Discover the story, craft, and sea view experience of OZ Park Cafe.', desc_ar: 'تعرف على قصة أوز بارك كافيه، شغف القهوة، والإطلالة البانورامية الساحرة.' },
      { slug: 'offers', title_en: 'Offers & Special Promotions', title_ar: 'العروض والعروض الترويجية', seo_en: 'Special Offers & Packages - OZ Park Café', seo_ar: 'عروض وتخفيضات أوز بارك كافيه', desc_en: 'Check out current offers, morning coffee combos, and dessert bundles.', desc_ar: 'اطلع على أحدث العروض الحصرية وباقات القهوة والحلويات من أوز بارك كافيه.' },
      { slug: 'blog', title_en: 'Café Blog & Stories', title_ar: 'المدونة وحكايات القهوة', seo_en: 'Coffee Journal & News - OZ Park Café', seo_ar: 'مدونة أوز بارك كافيه - مقالات وحكايات القهوة', desc_en: 'Read articles about specialty coffee beans, brewing methods, and luxury lounge experiences.', desc_ar: 'اقرأ مقالات عن محاصيل القهوة المختصة، أساليب التحضير، وتجارب الضيافة الفاخرة.' },
      { slug: 'contact', title_en: 'Contact & Location', title_ar: 'تواصل معنا والموقع', seo_en: 'Contact & Location - OZ Park Café Al Qunfudhah', seo_ar: 'تواصل معنا والموقع - أوز بارك كافيه بالقنفذة', desc_en: 'Visit OZ Park Cafe at 5-star Hotel Corniche Road Al Qunfudhah.', desc_ar: 'تفضل بزيارة مقهى أوز بارك كافيه بفندق 5 نجوم على كورنيش القنفذة.' }
    ];

    for (const p of pages) {
      const pageRes = await run(`
        INSERT INTO pages (slug, title_en, title_ar, seo_title_en, seo_title_ar, meta_desc_en, meta_desc_ar)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `, [p.slug, p.title_en, p.title_ar, p.seo_en, p.seo_ar, p.desc_en, p.desc_ar]);

      if (p.slug === 'home') {
        await run(`
          INSERT INTO page_sections (page_id, section_key, title_en, title_ar, subtitle_en, subtitle_ar, content_en, content_ar, media_url)
          VALUES (?, 'hero', ?, ?, ?, ?, ?, ?, ?)
        `, [
          pageRes.id,
          'Coffee with a Panoramic Sea View',
          'قهوة بإطلالة بانورامية على البحر',
          '5-Star Hotel • Panoramic Sea View',
          'فندق 5 نجوم • إطلالة بحرية بانورامية',
          'Experience a refined coffee lounge inside a 5-star hotel in Al Qunfudhah. Enjoy handcrafted specialty coffee, fresh juices, bakery selections, and desserts with a beautiful view of the sea.',
          'استمتع بتجربة مقهى راقية داخل فندق 5 نجوم في القنفذة. نقدم مشروبات قهوة مختارة وعصائر طازجة ومخبوزات وحلويات لذيذة في أجواء بحرية هادئة وراقية تناسب العائلات والزوار ورجال الأعمال.',
          'assets/images/hero-seaview.jpg'
        ]);
      }
    }
  }

  // 7. Seed Cafe Info
  const infoCount = await get('SELECT COUNT(*) as count FROM cafe_info');
  if (infoCount.count === 0) {
    const socialLinks = JSON.stringify({
      instagram: 'https://instagram.com/ozparkcafe',
      tiktok: 'https://tiktok.com/@ozparkcafe',
      snapchat: 'https://snapchat.com/add/ozparkcafe',
      facebook: 'https://facebook.com/ozparkcafe',
      x: 'https://x.com/ozparkcafe'
    });

    await run(`
      INSERT INTO cafe_info (
        id, name_en, name_ar, short_desc_en, short_desc_ar, full_desc_en, full_desc_ar,
        phone, whatsapp, email, address_en, address_ar, google_maps_url, latitude, longitude,
        opening_hours_en, opening_hours_ar, social_links
      ) VALUES (
        1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
      )
    `, [
      'OZ Park Café',
      'أوز بارك كافيه',
      'Luxury Sea-view Coffee Lounge inside 5-star Hotel',
      'مقهى فاخر بإطلالة بانورامية على البحر في فندق 5 نجوم',
      'OZ Park Café offers a sophisticated sanctuary where handcrafted specialty coffee, fine pastries, and panoramic Red Sea views come together in perfect harmony.',
      'يقدم أوز بارك كافيه تجربة ضيافة ساحلية استثنائية يندمج فيها عبق القهوة المختصة مع الحلويات الراقية والإطلالة البانورامية الساحرة على البحر الأحمر.',
      '+966 50 123 4567',
      '+966 55 022 2986',
      'info@ozparkcafe.com',
      'OZ Park Hotel 5-Star, Corniche Road, Al Qunfudhah, Saudi Arabia',
      'فندق أوز بارك 5 نجوم، طريق الكورنيش، القنفذة، المملكة العربية السعودية',
      'https://maps.google.com/?q=19.1287,40.4851',
      19.1287,
      40.4851,
      'Daily: 6:00 AM - 1:00 AM',
      'يومياً: 06:00 صباحاً - 01:00 صباحاً',
      socialLinks
    ]);
  }

  // 8. Seed Website Settings
  const settingsCount = await get('SELECT COUNT(*) as count FROM website_settings');
  if (settingsCount.count === 0) {
    const brandColors = JSON.stringify({
      navy: '#1B365D',
      navyDark: '#0D1E36',
      gold: '#C5A059',
      goldLight: '#E5CFA3',
      cream: '#FAF7F2',
      charcoal: '#2A2D34'
    });

    const integrations = JSON.stringify({
      googleAnalyticsId: 'G-OZPARKCAFE',
      googleTagManagerId: 'GTM-OZPARK',
      metaPixelId: '',
      tiktokPixelId: ''
    });

    await run(`
      INSERT INTO website_settings (
        id, site_name_en, site_name_ar, default_lang, currency_en, currency_ar,
        integrations, brand_colors, robots_txt, sitemap_enabled
      ) VALUES (
        1, ?, ?, ?, ?, ?, ?, ?, ?, ?
      )
    `, [
      'OZ Park Café',
      'أوز بارك كافيه',
      'ar',
      'SAR',
      'ر.س',
      integrations,
      brandColors,
      "User-agent: *\nAllow: /\nDisallow: /admin/\nSitemap: https://ozparkcafe.com/sitemap.xml",
      1
    ]);
  }

  // 9. Seed Offers
  const offerCount = await get('SELECT COUNT(*) as count FROM offers');
  if (offerCount.count === 0) {
    await run(`
      INSERT INTO offers (
        title_en, title_ar, slug, description_en, description_ar, image_url,
        original_price, offer_price, cta_text_en, cta_text_ar, is_featured, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      'Morning Sunrise Coffee & Croissant',
      'عرض إشراقة الصباح: قهوة + كرواسون',
      'morning-sunrise-combo',
      'Enjoy any Hot Coffee of your choice with a fresh French butter croissant between 6 AM and 11 AM.',
      'استمتع بأي مشروب قهوة ساخنة من اختيارك مع كرواسون الزبدة الفرنسي الفاخر يومياً من 6 صباحاً حتى 11 صباحاً.',
      'assets/images/coffee.jpg',
      33.0,
      25.0,
      'Order Offer',
      'اطلب العرض الآن',
      1,
      'active'
    ]);
  }

  // 10. Seed Blog Posts
  const blogCount = await get('SELECT COUNT(*) as count FROM blog_posts');
  if (blogCount.count === 0) {
    const adminUser = await get('SELECT id FROM users WHERE email = "admin@ozparkcafe.com"');
    await run(`
      INSERT INTO blog_posts (
        title_en, title_ar, slug, excerpt_en, excerpt_ar, content_en, content_ar,
        featured_image, author_id, category_name, tags, status, seo_title_en, seo_title_ar, meta_desc_en, meta_desc_ar
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      'The Art of Specialty Coffee Brewing with Red Sea Views',
      'فن تحضير القهوة المختصة مع إطلالة البحر الأحمر',
      'art-of-specialty-coffee',
      'Discover how bean selection, water mineral balance, and exact temperature create the ultimate cup at OZ Park Café.',
      'تعرف على الأسرار الكامنة وراء اختيار المحاصيل وتوازن المعادن واستخلاص الإسبريسو المثالي في أوز بارك كافيه.',
      '<h2>Specialty Coffee at Al Qunfudhah Coastal Lounge</h2><p>At OZ Park Café, every cup of V60 and Espresso is crafted from single-origin beans sourced from high-altitude Ethiopian and Colombian farms.</p>',
      '<h2>القهوة المختصة في مقهى أوز بارك الساحلي</h2><p>في أوز بارك كافيه، نحرص على انتقاء أجود المحاصيل من مزارع إثيوبيا وكولومبيا وتوفير استخلاص دقيق يمنحك تجربة تذوق لا تُنسى أمام زرقة البحر.</p>',
      'assets/images/coffee.jpg',
      adminUser ? adminUser.id : 1,
      'Coffee Craft',
      JSON.stringify(['Specialty Coffee', 'V60', 'Red Sea Lounge']),
      'published',
      'The Art of Specialty Coffee | OZ Park Café Journal',
      'فن تحضير القهوة المختصة | مدونة أوز بارك كافيه',
      'Discover specialty coffee brewing methods and single-origin beans at OZ Park Cafe inside 5-star hotel.',
      'تعرف على أساليب تحضير القهوة المختصة في مقهى أوز بارك كافيه بالقنفذة.'
    ]);
  }

  // 11. Seed Navigation
  const navCount = await get('SELECT COUNT(*) as count FROM navigation');
  if (navCount.count === 0) {
    const navItems = [
      { loc: 'header', en: 'Home', ar: 'الرئيسية', url: '/#home', order: 1 },
      { loc: 'header', en: 'Menu', ar: 'القائمة', url: '/menu', order: 2 },
      { loc: 'header', en: 'About Us', ar: 'من نحن', url: '/#about', order: 3 },
      { loc: 'header', en: 'Why Choose Us', ar: 'لماذا تختارنا', url: '/#why-choose-us', order: 4 },
      { loc: 'header', en: 'Offers', ar: 'العروض', url: '/offers', order: 5 },
      { loc: 'header', en: 'Blog', ar: 'المدونة', url: '/blog', order: 6 },
      { loc: 'header', en: 'Contact', ar: 'تواصل معنا', url: '/#contact', order: 7 }
    ];

    for (const n of navItems) {
      await run(`
        INSERT INTO navigation (menu_location, label_en, label_ar, link_url, display_order)
        VALUES (?, ?, ?, ?, ?)
      `, [n.loc, n.en, n.ar, n.url, n.order]);
    }
  }

  // 12. Seed Gallery
  const galCount = await get('SELECT COUNT(*) as count FROM gallery');
  if (galCount.count === 0) {
    const items = [
      { title_en: 'Panoramic Sea View Lounge', title_ar: 'جلسات بانورامية مطلة على البحر', category: 'Sea View', img: 'assets/images/hero-seaview.jpg' },
      { title_en: 'Handcrafted Specialty Latte', title_ar: 'لاتيه مختص محضّر بشغف', category: 'Coffee', img: 'assets/images/coffee.jpg' },
      { title_en: 'Fresh Tropical Mocktails', title_ar: 'موكتيل الفواكه الاستوائية الطازجة', category: 'Drinks', img: 'assets/images/fresh-juice.jpg' },
      { title_en: 'Saffron Cake & Fine Pastries', title_ar: 'كيكة الزعفران والحلويات الراقية', category: 'Desserts', img: 'assets/images/dessert.jpg' },
      { title_en: 'Luxury 5-Star Hotel Interior', title_ar: 'التصميم الداخلي الأنيق بفندق 5 نجوم', category: 'Interior', img: 'assets/images/lounge.jpg' }
    ];

    for (const g of items) {
      await run(`
        INSERT INTO gallery (title_en, title_ar, category, image_url, is_featured)
        VALUES (?, ?, ?, ?, 1)
      `, [g.title_en, g.title_ar, g.category, g.img]);
    }
  }

  // Cleanup any legacy or missing image upload paths from database
  await run(`
    UPDATE menu_items 
    SET image_url = NULL 
    WHERE image_url IS NOT NULL 
    AND (
      image_url LIKE '%ChatGPT_Image%' 
      OR image_url LIKE '%placeholder%'
    );
  `);

  console.log('[Database] Seeded all 51 extracted menu items cleanly!');
}

module.exports = {
  db,
  query,
  get,
  run,
  initDb
};
