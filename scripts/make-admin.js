#!/usr/bin/env node
/**
 * Promote a user to admin by email.
 * Usage: node scripts/make-admin.js you@example.com
 */
require('dotenv').config();
const connectDB = require('../config/db');
const User = require('../models/User');

const email = (process.argv[2] || process.env.ADMIN_EMAIL || '').trim().toLowerCase();
if (!email) {
  console.error('Usage: node scripts/make-admin.js you@example.com');
  process.exit(1);
}

connectDB();

const user = User.findOne({ email });
if (!user) {
  console.error(`[make-admin] No user found for ${email}`);
  console.error('Sign up or log in with Google/GitHub/email first, then run this again.');
  process.exit(1);
}

User.update(user._id, { role: 'admin', isVerified: true });
const updated = User.findById(user._id);
console.log(`[make-admin] ${updated.email} is now role=${updated.role}`);
