require('dotenv').config({ path: require('path').join(__dirname, '.env') });
require('express-async-errors');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cloudinary = require('cloudinary').v2;
const { connectDB } = require('./db');

if (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
}
const User = require('./models/User');
const Flora = require('./src/models/Flora');
const Report = require('./models/Report');
const AdminLog = require('./models/AdminLog');

const app = express();
connectDB();

app.use(helmet());
app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));

const ACCESS_TOKEN_EXPIRY = '15m';
const REFRESH_TOKEN_EXPIRY = '7d';

function signAccessToken(user) {
  return jwt.sign(
    { sub: user._id.toString(), role: user.role, type: 'access' },
    process.env.JWT_SECRET,
    { expiresIn: ACCESS_TOKEN_EXPIRY }
  );
}

function signRefreshToken(user) {
  return jwt.sign(
    { sub: user._id.toString(), role: user.role, type: 'refresh' },
    process.env.JWT_SECRET,
    { expiresIn: REFRESH_TOKEN_EXPIRY }
  );
}

async function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing token' });
  }

  const token = header.replace('Bearer ', '').trim();
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    if (payload.type === 'refresh') {
      return res.status(401).json({ error: 'Invalid token' });
    }
    const user = await User.findById(payload.sub);
    if (!user || user.accountStatus !== 'active') {
      return res.status(401).json({ error: 'Invalid user' });
    }
    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    const userRole = req.user?.role;
    if (!userRole || !roles.includes(userRole)) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    next();
  };
}

app.get('/api/health', (req, res) => {
  res.json({ ok: true });
});

const userRoutes = require('./src/routes/users');
app.use('/api/users', userRoutes);

const { follow, unfollow, getFollowingIds, checkFollowStatus } = require('./src/controllers/followController');
const authMiddleware = require('./src/middleware/auth');
app.get('/api/follows/me/following', authMiddleware.requireAuth, getFollowingIds);
app.post('/api/follows/:userId', authMiddleware.requireAuth, follow);
app.delete('/api/follows/:userId', authMiddleware.requireAuth, unfollow);
app.get('/api/follows/:userId/status', authMiddleware.requireAuth, checkFollowStatus);

const { generateVerificationToken, sendVerificationEmail, sendVerificationEmailToUser } = require('./src/services/emailService');

app.post('/api/auth/signup', async (req, res) => {
  const { username, displayName, email, password } = req.body;
  if (!username || !email || !password) {
    return res.status(400).json({ error: 'Missing fields' });
  }

  const existing = await User.findOne({
    $or: [{ username }, { email: email.toLowerCase() }],
  });

  const hash = await bcrypt.hash(password, 10);
  const verificationToken = generateVerificationToken();
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + 48);

  let user;
  if (existing) {
    if (existing.emailVerified) {
      return res.status(409).json({ error: 'User already exists' });
    }
    existing.displayName = displayName || existing.displayName;
    existing.password = hash;
    existing.emailVerificationToken = verificationToken;
    existing.emailVerificationExpires = expiresAt;
    await existing.save();
    user = existing;
  } else {
    user = await User.create({
      username,
      displayName,
      email: email.toLowerCase(),
      password: hash,
      emailVerified: false,
      emailVerificationToken: verificationToken,
      emailVerificationExpires: expiresAt,
    });
  }

  await sendVerificationEmail(user.email, verificationToken);

  res.status(201).json({
    message: 'Check your email to verify your account',
    emailSent: true,
  });
});

function normalizeToken(token) {
  if (Array.isArray(token)) token = token[0];
  if (!token || typeof token !== 'string') return null;
  try {
    token = decodeURIComponent(String(token).trim());
  } catch {
    token = String(token).trim();
  }
  return token.length > 0 ? token : null;
}

