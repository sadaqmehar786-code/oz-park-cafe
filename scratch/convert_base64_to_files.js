const fs = require('fs');
const path = require('path');
const { query, run } = require('../db');

async function convertBase64ToFiles() {
  console.log('Starting Base64 image extraction and optimization...');
  const items = await query('SELECT id, name_en, image_url FROM menu_items WHERE image_url IS NOT NULL AND image_url LIKE "%base64%"');
  console.log(`Found ${items.length} items with Base64 images.`);

  const uploadsDir = path.join(__dirname, 'uploads');
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }

  for (const item of items) {
    try {
      let rawUrl = item.image_url.trim();
      if (rawUrl.startsWith('/data:')) {
        rawUrl = rawUrl.substring(1);
      }

      const match = rawUrl.match(/^data:image\/([a-zA-Z0-9-+]+);base64,(.+)$/);
      if (!match) continue;

      const ext = match[1] === 'jpeg' ? 'jpg' : (match[1] || 'png');
      const base64Data = match[2];
      const buffer = Buffer.from(base64Data, 'base64');

      const filename = `product_${item.id}_${Date.now()}.${ext}`;
      const filePath = path.join(uploadsDir, filename);

      fs.writeFileSync(filePath, buffer);

      const publicUrl = `/uploads/${filename}`;
      await run('UPDATE menu_items SET image_url = ? WHERE id = ?', [publicUrl, item.id]);
      console.log(`Optimized image for '${item.name_en}' -> ${publicUrl} (${Math.round(buffer.length/1024)} KB)`);
    } catch (err) {
      console.error(`Failed to convert image for item ${item.id}:`, err);
    }
  }

  console.log('Base64 optimization complete!');
}

convertBase64ToFiles().catch(err => console.error(err));
