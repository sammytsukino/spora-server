#!/usr/bin/env node

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { connectDb } = require('../src/config/db');
const User = require('../src/models/User');

async function main() {
  await connectDb();
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