async function handleVerifyEmail(token) {
  token = normalizeToken(token);
  if (!token) {
    return { status: 400, body: { error: 'Missing or invalid token' } };
  }

  const user = await User.findOne({
    emailVerificationToken: token,
    emailVerificationExpires: { $gt: new Date() },
  });

  if (!user) {
    const expiredUser = await User.findOne({ emailVerificationToken: token });
    if (expiredUser) {
      console.warn('[verify-email] Token expired for user:', expiredUser.email);
    } else {
      console.warn('[verify-email] No user found. Token length:', token.length, 'First 8 chars:', token.slice(0, 8));
    }
    return { status: 400, body: { error: 'Invalid or expired verification link', code: 'VERIFICATION_FAILED' } };
  }

  user.emailVerified = true;
  user.emailVerificationToken = undefined;
  user.emailVerificationExpires = undefined;
  await user.save();

  const accessToken = signAccessToken(user);
  const refreshToken = signRefreshToken(user);
  return {
    status: 200,
    body: {
      success: true,
      token: accessToken,
      refreshToken,
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

app.get('/api/auth/verify-email', async (req, res) => {
  const result = await handleVerifyEmail(req.query.token);
  res.status(result.status).json(result.body);
});

app.post('/api/auth/verify-email', async (req, res) => {
  const result = await handleVerifyEmail(req.body?.token);
  res.status(result.status).json(result.body);
});

app.post('/api/auth/resend-verification', async (req, res) => {
  const { email } = req.body;
  if (!email || typeof email !== 'string') {
    return res.status(400).json({ error: 'Email required' });
  }
  const user = await User.findOne({ email: email.toLowerCase().trim() });
  if (!user) {
    return res.status(404).json({ error: 'No account found with that email' });
  }
  if (user.emailVerified) {
    return res.status(400).json({ error: 'Email already verified. You can sign in.' });
  }
  await sendVerificationEmailToUser(user);
  res.json({ message: 'Verification email sent. Check your inbox and spam folder.' });
});

app.post('/api/auth/signin', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Missing fields' });
  }

  const user = await User.findOne({ username: String(username).trim() });
  if (!user || user.accountStatus !== 'active') {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  if (user.emailVerified === false && user.role !== 'admin') {
    return res.status(403).json({
      error: 'Email not verified',
      code: 'EMAIL_NOT_VERIFIED',
    });
  }

  const ok = await bcrypt.compare(password, user.password);
  if (!ok) {
    return res.status(401).json({ error: 'Invalid credentials' });
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
});

app.post('/api/auth/refresh', async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken || typeof refreshToken !== 'string') {
    return res.status(400).json({ error: 'Missing refresh token' });
  }
  try {
    const payload = jwt.verify(refreshToken.trim(), process.env.JWT_SECRET);
    if (payload.type !== 'refresh') {
      return res.status(401).json({ error: 'Invalid refresh token' });
    }
    const user = await User.findById(payload.sub);
    if (!user || user.accountStatus !== 'active') {
      return res.status(401).json({ error: 'Invalid user' });
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
        email: user.email,
        role: user.role,
      },
    });
  } catch (err) {
    return res.status(401).json({ error: 'Invalid refresh token' });
  }
});

app.get('/api/auth/me', requireAuth, (req, res) => {
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
  });
});

