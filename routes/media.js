const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { get, query, run } = require('../db');
const { authenticate, requirePermission, logAudit } = require('../middleware/auth');

// Configure multer storage
const uploadsDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const basename = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9]/g, '_');
    cb(null, `${basename}_${Date.now()}${ext}`);
  }
});

// File filter (restrict dangerous extensions)
const fileFilter = (req, file, cb) => {
  const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml', 'video/mp4', 'application/pdf'];
  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only JPG, PNG, WEBP, GIF, SVG, MP4, and PDF are allowed.'));
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 15 * 1024 * 1024 } // 15MB limit
});

// GET /api/v1/media
router.get('/', authenticate, requirePermission('manage_media'), async (req, res) => {
  try {
    const { search, type } = req.query;
    let sql = 'SELECT m.*, u.full_name as uploader_name FROM media_library m LEFT JOIN users u ON m.uploaded_by = u.id WHERE 1=1';
    const params = [];

    if (search) {
      sql += ' AND (m.original_name LIKE ? OR m.alt_text_ar LIKE ? OR m.alt_text_en LIKE ?)';
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    if (type === 'image') {
      sql += ' AND m.mime_type LIKE "image/%"';
    } else if (type === 'video') {
      sql += ' AND m.mime_type LIKE "video/%"';
    }

    sql += ' ORDER BY m.id DESC';
    const files = await query(sql, params);
    res.json({ success: true, data: files });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to fetch media files' });
  }
});

// POST /api/v1/media/upload
router.post('/upload', authenticate, requirePermission('manage_media'), upload.array('files', 10), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ success: false, error: 'No files uploaded' });
    }

    const uploadedFiles = [];

    for (const file of req.files) {
      let relativePath = `/api/v1/public/uploads/${file.filename}`;

      // Convert image files to Base64 Data URIs for 100% disk persistence & 0ms load time without proxy errors
      if (file.mimetype && file.mimetype.startsWith('image/')) {
        try {
          const fileBuffer = fs.readFileSync(file.path);
          relativePath = `data:${file.mimetype};base64,${fileBuffer.toString('base64')}`;
        } catch (e) {
          console.error('Base64 encoding error:', e);
        }
      }

      const result = await run(`
        INSERT INTO media_library (file_name, original_name, file_path, mime_type, file_size, uploaded_by)
        VALUES (?, ?, ?, ?, ?, ?)
      `, [file.filename, file.originalname, relativePath, file.mimetype, file.size, req.user.id]);

      uploadedFiles.push({
        id: result.id,
        file_name: file.filename,
        original_name: file.originalname,
        file_path: relativePath,
        mime_type: file.mimetype,
        file_size: file.size
      });
    }

    await logAudit(req, 'UPLOAD_MEDIA', `Uploaded ${uploadedFiles.length} file(s)`);
    res.json({ success: true, message: 'Files uploaded successfully', data: uploadedFiles });
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ success: false, error: err.message || 'File upload failed' });
  }
});

// PUT /api/v1/media/:id (Update Alt text & caption)
router.put('/:id', authenticate, requirePermission('manage_media'), async (req, res) => {
  try {
    const { alt_text_en, alt_text_ar, caption_en, caption_ar } = req.body;
    await run(`
      UPDATE media_library SET
        alt_text_en = ?, alt_text_ar = ?, caption_en = ?, caption_ar = ?
      WHERE id = ?
    `, [alt_text_en || '', alt_text_ar || '', caption_en || '', caption_ar || '', req.params.id]);

    await logAudit(req, 'UPDATE_MEDIA_META', `Updated alt text for media ID ${req.params.id}`);
    res.json({ success: true, message: 'Media details updated' });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to update media details' });
  }
});

// DELETE /api/v1/media/:id
router.delete('/:id', authenticate, requirePermission('manage_media'), async (req, res) => {
  try {
    const media = await get('SELECT * FROM media_library WHERE id = ?', [req.params.id]);
    if (!media) {
      return res.status(404).json({ success: false, error: 'Media file not found' });
    }

    // Unlink physical file if inside uploads directory
    const fullPath = path.join(__dirname, '..', media.file_path);
    if (fs.existsSync(fullPath)) {
      try { fs.unlinkSync(fullPath); } catch (e) {}
    }

    await run('DELETE FROM media_library WHERE id = ?', [media.id]);
    await logAudit(req, 'DELETE_MEDIA', `Deleted media file '${media.original_name}'`);

    res.json({ success: true, message: 'Media file deleted successfully' });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to delete media file' });
  }
});

module.exports = router;
