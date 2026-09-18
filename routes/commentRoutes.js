const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/commentController');
const { requireAuth, requireActiveForEngagement, attachUserIfPresent } = require('../middleware/auth');

router.get('/:postId', attachUserIfPresent, ctrl.listComments); // public read
router.post('/:postId', requireAuth, requireActiveForEngagement, ctrl.createComment);
router.put('/:id', requireAuth, requireActiveForEngagement, ctrl.updateComment);
router.delete('/:id', requireAuth, ctrl.deleteComment);
router.post('/:id/report', requireAuth, requireActiveForEngagement, ctrl.reportComment);

module.exports = router;
