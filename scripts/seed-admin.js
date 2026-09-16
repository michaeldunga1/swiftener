require('dotenv').config();
const bcrypt = require('bcryptjs');
const connectDB = require('../config/db');
const User = require('../models/User');

async function main() {
  connectDB();

  const email = (process.env.SEED_ADMIN_EMAIL || 'admin@swiftener.local').toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD || 'changeme123';
  const name = process.env.SEED_ADMIN_NAME || 'Admin';

  const existing = User.findOne({ email });
  if (existing) {
    User.update(existing._id, { role: 'admin', password: await bcrypt.hash(password, 12) });
    console.log(`[seed] Updated admin: ${email}`);
  } else {
    const user = User.create({
      name,
      email,
      password: await bcrypt.hash(password, 12),
      role: 'admin',
    });
    User.update(user._id, { isVerified: true });
    console.log(`[seed] Created admin: ${email}`);
  }
  console.log('[seed] Password:', password);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
