const crypto = require("crypto");

function hashVerificationToken(plainToken) {
  return crypto.createHash("sha256").update(String(plainToken), "utf8").digest("hex");
}

/**
 * Pending verification: DB stores SHA-256 hex of the secret sent by email only.
 * Falls back to legacy plaintext match for rows created before hashing.
 */
async function findUserForVerificationToken(plainToken, User) {
  const trimmed = String(plainToken).trim();
  if (!trimmed) return null;
  const hash = hashVerificationToken(trimmed);
  let user = await User.findOne({
    emailVerificationToken: hash,
    emailVerificationExpires: { $gt: new Date() },
  });
  if (user) return user;
  return User.findOne({
    emailVerificationToken: trimmed,
    emailVerificationExpires: { $gt: new Date() },
  });
}

module.exports = {
  hashVerificationToken,
  findUserForVerificationToken,
};
