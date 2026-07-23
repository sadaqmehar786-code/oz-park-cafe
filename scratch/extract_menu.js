const fs = require('fs');
const html = fs.readFileSync('menu.html', 'utf8');

const items = [];
const itemRegex = /<div class="menu-list-item"[^>]*data-category="([^"]+)"[\s\S]*?<h3>\s*<span class="lang-ar">([^<]+)<\/span>\s*<span class="lang-en">([^<]+)<\/span>[\s\S]*?<p class="lang-ar">([^<]+)<\/p>\s*<p class="lang-en">([^<]+)<\/p>[\s\S]*?data-price="([^"]+)"\s*data-calories="([^"]*)"/g;

let match;
while ((match = itemRegex.exec(html)) !== null) {
  items.push({
    category_slug: match[1].trim(),
    name_ar: match[2].trim(),
    name_en: match[3].trim(),
    description_ar: match[4].trim(),
    description_en: match[5].trim(),
    price: parseFloat(match[6]),
    calories: match[7] ? parseInt(match[7]) : null
  });
}

console.log('Extracted total menu items count:', items.length);
fs.writeFileSync('scratch/extracted_menu_items.json', JSON.stringify(items, null, 2));
