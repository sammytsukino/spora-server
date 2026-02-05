const User = require("../models/User");
const Flora = require("../models/Flora");
const Report = require("../models/Report");
const AdminLog = require("../models/AdminLog");

async function logAdminAction({ req, action, actionCategory, targetType, targetId, targetDescription, details }) {
  await AdminLog.create({
    adminId: req.user._id,
    adminUsername: req.user.username,
    action,
    actionCategory,
    targetType,
    targetId,
    targetDescription,
    details,
    ipAddress: req.ip,
  });
}

async function getMetrics(req, res) {
  const totalFloras = await Flora.countDocuments();
  const totalUsers = await User.countDocuments({ accountStatus: "active" });
  const pendingReports = await Report.countDocuments({ status: "pending" });

  res.json({ totalFloras, totalUsers, pendingReports });
}

async function getUsage(req, res) {
  const florasByDay = await Flora.aggregate([
    {
      $group: {
        _id: {
          $dateToString: { format: "%Y-%m-%d", date: "$createdAt" },
        },
        count: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  const newUsersByWeek = await User.aggregate([
    {
      $group: {
        _id: {
          $dateToString: { format: "%Y-%U", date: "$createdAt" },
        },
        count: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  res.json({ florasByDay, newUsersByWeek });
}

async function listUsers(req, res) {
  const users = await User.find().sort({ createdAt: -1 });
  res.json(users);
}

async function updateUserRole(req, res) {
  const user = await User.findById(req.params.id);
  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }

  const { role, reason, additionalNotes } = req.body;
  if (!role) {
    return res.status(400).json({ error: "Missing role" });
  }

  user.role = role;
  await user.save();

  await logAdminAction({
    req,
    action: "user_role_update",
    actionCategory: "user_management",
    targetType: "user",
    targetId: user._id,
    targetDescription: user.username,
    details: { reason, additionalNotes },
  });

  res.json(user);
}

async function updateUserStatus(req, res) {
  const user = await User.findById(req.params.id);
  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }

  const { status, reason, additionalNotes } = req.body;
  if (!status) {
    return res.status(400).json({ error: "Missing status" });
  }

  user.accountStatus = status;
  await user.save();

  await logAdminAction({
    req,
    action: "user_status_update",
    actionCategory: "user_management",
    targetType: "user",
    targetId: user._id,
    targetDescription: user.username,
    details: { reason, additionalNotes },
  });

  res.json(user);
}

async function softDeleteUser(req, res) {
  const user = await User.findById(req.params.id);
  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }

  user.accountStatus = "deleted";
  user.isAnonymized = true;
  user.email = undefined;
  user.password = undefined;
  user.deletedAt = new Date();
  user.username = `deleted_user_${user._id.toString().slice(-6)}`;
  await user.save();

  await Flora.updateMany(
    { authorId: user._id },
    { $set: { isAuthorAnonymized: true, authorUsername: "Anonymous" } }
  );

  await logAdminAction({
    req,
    action: "user_soft_delete",
    actionCategory: "user_management",
    targetType: "user",
    targetId: user._id,
    targetDescription: user.username,
    details: { reason: req.body.reason, additionalNotes: req.body.additionalNotes },
  });

  res.status(204).send();
}

async function listReports(req, res) {
  const { status } = req.query;
  const filter = status ? { status } : {};
  const reports = await Report.find(filter).sort({ createdAt: -1 });
  res.json(reports);
}

async function updateReport(req, res) {
  const report = await Report.findById(req.params.id);
  if (!report) {
    return res.status(404).json({ error: "Report not found" });
  }

  const { status, action, adminNotes, reason } = req.body;
  if (status) {
    report.status = status;
  }
  report.resolution = report.resolution || {};
  report.resolution.resolvedBy = req.user._id;
  report.resolution.resolvedAt = new Date();
  report.resolution.action = action || report.resolution.action;
  report.resolution.adminNotes = adminNotes || report.resolution.adminNotes;
  await report.save();

  await logAdminAction({
    req,
    action: "report_update",
    actionCategory: "content_moderation",
    targetType: "report",
    targetId: report._id,
    targetDescription: report.reason || report.category,
    details: { reason, additionalNotes: adminNotes },
  });

  res.json(report);
}

async function listFlagged(req, res) {
  const flagged = await Flora.find({
    $or: [{ status: "hidden" }, { isHidden: true }],
  }).sort({ updatedAt: -1 });
  res.json(flagged);
}

async function updateFloraStatus(req, res) {
  const flora = await Flora.findById(req.params.id);
  if (!flora) {
    return res.status(404).json({ error: "Flora not found" });
  }

  const { status, isHidden, reason, additionalNotes } = req.body;
  if (status) {
    flora.status = status;
  }
  if (isHidden !== undefined) {
    flora.isHidden = isHidden;
  }
  await flora.save();

  await logAdminAction({
    req,
    action: "flora_status_update",
    actionCategory: "content_moderation",
    targetType: "flora",
    targetId: flora._id,
    targetDescription: flora.title,
    details: { reason, additionalNotes },
  });

  res.json(flora);
}

module.exports = {
  getMetrics,
  getUsage,
  listUsers,
  updateUserRole,
  updateUserStatus,
  softDeleteUser,
  listReports,
  updateReport,
  listFlagged,
  updateFloraStatus,
};
