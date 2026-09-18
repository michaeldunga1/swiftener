const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/userController');
const { requireAuth, attachUserIfPresent } = require('../middleware/auth');

router.get('/me', requireAuth, ctrl.getMyProfile);
router.put('/me', requireAuth, ctrl.updateProfile);
router.put('/me/password', requireAuth, ctrl.changePassword);
router.get('/me/analytics', requireAuth, ctrl.myProfileAnalytics);
router.get('/me/:type(save|bookmark|like)', requireAuth, ctrl.myInteractedPosts);
router.post('/invite', requireAuth, ctrl.inviteFriend);

router.get('/:id', attachUserIfPresent, ctrl.getPublicProfile); // public profile page

// Admin-only per-post analytics
router.get('/analytics/post/:postId', requireAuth, ctrl.postAnalytics);

module.exports = router;
