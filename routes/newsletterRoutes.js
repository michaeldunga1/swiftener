const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/newsletterController');
const { requireAuth, requireAdmin, attachUserIfPresent } = require('../middleware/auth');

router.post('/subscribe', attachUserIfPresent, ctrl.subscribe);
router.get('/verify', ctrl.verifySubscription);
router.get('/unsubscribe', ctrl.unsubscribe);
router.get('/subscribers', requireAuth, requireAdmin, ctrl.listSubscribers);

module.exports = router;
