const express = require('express');
const rateLimit = require('express-rate-limit');
const router = express.Router();
const ctrl = require('../controllers/authController');

// Throttle auth endpoints against brute-force / spam.
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20 });

router.get('/providers', ctrl.authProviders);
router.get('/google', ctrl.startGoogle);
router.get('/google/callback', ctrl.googleCallback);
router.get('/github', ctrl.startGithub);
router.get('/github/callback', ctrl.githubCallback);

router.post('/register', authLimiter, ctrl.register);
router.get('/verify-email', ctrl.verifyEmail);
router.post('/login', authLimiter, ctrl.login);
router.post('/logout', ctrl.logout);
router.post('/forgot-password', authLimiter, ctrl.forgotPassword);
router.post('/reset-password', authLimiter, ctrl.resetPassword);

module.exports = router;
