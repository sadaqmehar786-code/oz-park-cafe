import os
import glob
import sqlite3
from PIL import Image

uploads_dir = "/var/www/app/uploads"
db_path = "/var/www/app/data/oz_park_cafe.db"

png_files = glob.glob(os.path.join(uploads_dir, "*.png"))
print(f"Found {len(png_files)} PNG files in uploads directory.")

conn = sqlite3.connect(db_path)
cursor = conn.cursor()

for filepath in png_files:
    filename = os.path.basename(filepath)
    if filename.startswith("product_"):
        continue

    try:
        opt_filename = os.path.splitext(filename)[0] + "_opt.jpg"
        opt_filepath = os.path.join(uploads_dir, opt_filename)

        with Image.open(filepath) as im:
            im = im.convert("RGB")
            im.thumbnail((400, 400), Image.Resampling.LANCZOS)
            im.save(opt_filepath, "JPEG", quality=80, optimize=True)

        orig_size = os.path.getsize(filepath) // 1024
        opt_size = os.path.getsize(opt_filepath) // 1024
        print(f"Compressed '{filename}': {orig_size} KB -> {opt_size} KB")

        old_url = f"/api/v1/public/uploads/{filename}"
        new_url = f"/api/v1/public/uploads/{opt_filename}"

        cursor.execute("UPDATE menu_items SET image_url = ? WHERE image_url = ?", (new_url, old_url))
    except Exception as e:
        print(f"Error compressing {filename}: {e}")

conn.commit()
conn.close()
print("Batch image compression complete!")
