#!/usr/bin/env node

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const bcrypt = require('bcryptjs');
const { connectDB } = require('../db');
const User = require('../models/User');

async function main() {
  const args = process.argv.slice(2);
  const promoteIndex = args.indexOf('--promote');

  if (promoteIndex !== -1) {
    
    const username = args[promoteIndex + 1] || process.env.ADMIN_USERNAME;
    if (!username) {
      console.error('Usage: node scripts/create-admin.js --promote <username>');
      process.exit(1);
    }
    await connectDB();
    const user = await User.findOne({ username: username.trim() });
    if (!user) {
      console.error(`User "${username}" not found.`);
      process.exit(1);
    }
    user.role = 'admin';
    user.emailVerified = true;
    await user.save();
    console.log(`✓ User @${user.username} is now admin.`);
    process.exit(0);
  }

  
  const username = args[0] || process.env.ADMIN_USERNAME;
  const password = args[1] || process.env.ADMIN_PASSWORD;
  const email = process.env.ADMIN_EMAIL || `${username || 'admin'}@spora.local`;

  if (!username || !password) {
    console.log(`
Create or promote an admin user:

  Create new admin:
    node scripts/create-admin.js <username> <password>
    # Or set ADMIN_USERNAME, ADMIN_PASSWORD, ADMIN_EMAIL in .env

  Promote existing user:
    node scripts/create-admin.js --promote <username>
`);
    process.exit(1);
  }

  await connectDB();

  let user = await User.findOne({ username: username.trim() });
  if (user) {
    user.role = 'admin';
    user.emailVerified = true;
    user.password = await bcrypt.hash(password, 10);
    await user.save();
    console.log(`✓ User @${user.username} promoted to admin.`);
  } else {
    const hash = await bcrypt.hash(password, 10);
    user = await User.create({
      username: username.trim(),
      displayName: username.trim(),
      email: email.toLowerCase(),
      password: hash,
      role: 'admin',
      emailVerified: true,
    });
    console.log(`✓ Admin @${user.username} created. Sign in with this username and password.`);
  }

  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