app.patch('/api/auth/me', requireAuth, async (req, res) => {
  const user = req.user;
  const { displayName, bio, avatar, avatarData } = req.body;

  if (displayName !== undefined) {
    user.displayName = typeof displayName === 'string' ? displayName.trim() : displayName;
  }
  if (bio !== undefined) {
    user.bio = typeof bio === 'string' ? bio.trim().slice(0, 500) : bio;
  }

  if (avatarData && typeof avatarData === 'string') {
    const hasCloudinary =
      process.env.CLOUDINARY_CLOUD_NAME &&
      process.env.CLOUDINARY_API_KEY &&
      process.env.CLOUDINARY_API_SECRET;
    if (hasCloudinary) {
      try {
        const publicId = `spora/avatars/${user._id}_${Date.now()}`;
        const result = await cloudinary.uploader.upload(avatarData, {
          folder: 'spora/avatars',
          public_id: publicId.split('/').pop(),
          resource_type: 'image',
        });
        if (result?.secure_url) {
          user.avatar = result.secure_url;
        }
      } catch (err) {
        console.warn('Cloudinary avatar upload failed:', err?.message || err);
      }
    }
  } else if (avatar !== undefined && typeof avatar === 'string') {
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
});

app.post('/api/auth/me/unsign', requireAuth, async (req, res) => {
  const user = req.user;
  const suffix = `_${user._id.toString().slice(-8)}`;
  user.username = `[forbidden_author]${suffix}`;
  user.displayName = '[forbidden_author]';
  user.bio = '';
  user.avatar = undefined;
  user.email = `forbidden_author${suffix}@anonymized.local`;
  await user.save();

  const result = await Flora.updateMany(
    { authorId: user._id },
    { $set: { authorUsername: '[forbidden_author]', isAuthorAnonymized: true } }
  );

  res.json({ florasAnonymized: result.modifiedCount });
});

const { optionalAuth } = require('./src/middleware/auth');
const Follow = require('./src/models/Follow');

app.get('/api/floras', optionalAuth, async (req, res) => {
  const { limit = 50, skip = 0, author, authorId, status, generation, includeHidden, followingOnly } = req.query;
  const filter = { isDeleted: { $ne: true } };
  if (includeHidden !== 'true') filter.isHidden = false;
  const authorFilter = authorId || author;
  if (authorFilter) filter.authorId = authorFilter;
  if (status) filter.status = status;
  if (generation !== undefined) filter['lineage.generation'] = Number(generation);

  if (followingOnly === 'true' || followingOnly === true) {
    if (!req.user) {
      return res.status(401).json({ error: 'Sign in to see floras from people you follow' });
    }
    const follows = await Follow.find({ followerId: req.user._id }).select('followingId').lean();
    const followedIds = follows.map((f) => f.followingId);
    if (followedIds.length === 0) return res.json([]);
    filter.authorId = { $in: followedIds };
  }

  const floras = await Flora.find(filter)
    .populate('authorId', 'username displayName')
    .sort({ createdAt: -1 })
    .limit(parseInt(limit))
    .skip(parseInt(skip))
    .lean();

  const normalized = floras.map((f) => {
    const authorName = f.isAuthorAnonymized || f.authorUsername
      ? (f.authorUsername || '@Anonymous')
      : (f.authorId?.username ? (f.authorId.username.startsWith('@') ? f.authorId.username : `@${f.authorId.username}`) : '@Anonymous');
    return { ...f, authorUsername: authorName };
  });

  res.json(normalized);
});

app.get('/api/floras/:id', async (req, res) => {
  const flora = await Flora.findOne({ _id: req.params.id, isHidden: { $ne: true }, isDeleted: { $ne: true } })
    .populate('authorId', 'username displayName');
  if (!flora) {
    return res.status(404).json({ error: 'Flora not found' });
  }
  res.json(flora);
});

app.post('/api/floras', requireAuth, requireRole('cultivator', 'admin'), async (req, res) => {
  const { title, text, status, generative, lineage, coAuthors, license, thumbnailData } = req.body;
  if (!title || !text) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  let thumbnailUrl = null;
  if (thumbnailData && process.env.CLOUDINARY_CLOUD_NAME) {
    try {
      const result = await cloudinary.uploader.upload(thumbnailData, {
        folder: 'spora/floras',
        public_id: `thumb_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
        resource_type: 'image',
      });
      thumbnailUrl = result.secure_url;
    } catch (uploadErr) {
      console.warn('Cloudinary upload failed:', uploadErr.message);
    }
  }

  const payload = {
    title,
    text,
    authorId: req.user._id,
    authorUsername: req.user.username,
    isAuthorAnonymized: false,
    coAuthors: Array.isArray(coAuthors) ? coAuthors : [],
    lineage: lineage || { generation: 0, childrenCount: 0 },
    status: status === 'sealed' ? 'sealed' : (status || 'blossoming'),
    isHidden: false,
    generative: generative || {},
    license: license || {},
    ...(thumbnailUrl && { thumbnailUrl }),
  };

  if (payload.status === 'sealed') {
    payload.publishedAt = new Date();
    payload.sealedAt = new Date();
  } else {
    payload.publishedAt = new Date();
  }

  try {
    const flora = await Flora.create(payload);

    if (payload.lineage?.parentFloraId) {
      try {
        await Flora.findByIdAndUpdate(payload.lineage.parentFloraId, {
          $inc: { 'lineage.childrenCount': 1 },
        });
      } catch (updateErr) {
        console.warn('Failed to update parent childrenCount:', updateErr.message);
      }
    }

    res.status(201).json(flora);
  } catch (err) {
    console.error('Flora create error:', err);
    if (err.name === 'ValidationError') {
      return res.status(400).json({ error: err.message });
    }
    const msg = process.env.NODE_ENV !== 'production' ? err.message : 'Internal server error';
    return res.status(500).json({ error: msg });
  }
});

app.patch('/api/floras/:id', requireAuth, requireRole('cultivator', 'admin'), async (req, res) => {
  const flora = await Flora.findById(req.params.id);
  if (!flora) {
    return res.status(404).json({ error: 'Flora not found' });
  }

  if (flora.authorId?.toString() !== req.user._id.toString()) {
    return res.status(403).json({ error: 'Not authorized to edit this flora' });
  }

  const { title, text, status, generative } = req.body;
  if (title !== undefined) flora.title = title;
  if (text !== undefined) flora.text = text;
  if (status !== undefined) flora.status = status;
  if (generative !== undefined) flora.generative = generative;
  flora.updatedAt = new Date();

  try {
    await flora.save();
    res.json(flora);
  } catch (err) {
    if (err.name === 'ValidationError') {
      return res.status(400).json({ error: err.message });
    }
    throw err;
  }
});

app.delete('/api/floras/:id', requireAuth, requireRole('cultivator', 'admin'), async (req, res) => {
  const flora = await Flora.findById(req.params.id);
  if (!flora) {
    return res.status(404).json({ error: 'Flora not found' });
  }

  if (flora.authorId?.toString() !== req.user._id.toString()) {
    return res.status(403).json({ error: 'Not authorized to delete this flora' });
  }

  await Flora.findByIdAndDelete(req.params.id);
  res.sendStatus(204);
});
app.post('/api/reports', requireAuth, async (req, res) => {
  const { reportedFloraId, category, reason, description } = req.body;
  if (!reportedFloraId || !category || !reason) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const flora = await Flora.findById(reportedFloraId);
  if (!flora) {
    return res.status(404).json({ error: 'Flora not found' });
  }

  try {
    const report = await Report.create({
      reportedBy: req.user._id,
      reportedFlora: reportedFloraId,
      category,
      reason,
      description,
    });

    const populated = await Report.findById(report._id)
      .populate('reportedBy', 'username')
      .populate('reportedFlora', 'title author');
    res.status(201).json(populated);
  } catch (err) {
    if (err.name === 'ValidationError') {
      return res.status(400).json({ error: err.message });
    }
    throw err;
  }
});

app.get('/api/admin/floras', requireAuth, requireRole('admin'), async (req, res) => {
  const { limit = 100, skip = 0, status, hidden } = req.query;
  const filter = { isDeleted: { $ne: true } };
  if (status) filter.status = status;
  if (hidden === 'true') filter.isHidden = true;
  if (hidden === 'false') filter.isHidden = false;

  const floras = await Flora.find(filter)
    .populate('authorId', 'username displayName')
    .sort({ createdAt: -1 })
    .limit(parseInt(limit))
    .skip(parseInt(skip))
    .lean();

  const withAuthorDisplay = floras.map((f) => {
    const authorName = f.isAuthorAnonymized || f.authorUsername
      ? (f.authorUsername || '@Anonymous')
      : (f.authorId?.username ? (f.authorId.username.startsWith('@') ? f.authorId.username : `@${f.authorId.username}`) : '@Anonymous');
    return { ...f, authorUsername: authorName };
  });

  res.json(withAuthorDisplay);
});

app.patch('/api/admin/floras/batch', requireAuth, requireRole('admin'), async (req, res) => {
  const { ids = [], action } = req.body;
  if (!Array.isArray(ids) || ids.length === 0 || !action) {
    return res.status(400).json({ error: 'Missing ids or action' });
  }
  if (!['hide', 'unhide', 'delete'].includes(action)) {
    return res.status(400).json({ error: 'Invalid action' });
  }
  const results = { updated: 0, failed: [] };
  for (const id of ids) {
    try {
      const flora = await Flora.findById(id);
      if (!flora || flora.isDeleted) {
        results.failed.push(id);
        continue;
      }
      if (action === 'hide') {
        flora.isHidden = true;
        await flora.save();
      } else if (action === 'unhide') {
        flora.isHidden = false;
        await flora.save();
      } else if (action === 'delete') {
        flora.isHidden = true;
        flora.isDeleted = true;
        flora.deletedAt = new Date();
        await flora.save();
      }
      results.updated++;
      await AdminLog.create({
        admin: req.user._id,
        action: `flora_batch_${action}`,
        targetType: 'flora',
        targetId: flora._id,
        reason: action,
      });
    } catch {
      results.failed.push(id);
    }
  }
  res.json(results);
});

app.get('/api/admin/metrics', requireAuth, requireRole('admin'), async (req, res) => {
  const [
    totalUsers,
    activeUsers,
    totalFloras,
    blossomingFloras,
    sealedFloras,
    hiddenFloras,
    totalReports,
    pendingReports,
  ] = await Promise.all([
    User.countDocuments(),
    User.countDocuments({ accountStatus: 'active' }),
    Flora.countDocuments(),
    Flora.countDocuments({ status: 'blossoming' }),
    Flora.countDocuments({ status: 'sealed' }),
    Flora.countDocuments({ isHidden: true }),
    Report.countDocuments(),
    Report.countDocuments({ status: 'pending' }),
  ]);

  const flaggedCount = await Report.distinct('reportedFlora', { status: 'pending' }).then((ids) => ids.length);

  const now = new Date();
  const sevenDaysAgo = new Date(now);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const fourteenDaysAgo = new Date(now);
  fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

  const [usersLast7d, usersPrev7d, florasLast7d, florasPrev7d] = await Promise.all([
    User.countDocuments({ createdAt: { $gte: sevenDaysAgo } }),
    User.countDocuments({ createdAt: { $gte: fourteenDaysAgo, $lt: sevenDaysAgo } }),
    Flora.countDocuments({ createdAt: { $gte: sevenDaysAgo } }),
    Flora.countDocuments({ createdAt: { $gte: fourteenDaysAgo, $lt: sevenDaysAgo } }),
  ]);

  res.json({
    users: { total: totalUsers, active: activeUsers },
    floras: {
      total: totalFloras,
      blossoming: blossomingFloras,
      sealed: sealedFloras,
      hidden: hiddenFloras,
    },
    reports: { total: totalReports, pending: pendingReports },
    flaggedContent: flaggedCount,
    growth: {
      usersLast7Days: usersLast7d,
      usersPrev7Days: usersPrev7d,
      usersGrowth: usersPrev7d > 0 ? Math.round(((usersLast7d - usersPrev7d) / usersPrev7d) * 100) : (usersLast7d > 0 ? 100 : 0),
      florasLast7Days: florasLast7d,
      florasPrev7Days: florasPrev7d,
      florasGrowth: florasPrev7d > 0 ? Math.round(((florasLast7d - florasPrev7d) / florasPrev7d) * 100) : (florasLast7d > 0 ? 100 : 0),
    },
  });
});

app.get('/api/admin/usage/charts', requireAuth, requireRole('admin'), async (req, res) => {
  const now = new Date();
  const florasByDay = [];
  const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    d.setHours(0, 0, 0, 0);
    const next = new Date(d);
    next.setDate(next.getDate() + 1);
    const count = await Flora.countDocuments({
      createdAt: { $gte: d, $lt: next },
    });
    florasByDay.push({ label: dayLabels[d.getDay()], value: count });
  }

  const newUsersByWeek = [];
  for (let w = 3; w >= 0; w--) {
    const start = new Date(now);
    start.setDate(start.getDate() - (w + 1) * 7);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 7);
    const count = await User.countDocuments({
      createdAt: { $gte: start, $lt: end },
    });
    newUsersByWeek.push({ label: `W${4 - w}`, value: count });
  }

  res.json({ florasByDay, newUsersByWeek });
});

app.get('/api/admin/usage', requireAuth, requireRole('admin'), async (req, res) => {
  const { days = 30 } = req.query;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - parseInt(days));

  const [newUsers, newFloras, newReports] = await Promise.all([
    User.countDocuments({ createdAt: { $gte: cutoff } }),
    Flora.countDocuments({ createdAt: { $gte: cutoff } }),
    Report.countDocuments({ createdAt: { $gte: cutoff } }),
  ]);

  res.json({
    period: `${days} days`,
    newUsers,
    newFloras,
    newReports,
  });
});

app.get('/api/admin/users', requireAuth, requireRole('admin'), async (req, res) => {
  const { limit = 50, skip = 0, role, status } = req.query;
  const filter = {};
  if (role) filter.role = role;
  if (status) filter.accountStatus = status;

  const users = await User.find(filter)
    .select('-password')
    .sort({ createdAt: -1 })
    .limit(parseInt(limit))
    .skip(parseInt(skip))
    .lean();

  const usersWithCounts = await Promise.all(
    users.map(async (u) => {
      const florasCount = await Flora.countDocuments({ authorId: u._id });
      return { ...u, florasCount };
    })
  );

  res.json(usersWithCounts);
});

app.patch('/api/admin/users/:id/role', requireAuth, requireRole('admin'), async (req, res) => {
  const { role, reason } = req.body;
  if (!role || !['cultivator', 'admin'].includes(role)) {
    return res.status(400).json({ error: 'Invalid role' });
  }

  const user = await User.findById(req.params.id);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  user.role = role;
  await user.save();

  await AdminLog.create({
    admin: req.user._id,
    action: 'role_change',
    targetType: 'user',
    targetId: user._id,
    reason,
    metadata: { newRole: role },
  });

  res.json({ id: user._id, username: user.username, role: user.role });
});

app.patch('/api/admin/users/:id/status', requireAuth, requireRole('admin'), async (req, res) => {
  const { status, reason } = req.body;
  if (!status || !['active', 'suspended', 'deleted'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }

  const user = await User.findById(req.params.id);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  user.accountStatus = status;
  await user.save();

  await AdminLog.create({
    admin: req.user._id,
    action: 'status_change',
    targetType: 'user',
    targetId: user._id,
    reason,
    metadata: { newStatus: status },
  });

  res.json({ id: user._id, username: user.username, accountStatus: user.accountStatus });
});

app.post('/api/admin/users/:id/unsign', requireAuth, requireRole('admin'), async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  const result = await Flora.updateMany(
    { authorId: user._id },
    { $set: { authorUsername: '@Anonymous', isAuthorAnonymized: true } }
  );

  await AdminLog.create({
    admin: req.user._id,
    action: 'user_unsign',
    targetType: 'user',
    targetId: user._id,
    reason: req.body.reason,
    metadata: { florasAnonymized: result.modifiedCount },
  });

  res.json({ florasAnonymized: result.modifiedCount });
});

app.delete('/api/admin/users/:id', requireAuth, requireRole('admin'), async (req, res) => {
  const { reason } = req.body;
  const user = await User.findById(req.params.id);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  user.accountStatus = 'deleted';
  await user.save();

  await AdminLog.create({
    admin: req.user._id,
    action: 'user_soft_delete',
    targetType: 'user',
    targetId: user._id,
    reason,
  });

  res.sendStatus(204);
});

app.get('/api/admin/reports', requireAuth, requireRole('admin'), async (req, res) => {
  const { limit = 50, skip = 0, status } = req.query;
  const filter = {};
  if (status) filter.status = status;

  const reports = await Report.find(filter)
    .populate('reportedBy', 'username')
    .populate('reportedFlora', 'title author')
    .populate('reviewedBy', 'username')
    .sort({ createdAt: -1 })
    .limit(parseInt(limit))
    .skip(parseInt(skip));

  res.json(reports);
});

app.patch('/api/admin/reports/:id', requireAuth, requireRole('admin'), async (req, res) => {
  const { status, action, adminNotes } = req.body;
  const report = await Report.findById(req.params.id);
  if (!report) {
    return res.status(404).json({ error: 'Report not found' });
  }

  if (status) report.status = status;
  if (action) report.action = action;
  if (adminNotes) report.adminNotes = adminNotes;
  report.reviewedBy = req.user._id;
  report.reviewedAt = new Date();

  await report.save();

  await AdminLog.create({
    admin: req.user._id,
    action: 'report_review',
    targetType: 'report',
    targetId: report._id,
    metadata: { status, action },
  });

  const populated = await Report.findById(report._id)
    .populate('reportedBy', 'username')
    .populate('reportedFlora', 'title author')
    .populate('reviewedBy', 'username');

  res.json(populated);
});

app.get('/api/admin/flagged', requireAuth, requireRole('admin'), async (req, res) => {
  const { limit = 50, skip = 0 } = req.query;

  const flaggedFloraIds = await Report.distinct('reportedFlora', { status: 'pending' });
  const floras = await Flora.find({
    _id: { $in: flaggedFloraIds },
    isDeleted: { $ne: true },
  })
    .populate('author', 'username displayName')
    .sort({ createdAt: -1 })
    .limit(parseInt(limit))
    .skip(parseInt(skip));

  const florasWithReports = await Promise.all(
    floras.map(async (flora) => {
      const reportCount = await Report.countDocuments({
        reportedFlora: flora._id,
        status: 'pending',
      });
      return {
        ...flora.toObject(),
        reportCount,
      };
    })
  );

  res.json(florasWithReports);
});

app.patch('/api/admin/floras/:id/status', requireAuth, requireRole('admin'), async (req, res) => {
  const { status, isHidden, reason } = req.body;
  const flora = await Flora.findById(req.params.id);
  if (!flora) {
    return res.status(404).json({ error: 'Flora not found' });
  }

  if (status !== undefined) flora.status = status;
  if (isHidden !== undefined) flora.isHidden = isHidden;
  flora.updatedAt = new Date();

  await flora.save();

  await AdminLog.create({
    admin: req.user._id,
    action: 'flora_moderation',
    targetType: 'flora',
    targetId: flora._id,
    reason,
    metadata: { status, isHidden },
  });

  const populated = await Flora.findById(flora._id)
    .populate('author', 'username displayName');
  res.json(populated);
});

app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
