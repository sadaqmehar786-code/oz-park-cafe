const { run, get, query } = require('./db');

const initialCategories = [
  { slug: 'salad-appetizers', icon: '🥗', nameAr: 'المقبلات والسلطات', nameEn: 'Salads & Cold Appetizers', display_order: 1 },
  { slug: 'hot-appetizers', icon: '🥟', nameAr: 'المقبلات الساخنة', nameEn: 'Hot Appetizers', display_order: 2 },
  { slug: 'soups', icon: '🥣', nameAr: 'الشوربة', nameEn: 'Soups', display_order: 3 },
  { slug: 'grills', icon: '🍢', nameAr: 'المشويات', nameEn: 'Charcoal Grills', display_order: 4 },
  { slug: 'manakish', icon: '🫓', nameAr: 'المناقيش', nameEn: 'Fresh Manakish', display_order: 5 },
  { slug: 'italian', icon: '🍝', nameAr: 'القسم الإيطالي', nameEn: 'Italian Corner', display_order: 6 },
  { slug: 'burgers', icon: '🍔', nameAr: 'البرجر والساندوتش', nameEn: 'Burgers & Sandwiches', display_order: 7 }
];

const initialItems = [
  // 1. Salad & Appetizer
  { cat: 'salad-appetizers', nameAr: 'سلطة خضراء', nameEn: 'Green Salad', price: 10, kcal: 75 },
  { cat: 'salad-appetizers', nameAr: 'فتوش', nameEn: 'Fattoush', price: 15, kcal: 160 },
  { cat: 'salad-appetizers', nameAr: 'تبولة', nameEn: 'Tabbouleh', price: 15, kcal: 130 },
  { cat: 'salad-appetizers', nameAr: 'محمرة', nameEn: 'Muhammara', price: 15, kcal: 250 },
  { cat: 'salad-appetizers', nameAr: 'متبل', nameEn: 'Mutabbal', price: 12, kcal: 140 },
  { cat: 'salad-appetizers', nameAr: 'حمص', nameEn: 'Hummus', price: 10, kcal: 162 },
  { cat: 'salad-appetizers', nameAr: 'سلطة يونانية', nameEn: 'Greek Salad', price: 18, kcal: 210 },
  { cat: 'salad-appetizers', nameAr: 'سلطة سيزر دجاج', nameEn: 'Caesar Chicken Salad', price: 20, kcal: 240 },
  { cat: 'salad-appetizers', nameAr: 'سلطة الملفوف', nameEn: 'Coleslaw Salad', price: 15, kcal: 317 },
  { cat: 'salad-appetizers', nameAr: 'بطاطس حارة', nameEn: 'Spicy Potato', price: 10, kcal: 470 },

  // 2. Oriental Hot Appetizer
  { cat: 'hot-appetizers', nameAr: 'كبة لحم مقلية (٤ حبة)', nameEn: 'Fried Beef Kibbeh (4 pcs)', price: 12, kcal: 610 },
  { cat: 'hot-appetizers', nameAr: 'سمبوسة مشكلة (جبن - لحم - خضار ٦ حبة)', nameEn: 'Mixed Sambousek (Cheese - Meat - Veggie 6 pcs)', price: 15, kcal: 520 },
  { cat: 'hot-appetizers', nameAr: 'كبة باللبن مع أرز بالشعيرية', nameEn: 'Kibbeh with Yogurt & Vermicelli Rice', price: 25, kcal: 550 },
  { cat: 'hot-appetizers', nameAr: 'شيش برك', nameEn: 'Shish Barak', price: 25, kcal: 485 },
  { cat: 'hot-appetizers', nameAr: 'فتة حمص', nameEn: 'Fattah Hummus', price: 15, kcal: 780 },
  { cat: 'hot-appetizers', nameAr: 'أرز أبيض', nameEn: 'White Rice', price: 10, kcal: 490 },
  { cat: 'hot-appetizers', nameAr: 'سبرنج رول (٦ حبة)', nameEn: 'Spring Rolls (6 pcs)', price: 18, kcal: 720 },

  // 3. Soups
  { cat: 'soups', nameAr: 'شوربة دجاج بالكريمة', nameEn: 'Chicken Cream Soup', price: 15, kcal: 300 },
  { cat: 'soups', nameAr: 'شوربة مشروم بالكريمة', nameEn: 'Mushroom Cream Soup', price: 13, kcal: 250 },
  { cat: 'soups', nameAr: 'شوربة عدس', nameEn: 'Lentil Soup', price: 10, kcal: 220 },
  { cat: 'soups', nameAr: 'شوربة سي فود', nameEn: 'Seafood Soup', price: 20, kcal: 350 },

  // 4. Grilled Specialties
  { cat: 'grills', nameAr: 'كباب لحم', nameEn: 'Meat Kebab', price: 35, kcal: 730 },
  { cat: 'grills', nameAr: 'كباب دجاج', nameEn: 'Chicken Kebab', price: 31, kcal: 480 },
  { cat: 'grills', nameAr: 'أوصال لحم مشوية', nameEn: 'Grilled Beef Cubes', price: 37, kcal: 863 },
  { cat: 'grills', nameAr: 'شيش طاووق دجاج', nameEn: 'Chicken Shish Tawook', price: 35, kcal: 464 },
  { cat: 'grills', nameAr: 'مشاوي مشكلة', nameEn: 'Mixed Grill', price: 37, kcal: 780 },
  { cat: 'grills', nameAr: 'كباب خشخاش', nameEn: 'Kebab Khashkhash', price: 37, kcal: 810 },
  { cat: 'grills', nameAr: 'عرايس مشوية', nameEn: 'Grilled Arayes', price: 28, kcal: 417 },
  { cat: 'grills', nameAr: 'ريش غنم مشوية', nameEn: 'Grilled Lamb Chops', price: 75, kcal: 1107 },

  // 5. Manakish
  { cat: 'manakish', nameAr: 'مناقيش زعتر', nameEn: 'Zaatar Manakish', price: 12, kcal: 217 },
  { cat: 'manakish', nameAr: 'مناقيش جبنة', nameEn: 'Cheese Manakish', price: 15, kcal: 462 },
  { cat: 'manakish', nameAr: 'مناقيش لبنة سادة', nameEn: 'Plain Labneh Manakish', price: 15, kcal: 297 },
  { cat: 'manakish', nameAr: 'مناقيش لبنة بالزعتر', nameEn: 'Labneh & Zaatar Manakish', price: 17, kcal: 477 },
  { cat: 'manakish', nameAr: 'مناقيش سبانخ', nameEn: 'Spinach Manakish', price: 15, kcal: 320 },
  { cat: 'manakish', nameAr: 'مناقيش لحم بالجبن', nameEn: 'Beef with Cheese Manakish', price: 20, kcal: 422 },

  // 6. Italian Corner
  { cat: 'italian', nameAr: 'باستا فوتوتشيني بالدجاج', nameEn: 'Chicken Fettuccine Pasta', price: 27, kcal: 582 },
  { cat: 'italian', nameAr: 'سباغيتي بولونيز', nameEn: 'Spaghetti Bolognese', price: 23, kcal: 490 },
  { cat: 'italian', nameAr: 'بينا أرابياتا باستا', nameEn: 'Penne Arrabiata', price: 22, kcal: 437 },
  { cat: 'italian', nameAr: 'لازانيا', nameEn: 'Lasagna', price: 28, kcal: 612 },
  { cat: 'italian', nameAr: 'بيتزا مارغريتا', nameEn: 'Margherita Pizza', price: 20, kcal: 410 },
  { cat: 'italian', nameAr: 'بيتزا دجاج رانش', nameEn: 'Ranch Chicken Pizza', price: 25, kcal: 395 },
  { cat: 'italian', nameAr: 'بيتزا بيبيروني', nameEn: 'Pepperoni Pizza', price: 25, kcal: 551 },
  { cat: 'italian', nameAr: 'بيتزا سي فود', nameEn: 'Seafood Pizza', price: 25, kcal: 436 },

  // 7. Burgers & Sandwiches
  { cat: 'burgers', nameAr: 'دبل سماش برجر مع بطاطس', nameEn: 'Double Smash Burger with Fries', price: 27, kcal: 1250 },
  { cat: 'burgers', nameAr: 'كلاسيك بيف برجر', nameEn: 'Classic Beef Burger', price: 20, kcal: 550 },
  { cat: 'burgers', nameAr: 'كرسبي تشيكن برجر', nameEn: 'Crispy Chicken Burger', price: 17, kcal: 480 },
  { cat: 'burgers', nameAr: 'ساندوتش كباب لحم', nameEn: 'Beef Kebab Sandwich', price: 17, kcal: 380 },
  { cat: 'burgers', nameAr: 'ساندوتش كباب دجاج', nameEn: 'Chicken Kebab Sandwich', price: 15, kcal: 260 },
  { cat: 'burgers', nameAr: 'ساندوتش شيش طاووق', nameEn: 'Shish Tawook Sandwich', price: 17, kcal: 210 },
  { cat: 'burgers', nameAr: 'ساندوتش فاهيتا دجاج', nameEn: 'Chicken Fajita Sandwich', price: 17, kcal: 400 }
];

