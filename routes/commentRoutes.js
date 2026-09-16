const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/commentController');
const { requireAuth, requireActiveForEngagement } = require('../middleware/auth');

router.get('/:postId', ctrl.listComments); // public read
router.post('/:postId', requireAuth, requireActiveForEngagement, ctrl.createComment);
router.delete('/:id', requireAuth, ctrl.deleteComment);
router.post('/:id/report', requireAuth, requireActiveForEngagement, ctrl.reportComment);

module.exports = router;
