const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/uploadController');
const { requireAuth, requireAdmin } = require('../middleware/auth');

router.post('/', requireAuth, requireAdmin, ctrl.uploadImage);

module.exports = router;
