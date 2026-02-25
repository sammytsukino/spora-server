const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { v2: cloudinary } = require("cloudinary");
const User = require("../models/User");

if (
  process.env.CLOUDINARY_CLOUD_NAME &&
  process.env.CLOUDINARY_API_KEY &&
  process.env.CLOUDINARY_API_SECRET
) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
}

const ACCESS_TOKEN_EXPIRY = "15m";
const REFRESH_TOKEN_EXPIRY = "7d";

function signAccessToken(user) {
  return jwt.sign(
    { sub: user._id.toString(), role: user.role, type: "access" },
    process.env.JWT_SECRET,
    { expiresIn: ACCESS_TOKEN_EXPIRY }
  );
}

function signRefreshToken(user) {
  return jwt.sign(
    { sub: user._id.toString(), role: user.role, type: "refresh" },
    process.env.JWT_SECRET,
    { expiresIn: REFRESH_TOKEN_EXPIRY }
  );
}

async function signUp(req, res) {
  const { username, displayName, email, password } = req.body;
  if (!username || !email || !password) {
    return res.status(400).json({ error: "Missing fields" });
  }

  const existing = await User.findOne({
    $or: [{ username }, { email: email.toLowerCase() }],
  });
  if (existing) {
    return res.status(409).json({ error: "User already exists" });
  }

  const hash = await bcrypt.hash(password, 10);
  const user = await User.create({
    username,
    displayName,
    email: email.toLowerCase(),
    password: hash,
  });

  const token = signAccessToken(user);
  const refreshToken = signRefreshToken(user);
  res.status(201).json({
    token,
    refreshToken,
    user: {
      id: user._id,
      username: user.username,
      displayName: user.displayName,
      avatar: user.avatar,
      email: user.email,
      role: user.role,
    },
  });
}

async function signIn(req, res) {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: "Missing fields" });
  }

  const user = await User.findOne({ username: String(username).trim() });
  if (!user || user.accountStatus !== "active") {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  const ok = await bcrypt.compare(password, user.password);
  if (!ok) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  user.lastLoginAt = new Date();
  await user.save();

  const token = signAccessToken(user);
  const refreshToken = signRefreshToken(user);
  res.json({
    token,
    refreshToken,
    user: {
      id: user._id,
      username: user.username,
      displayName: user.displayName,
      avatar: user.avatar,
      email: user.email,
      role: user.role,
    },
  });
}

async function refresh(req, res) {
  const { refreshToken } = req.body;
  if (!refreshToken || typeof refreshToken !== "string") {
    return res.status(400).json({ error: "Missing refresh token" });
  }
  try {
    const payload = jwt.verify(refreshToken.trim(), process.env.JWT_SECRET);
    if (payload.type !== "refresh") {
      return res.status(401).json({ error: "Invalid refresh token" });
    }
    const user = await User.findById(payload.sub);
    if (!user || user.accountStatus !== "active") {
      return res.status(401).json({ error: "Invalid user" });
    }
    const token = signAccessToken(user);
    const newRefreshToken = signRefreshToken(user);
    res.json({
      token,
      refreshToken: newRefreshToken,
      user: {
        id: user._id,
        username: user.username,
        displayName: user.displayName,
        avatar: user.avatar,
        email: user.email,
        role: user.role,
      },
    });
  } catch {
    return res.status(401).json({ error: "Invalid refresh token" });
  }
}

async function me(req, res) {
  const user = req.user;
  res.json({
    id: user._id,
    username: user.username,
    displayName: user.displayName,
    avatar: user.avatar,
    bio: user.bio,
    followersCount: user.followersCount ?? 0,
    followingCount: user.followingCount ?? 0,
    email: user.email,
    role: user.role,
    accountStatus: user.accountStatus,
    stats: user.stats
      ? {
          florasCreated: user.stats.florasCreated ?? 0,
          cuttingsTaken: user.stats.cuttingsTaken ?? 0,
          totalFloras: user.stats.totalFloras ?? 0,
        }
      : { florasCreated: 0, cuttingsTaken: 0, totalFloras: 0 },
  });
}

async function updateProfile(req, res) {
  const user = req.user;
  const { displayName, bio, avatar, avatarData } = req.body;

  if (displayName !== undefined) {
    user.displayName = typeof displayName === "string" ? displayName.trim() : displayName;
  }
  if (bio !== undefined) {
    user.bio = typeof bio === "string" ? bio.trim().slice(0, 500) : bio;
  }

  if (avatarData && typeof avatarData === "string") {
    const hasCloudinary =
      process.env.CLOUDINARY_CLOUD_NAME &&
      process.env.CLOUDINARY_API_KEY &&
      process.env.CLOUDINARY_API_SECRET;
    if (hasCloudinary) {
      try {
        const publicId = `spora/avatars/${user._id}_${Date.now()}`;
        const result = await cloudinary.uploader.upload(avatarData, {
          folder: "spora/avatars",
          public_id: publicId.split("/").pop(),
          resource_type: "image",
        });
        if (result?.secure_url) {
          user.avatar = result.secure_url;
        }
      } catch (err) {
        console.warn("Cloudinary avatar upload failed:", err?.message || err);
      }
    }
  } else if (avatar !== undefined && typeof avatar === "string") {
    user.avatar = avatar.trim();
  }

  await user.save();

  res.json({
    id: user._id,
    username: user.username,
    displayName: user.displayName,
    avatar: user.avatar,
    bio: user.bio,
    followersCount: user.followersCount ?? 0,
    followingCount: user.followingCount ?? 0,
    email: user.email,
    role: user.role,
  });
}

module.exports = { signUp, signIn, refresh, me, updateProfile };
