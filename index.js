require('dotenv').config();
require('express-async-errors');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { connectDB } = require('./db');
const User = require('./models/User');
const Flora = require('./models/Flora');
const Report = require('./models/Report');
const AdminLog = require('./models/AdminLog');

const app = express();
connectDB();

// Middlewares
app.use(helmet());
app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));

// Función para firmar tokens
function signToken(user) {
  return jwt.sign(
    { sub: user._id.toString(), role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
}

// Middleware de autenticación
async function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing token' });
  }

  const token = header.replace('Bearer ', '').trim();
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
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

// Middleware de roles
function requireRole(...roles) {
  return (req, res, next) => {
    const userRole = req.user?.role;
    if (!userRole || !roles.includes(userRole)) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    next();
  };
}

// ============== RUTAS ==============

// Health check
app.get('/api/health', (req, res) => {
  res.json({ ok: true });
});

// ====== AUTH ======
app.post('/api/auth/signup', async (req, res) => {
  const { username, displayName, email, password } = req.body;
  if (!username || !email || !password) {
    return res.status(400).json({ error: 'Missing fields' });
  }

  const existing = await User.findOne({
    $or: [{ username }, { email: email.toLowerCase() }],
  });
  if (existing) {
    return res.status(409).json({ error: 'User already exists' });
  }

  const hash = await bcrypt.hash(password, 10);
  const user = await User.create({
    username,
    displayName,
    email: email.toLowerCase(),
    password: hash,
  });

  const token = signToken(user);
  res.status(201).json({
    token,
    user: {
      id: user._id,
      username: user.username,
      displayName: user.displayName,
      email: user.email,
      role: user.role,
    },
  });
});

app.post('/api/auth/signin', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Missing fields' });
  }

  const user = await User.findOne({ email: email.toLowerCase() });
  if (!user || user.accountStatus !== 'active') {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const ok = await bcrypt.compare(password, user.password);
  if (!ok) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  user.lastLoginAt = new Date();
  await user.save();

  const token = signToken(user);
  res.json({
    token,
    user: {
      id: user._id,
      username: user.username,
      displayName: user.displayName,
      email: user.email,
      role: user.role,
    },
  });
});

app.get('/api/auth/me', requireAuth, (req, res) => {
  const user = req.user;
  res.json({
    id: user._id,
    username: user.username,
    displayName: user.displayName,
    email: user.email,
    role: user.role,
    accountStatus: user.accountStatus,
  });
});

// ====== FLORAS ======
app.get('/api/floras', async (req, res) => {
  const { limit = 50, skip = 0, author, status } = req.query;
  const filter = { isHidden: false };
  if (author) filter.author = author;
  if (status) filter.status = status;

  const floras = await Flora.find(filter)
    .populate('author', 'username displayName')
    .sort({ createdAt: -1 })
    .limit(parseInt(limit))
    .skip(parseInt(skip));

  res.json(floras);
});

app.get('/api/floras/:id', async (req, res) => {
  const flora = await Flora.findOne({ _id: req.params.id, isHidden: false })
    .populate('author', 'username displayName');
  if (!flora) {
    return res.status(404).json({ error: 'Flora not found' });
  }
  res.json(flora);
});

app.post('/api/floras', requireAuth, requireRole('cultivator', 'admin'), async (req, res) => {
  const { title, text, status, generative } = req.body;
  if (!title || !text) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    const flora = await Flora.create({
      title,
      text,
      author: req.user._id,
      status: status || 'budding',
      generative,
    });

    const populated = await Flora.findById(flora._id)
      .populate('author', 'username displayName');
    res.status(201).json(populated);
  } catch (err) {
    if (err.name === 'ValidationError') {
      return res.status(400).json({ error: err.message });
    }
    throw err;
  }
});

app.patch('/api/floras/:id', requireAuth, requireRole('cultivator', 'admin'), async (req, res) => {
  const flora = await Flora.findById(req.params.id);
  if (!flora) {
    return res.status(404).json({ error: 'Flora not found' });
  }

  if (flora.author.toString() !== req.user._id.toString()) {
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
    const populated = await Flora.findById(flora._id)
      .populate('author', 'username displayName');
    res.json(populated);
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

  if (flora.author.toString() !== req.user._id.toString()) {
    return res.status(403).json({ error: 'Not authorized to delete this flora' });
  }

  await Flora.findByIdAndDelete(req.params.id);
  res.sendStatus(204);
});

// ====== REPORTS ======
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

// ====== ADMIN ======
app.get('/api/admin/metrics', requireAuth, requireRole('admin'), async (req, res) => {
  const [totalUsers, activeUsers, totalFloras, totalReports, pendingReports] = await Promise.all([
    User.countDocuments(),
    User.countDocuments({ accountStatus: 'active' }),
    Flora.countDocuments(),
    Report.countDocuments(),
    Report.countDocuments({ status: 'pending' }),
  ]);

  res.json({
    users: { total: totalUsers, active: activeUsers },
    floras: { total: totalFloras },
    reports: { total: totalReports, pending: pendingReports },
  });
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
    .skip(parseInt(skip));

  res.json(users);
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
  const floras = await Flora.find({ _id: { $in: flaggedFloraIds } })
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

// Manejo de errores
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

// Servidor
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
