const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/notificationController');
const { requireAuth } = require('../middleware/auth');

router.use(requireAuth);
router.get('/', ctrl.listMyNotifications);
router.post('/:id/read', ctrl.markAsRead);
router.post('/read-all', ctrl.markAllAsRead);

module.exports = router;
