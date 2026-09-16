const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/analyticsController');
const { attachUserIfPresent } = require('../middleware/auth');

router.post('/pageview', attachUserIfPresent, ctrl.trackPageLoad);
router.post('/error', attachUserIfPresent, ctrl.reportClientError);

module.exports = router;
