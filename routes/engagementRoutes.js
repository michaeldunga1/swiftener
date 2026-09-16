const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/engagementController');
const { requireAuth, requireActiveForEngagement, attachUserIfPresent } = require('../middleware/auth');

router.post('/:postId/like', requireAuth, requireActiveForEngagement, ctrl.toggleInteraction('like'));
router.post('/:postId/save', requireAuth, requireActiveForEngagement, ctrl.toggleInteraction('save'));
router.post('/:postId/bookmark', requireAuth, requireActiveForEngagement, ctrl.toggleInteraction('bookmark'));
router.post('/:postId/share', ctrl.sharePost); // no auth required
router.post('/:postId/view', attachUserIfPresent, ctrl.trackView); // anonymous views still count, deduped by IP

module.exports = router;
