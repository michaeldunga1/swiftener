require('dotenv').config();
const path = require('path');
const express = require('express');
const cookieParser = require('cookie-parser');
const connectDB = require('./config/db');
const { notFound, errorHandler } = require('./middleware/errorHandler');
const { hideTimestampsFromNonAdmins } = require('./middleware/hideTimestamps');

const authRoutes = require('./routes/authRoutes');
const authCtrl = require('./controllers/authController');
const postRoutes = require('./routes/postRoutes');
const engagementRoutes = require('./routes/engagementRoutes');
const commentRoutes = require('./routes/commentRoutes');
const adminRoutes = require('./routes/adminRoutes');
const userRoutes = require('./routes/userRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const newsletterRoutes = require('./routes/newsletterRoutes');
const analyticsRoutes = require('./routes/analyticsRoutes');
const uploadRoutes = require('./routes/uploadRoutes');
const { ensureUploadDir, UPLOAD_ROOT } = require('./utils/upload');

connectDB();
ensureUploadDir();

const app = express();

if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}

app.use(express.json({ limit: '4mb' }));
app.use(cookieParser());

// Mount this router tree under whatever base path fits your existing Swiftener app,
// e.g. app.use('/blog', blogRouter) if you want it namespaced alongside your existing tools.
app.use('/api', hideTimestampsFromNonAdmins);
app.use('/api/auth', authRoutes);
// OAuth provider callbacks (path must match redirect_uri in Google/GitHub app settings)
app.get('/auth/google/callback', authCtrl.googleCallback);
app.get('/auth/github/callback', authCtrl.githubCallback);
app.use('/api/posts', postRoutes);
app.use('/api/posts', engagementRoutes); // /api/posts/:postId/like etc.
app.use('/api/comments', commentRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/users', userRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/newsletter', newsletterRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/uploads', uploadRoutes);
app.use('/uploads', express.static(UPLOAD_ROOT));

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));
app.get('/healthz', (req, res) => res.json({ status: 'ok' }));

const { mountSeoRoutes, sendSpaHtml } = require('./routes/seoRoutes');
mountSeoRoutes(app);

const publicDir = path.join(__dirname, 'public');
app.use(express.static(publicDir));
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api') || req.path.startsWith('/auth/') || req.path.startsWith('/uploads/')) return next();
  sendSpaHtml(req, res);
});

app.use(notFound);
app.use(errorHandler);

const PORT = Number(process.env.PORT || 4000);
const HOST = process.env.HOST || '0.0.0.0';
app.listen(PORT, HOST, () => console.log(`[server] Listening on http://${HOST}:${PORT}`));

module.exports = app;
