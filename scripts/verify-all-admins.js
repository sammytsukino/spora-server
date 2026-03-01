#!/usr/bin/env node
/**
 * Mark all admin users as email verified.
 * Usage: node scripts/verify-all-admins.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { connectDB } = require('../db');
const User = require('../models/User');

async function main() {
  await connectDB();
  const result = await User.updateMany(
    { role: 'admin' },
    { $set: { emailVerified: true } }
  );
  console.log(`✓ ${result.modifiedCount} admin(s) marked as verified.`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
