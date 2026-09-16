const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/postController');
const { requireAuth, requireAdmin, attachUserIfPresent } = require('../middleware/auth');

// Public
router.get('/', ctrl.listPosts);

// Admin only — must be before /:slug so "admin" is not treated as a slug
router.get('/admin/drafts', requireAuth, requireAdmin, ctrl.listDrafts);

router.get('/:slug', attachUserIfPresent, ctrl.getPostBySlug);
router.post('/', requireAuth, requireAdmin, ctrl.createPost);
router.put('/:id', requireAuth, requireAdmin, ctrl.updatePost);
router.delete('/:id', requireAuth, requireAdmin, ctrl.deletePost);

module.exports = router;
