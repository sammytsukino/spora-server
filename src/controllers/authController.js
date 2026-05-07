const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { v2: cloudinary } = require("cloudinary");
const User = require("../models/User");
const {
  hashVerificationToken,
  findUserForVerificationToken,
} = require("../lib/verificationToken");
const {
  setRefreshTokenCookie,
  clearRefreshTokenCookie,
  getRefreshTokenFromRequest,
} = require("../lib/refreshCookie");
const {
  generateVerificationToken,
  sendVerificationEmail,
  isEmailConfigured,
  buildVerifyUrl,
} = require("../services/emailService");

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
  const verificationToken = generateVerificationToken();
  const verificationTokenHash = hashVerificationToken(verificationToken);
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + 24);

  const user = await User.create({
    username,
    displayName,
    email: email.toLowerCase(),
    password: hash,
    emailVerified: false,
    emailVerificationToken: verificationTokenHash,
    emailVerificationExpires: expiresAt,
  });

  if (process.env.NODE_ENV !== "production") {
    console.log(
      `[Signup][debug] email=${user.email} plainToken=${verificationToken} storedHash=${verificationTokenHash}`
    );
  }

  let emailSent = false;
  try {
    emailSent = await sendVerificationEmail(user.email, verificationToken);
  } catch (err) {
    console.error("[Signup] Verification email failed:", err?.message || err);
    await User.findByIdAndDelete(user._id);
    return res.status(502).json({
      error: "Could not send verification email. Try again later.",
      code: "EMAIL_DELIVERY_FAILED",
    });
  }

  if (!emailSent && process.env.NODE_ENV === "production") {
    await User.findByIdAndDelete(user._id);
    return res.status(503).json({
      error:
        "Email is not configured on this server. Set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM.",
      code: "SMTP_NOT_CONFIGURED",
    });
  }

  if (!emailSent) {
    console.warn(
      "[Signup] SMTP not configured (dev). Manual verify URL:",
      buildVerifyUrl(verificationToken)
    );
  }

  res.status(201).json({
    message: emailSent
      ? "Check your email to verify your account"
      : "Account created. SMTP is not configured locally — check the server console for the verification URL.",
    emailSent,
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

  if (user.emailVerified === false && user.role !== "admin") {
    return res.status(403).json({
      error: "Email not verified",
      code: "EMAIL_NOT_VERIFIED",
    });
  }

  const ok = await bcrypt.compare(password, user.password);
  if (!ok) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  user.lastLoginAt = new Date();
  await user.save();

  const token = signAccessToken(user);
  const refreshToken = signRefreshToken(user);
  setRefreshTokenCookie(res, refreshToken);
  res.json({
    token,
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
  const refreshToken = getRefreshTokenFromRequest(req);
  if (!refreshToken) {
    return res.status(400).json({ error: "Missing refresh token" });
  }
  try {
    const payload = jwt.verify(refreshToken, process.env.JWT_SECRET);
    if (payload.type !== "refresh") {
      return res.status(401).json({ error: "Invalid refresh token" });
    }
    const user = await User.findById(payload.sub);
    if (!user || user.accountStatus !== "active") {
      return res.status(401).json({ error: "Invalid user" });
    }
    const token = signAccessToken(user);
    const newRefreshToken = signRefreshToken(user);
    setRefreshTokenCookie(res, newRefreshToken);
    res.json({
      token,
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

async function logout(req, res) {
  clearRefreshTokenCookie(res);
  res.json({ ok: true });
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

function buildAuthSuccessResponse(user) {
  const accessToken = signAccessToken(user);
  const refreshToken = signRefreshToken(user);
  return {
    accessToken,
    refreshToken,
    body: {
      success: true,
      token: accessToken,
      user: {
        id: user._id,
        username: user.username,
        displayName: user.displayName,
        avatar: user.avatar,
        email: user.email,
        role: user.role,
      },
    },
  };
}

async function verifyEmail(req, res) {
  const { token } = req.query;
  if (!token || typeof token !== "string") {
    return res.status(400).json({ error: "Missing or invalid token" });
  }

  const trimmedToken = token.trim();
  const user = await findUserForVerificationToken(trimmedToken, User);

  if (!user) {
    const tokenHash = hashVerificationToken(trimmedToken);
    if (process.env.NODE_ENV !== "production") {
      console.log(
        `[VerifyEmail][debug] receivedPlain=${trimmedToken} computedHash=${tokenHash}`
      );
      const anyByEmail = await User.find({})
        .select("email emailVerified emailVerificationToken emailVerificationExpires")
        .sort({ createdAt: -1 })
        .limit(3)
        .lean();
      console.log(
        "[VerifyEmail][debug] last 3 users in DB:",
        JSON.stringify(anyByEmail, null, 2)
      );
    }
    const stale = await User.findOne({ emailVerificationToken: tokenHash });
    if (stale) {
      const expired =
        stale.emailVerificationExpires &&
        stale.emailVerificationExpires.getTime() <= Date.now();
      console.warn(
        `[VerifyEmail] Token matches user ${stale._id} but rejected (verified=${stale.emailVerified}, expired=${expired}).`
      );
      if (stale.emailVerified) {
        const { refreshToken, body } = buildAuthSuccessResponse(stale);
        setRefreshTokenCookie(res, refreshToken);
        return res.json(body);
      }
    } else {
      console.warn(
        `[VerifyEmail] No user matches the provided token (length=${trimmedToken.length}).`
      );
    }
    return res.status(400).json({
      error: "Invalid or expired verification link",
      code: "VERIFICATION_FAILED",
    });
  }

  if (!user.emailVerified) {
    user.emailVerified = true;
    user.emailVerificationExpires = undefined;
    await user.save();
  }

  const { refreshToken, body } = buildAuthSuccessResponse(user);
  setRefreshTokenCookie(res, refreshToken);
  res.json(body);
}

async function resendVerification(req, res) {
  const rawEmail = typeof req.body?.email === "string" ? req.body.email : "";
  const email = rawEmail.trim().toLowerCase();
  if (!email) {
    return res.status(400).json({ error: "Email is required" });
  }

  const genericResponse = {
    message: "If that email exists and is unverified, a new link has been sent.",
  };

  const user = await User.findOne({ email });
  if (!user || user.emailVerified) {
    if (user?.emailVerified) {
      return res.status(409).json({ error: "Email is already verified" });
    }
    return res.json(genericResponse);
  }

  const verificationToken = generateVerificationToken();
  user.emailVerificationToken = hashVerificationToken(verificationToken);
  user.emailVerificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);
  await user.save();

  if (!isEmailConfigured()) {
    console.warn(
      "[ResendVerification] SMTP not configured. Manual verify URL:",
      buildVerifyUrl(verificationToken)
    );
    if (process.env.NODE_ENV === "production") {
      return res.status(503).json({
        error: "Email is not configured on this server.",
        code: "SMTP_NOT_CONFIGURED",
      });
    }
    return res.json({
      ...genericResponse,
      emailSent: false,
    });
  }

  try {
    await sendVerificationEmail(user.email, verificationToken);
  } catch (err) {
    console.error("[ResendVerification] Send failed:", err?.message || err);
    return res.status(502).json({
      error: "Could not send verification email. Try again later.",
      code: "EMAIL_DELIVERY_FAILED",
    });
  }

  res.json({ ...genericResponse, emailSent: true });
}

module.exports = {
  signUp,
  signIn,
  refresh,
  logout,
  me,
  updateProfile,
  verifyEmail,
  resendVerification,
};
