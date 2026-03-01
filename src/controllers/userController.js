const User = require("../models/User");

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function getByUsername(req, res) {
  const raw = String(req.params.username || "").trim();
  const username = raw.replace(/^@+/, "");
  if (!username) {
    return res.status(404).json({ error: "User not found" });
  }
  const user = await User.findOne({
    username: { $regex: new RegExp(`^${escapeRegex(username)}$`, "i") },
    accountStatus: "active",
    isAnonymized: { $ne: true },
  })
    .select("username displayName avatar bio followersCount followingCount stats")
    .lean();

  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }

  res.json({
    id: user._id,
    username: user.username,
    displayName: user.displayName,
    avatar: user.avatar,
    bio: user.bio,
    followersCount: user.followersCount ?? 0,
    followingCount: user.followingCount ?? 0,
    stats: user.stats,
  });
}

module.exports = { getByUsername };
