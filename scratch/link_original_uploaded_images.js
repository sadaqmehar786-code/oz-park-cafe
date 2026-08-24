const fs = require('fs');
const path = require('path');
const { query, run } = require('../db');

async function linkOriginalImages() {
  console.log('Mapping original uploaded files in uploads directory to menu items...');
  const uploadsDir = path.join(__dirname, '..', 'uploads');
  if (!fs.existsSync(uploadsDir)) {
    console.error('Uploads directory not found!');
    return;
  }

  const files = fs.readdirSync(uploadsDir);

  const findLatestFile = (prefix) => {
    const matched = files
      .filter(f => f.toLowerCase().startsWith(prefix.toLowerCase()) && !f.startsWith('product_'))
      .sort((a, b) => fs.statSync(path.join(uploadsDir, b)).mtimeMs - fs.statSync(path.join(uploadsDir, a)).mtimeMs);
    return matched.length > 0 ? matched[0] : null;
  };

  const mappings = [
    { names: ['Spanish Latte', 'Café Latte', 'Cappuccino'], prefix: 'Spanish_Latte' },
    { names: ['Double Espresso'], prefix: 'Double_Espresso' },
    { names: ['Turkish Coffee'], prefix: 'turkish_Coffee' },
    { names: ['Turkish Coffee with Milk'], prefix: 'Turkish_Coffee_with_Milk' },
    { names: ['Cortado'], prefix: 'Cortado' },
    { names: ['French Coffee'], prefix: 'French_Coffee' },
    { names: ['Macchiato'], prefix: 'Macchiato' },
    { names: ['Americano'], prefix: 'Americano' },
    { names: ['Flat White'], prefix: 'Flat_White' },
    { names: ['Mocha'], prefix: 'Mocha' },
    { names: ['White Mocha'], prefix: 'White_Mocha' },
    { names: ['V60'], prefix: 'V60' },
    { names: ['Arabic Coffee Pot'], prefix: 'Arabic_Coffee_Pot' },
    { names: ['Arabic Coffee Cup'], prefix: 'Arabic_Coffee_Cup' },
    { names: ['Red Tea'], prefix: 'Red_Tea_Cup' },
    { names: ['Green Tea'], prefix: 'Green_Tea_Cup' },
    { names: ['Tea Pot'], prefix: 'Red_Tea_Pot' },
    { names: ['Ice Americano'], prefix: 'Ice_Americano' }
  ];

  for (const map of mappings) {
    const file = findLatestFile(map.prefix);
    if (!file) continue;

    const publicUrl = `/api/v1/public/uploads/${file}`;
    for (const name of map.names) {
      await run('UPDATE menu_items SET image_url = ? WHERE name_en = ? OR name_ar = ?', [publicUrl, name, name]);
      console.log(`Linked '${name}' -> ${publicUrl}`);
    }
  }

  console.log('Original image linking complete!');
}

linkOriginalImages().catch(err => console.error(err));