async function initRestaurantDb() {
  await run(`
    CREATE TABLE IF NOT EXISTS restaurant_categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name_en TEXT NOT NULL,
      name_ar TEXT NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      icon TEXT,
      display_order INTEGER DEFAULT 0,
      status TEXT DEFAULT 'active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS restaurant_items (
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
      calories INTEGER,
      availability_status TEXT DEFAULT 'available',
      display_order INTEGER DEFAULT 0,
      deleted_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (category_id) REFERENCES restaurant_categories(id)
    )
  `);

  // Check if categories need seeding
  const existingCats = await query('SELECT id, slug FROM restaurant_categories');
  const catMap = {};

  if (existingCats.length === 0) {
    console.log('[Restaurant DB] Seeding initial restaurant categories...');
    for (const c of initialCategories) {
      const res = await run(`
        INSERT INTO restaurant_categories (name_en, name_ar, slug, icon, display_order, status)
        VALUES (?, ?, ?, ?, ?, 'active')
      `, [c.nameEn, c.nameAr, c.slug, c.icon, c.display_order]);
      catMap[c.slug] = res.id;
    }
  } else {
    for (const c of existingCats) {
      catMap[c.slug] = c.id;
    }
  }

  // Check if items need seeding
  const existingItems = await get('SELECT COUNT(*) as count FROM restaurant_items WHERE deleted_at IS NULL');
  if (!existingItems || existingItems.count === 0) {
    console.log('[Restaurant DB] Seeding initial 50 restaurant menu items...');
    let order = 1;
    for (const item of initialItems) {
      const catId = catMap[item.cat];
      if (!catId) continue;
      const slug = item.nameEn.toLowerCase().replace(/[^a-z0-9-]/g, '-') + '-' + order;
      await run(`
        INSERT INTO restaurant_items (
          category_id, name_en, name_ar, slug, description_en, description_ar,
          price, image_url, calories, availability_status, display_order
        ) VALUES (?, ?, ?, ?, ?, ?, ?, NULL, ?, 'available', ?)
      `, [
        catId, item.nameEn, item.nameAr, slug,
        item.nameEn, item.nameAr,
        item.price, item.kcal, order
      ]);
      order++;
    }
    console.log(`[Restaurant DB] Successfully seeded ${order - 1} restaurant items.`);
  }
}

module.exports = {
  initRestaurantDb
};
