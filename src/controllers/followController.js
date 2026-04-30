const Follow = require("../models/Follow");
const User = require("../models/User");

async function follow(req, res) {
  const currentUserId = req.user._id;
  const targetUserId = req.params.userId;

  if (currentUserId.toString() === targetUserId) {
    return res.status(400).json({ error: "Cannot follow yourself" });
  }

  const targetUser = await User.findById(targetUserId);
  if (!targetUser || targetUser.accountStatus !== "active") {
    return res.status(404).json({ error: "User not found" });
  }

  const existing = await Follow.findOne({ followerId: currentUserId, followingId: targetUserId });
  if (existing) {
    return res.status(400).json({ error: "Already following" });
  }

  await Follow.create({ followerId: currentUserId, followingId: targetUserId });

  await User.findByIdAndUpdate(currentUserId, { $inc: { followingCount: 1 } });
  await User.findByIdAndUpdate(targetUserId, { $inc: { followersCount: 1 } });

  res.status(201).json({ ok: true });
}

async function unfollow(req, res) {
  const currentUserId = req.user._id;
  const targetUserId = req.params.userId;

  const existing = await Follow.findOneAndDelete({ followerId: currentUserId, followingId: targetUserId });
  if (!existing) {
    return res.status(404).json({ error: "Not following" });
  }

  await User.findByIdAndUpdate(currentUserId, { $inc: { followingCount: -1 } });
  await User.findByIdAndUpdate(targetUserId, { $inc: { followersCount: -1 } });

  res.status(204).send();
}

async function getFollowingIds(req, res) {
  const follows = await Follow.find({ followerId: req.user._id }).select("followingId").lean();
  const followingIds = follows.map((followDoc) => followDoc.followingId.toString());
  res.json({ followingIds });
}

async function getFollowers(req, res) {
  const { id } = req.params;
  const limit = Math.min(Number(req.query.limit) || 50, 100);
  const skip = Number(req.query.skip) || 0;

  const follows = await Follow.find({ followingId: id })
    .populate("followerId", "username displayName avatar")
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .lean();

  const users = follows
    .map((followDoc) => followDoc.followerId)
    .filter(Boolean)
    .map((userDoc) => ({
      id: userDoc._id,
      username: userDoc.username,
      displayName: userDoc.displayName,
      avatar: userDoc.avatar,
    }));

  res.json(users);
}

async function getFollowing(req, res) {
  const { id } = req.params;
  const limit = Math.min(Number(req.query.limit) || 50, 100);
  const skip = Number(req.query.skip) || 0;

  const follows = await Follow.find({ followerId: id })
    .populate("followingId", "username displayName avatar")
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .lean();

  const users = follows
    .map((followDoc) => followDoc.followingId)
    .filter(Boolean)
    .map((userDoc) => ({
      id: userDoc._id,
      username: userDoc.username,
      displayName: userDoc.displayName,
      avatar: userDoc.avatar,
    }));

  res.json(users);
}

async function checkFollowStatus(req, res) {
  const currentUserId = req.user._id;
  const targetUserId = req.params.userId;

  const exists = await Follow.exists({ followerId: currentUserId, followingId: targetUserId });
  res.json({ following: !!exists });
}

module.exports = {
  follow,
  unfollow,
  getFollowingIds,
  getFollowers,
  getFollowing,
  checkFollowStatus,
};
