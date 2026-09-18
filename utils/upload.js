const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const UPLOAD_ROOT = path.join(__dirname, '..', 'data', 'uploads');
const MAX_BYTES = 2.5 * 1024 * 1024;
const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

function ensureUploadDir() {
  fs.mkdirSync(UPLOAD_ROOT, { recursive: true });
}

function saveDataUrl(dataUrl) {
  const match = String(dataUrl || '').match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,([A-Za-z0-9+/=\s]+)$/);
  if (!match) {
    const err = new Error('Invalid image data');
    err.status = 400;
    throw err;
  }
  const mime = match[1].toLowerCase();
  if (!ALLOWED.has(mime)) {
    const err = new Error('Only JPEG, PNG, WebP, and GIF images are allowed');
    err.status = 400;
    throw err;
  }
  const buffer = Buffer.from(match[2].replace(/\s/g, ''), 'base64');
  if (!buffer.length || buffer.length > MAX_BYTES) {
    const err = new Error('Image must be under 2.5MB');
    err.status = 400;
    throw err;
  }
  const ext = mime === 'image/jpeg' ? 'jpg' : mime.split('/')[1];
  ensureUploadDir();
  const name = `${Date.now()}-${crypto.randomBytes(6).toString('hex')}.${ext}`;
  fs.writeFileSync(path.join(UPLOAD_ROOT, name), buffer);
  return `/uploads/${name}`;
}

module.exports = { UPLOAD_ROOT, saveDataUrl, ensureUploadDir };
