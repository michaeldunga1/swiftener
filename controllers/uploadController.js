const { saveDataUrl } = require('../utils/upload');

async function uploadImage(req, res, next) {
  try {
    const url = saveDataUrl(req.body?.dataUrl || req.body?.image);
    res.status(201).json({ url });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    next(err);
  }
}

module.exports = { uploadImage };
