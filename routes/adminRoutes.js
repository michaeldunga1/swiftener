const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/adminController');
const { requireAuth, requireAdmin } = require('../middleware/auth');

router.use(requireAuth, requireAdmin); // everything below is admin-only

router.get('/dashboard', ctrl.dashboardStats);

router.get('/users', ctrl.listUsers);
router.post('/users/:id/make-admin', ctrl.makeAdmin);
router.post('/users/:id/revoke-admin', ctrl.revokeAdmin);
router.post('/users/:id/block', ctrl.blockUser);
router.post('/users/:id/unblock', ctrl.unblockUser);
router.post('/users/:id/suspend', ctrl.suspendUser);
router.post('/users/:id/unsuspend', ctrl.unsuspendUser);
router.delete('/users/:id', ctrl.deleteUser);
router.post('/users/invite', ctrl.inviteUser);

router.get('/reports', ctrl.listPendingReports);
router.post('/reports/:id/resolve', ctrl.resolveReport);
router.get('/analytics', ctrl.pageLoadAnalytics);
router.get('/errors', ctrl.errorAnalytics);
router.get('/db/tables', ctrl.listTables);
router.get('/db/tables/:name', ctrl.browseTable);

module.exports = router;
