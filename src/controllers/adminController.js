const mongoose = require("mongoose");
const User = require("../models/User");
const Flora = require("../models/Flora");
const Report = require("../models/Report");
const AdminLog = require("../models/AdminLog");

function normalizeReportForAdminJson(report) {
  if (!report) return null;
  const obj = report.toObject ? report.toObject() : report;
  return {
    ...obj,
    reportedFlora: obj.reportedFloraId,
  };
}

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

async function logAdminActionSafe(payload) {
  try {
    await logAdminAction(payload);
  } catch (err) {
    console.error("[admin] AdminLog write failed:", err?.message || err);
  }
}

async function getMetrics(req, res) {
  const floraBaseFilter = { isDeleted: { $ne: true } };
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
    User.countDocuments({ accountStatus: "active" }),
    Flora.countDocuments(floraBaseFilter),
    Flora.countDocuments({ ...floraBaseFilter, status: "blossoming" }),
    Flora.countDocuments({ ...floraBaseFilter, status: "sealed" }),
    Flora.countDocuments({ ...floraBaseFilter, isHidden: true }),
    Report.countDocuments(),
    Report.countDocuments({ status: "pending" }),
  ]);

  const flaggedIds = await Report.distinct("reportedFloraId", {
    status: "pending",
  });
  const flaggedContent = flaggedIds.length;

  res.json({
    users: { total: totalUsers, active: activeUsers },
    floras: {
      total: totalFloras,
      blossoming: blossomingFloras,
      sealed: sealedFloras,
      hidden: hiddenFloras,
    },
    reports: { total: totalReports, pending: pendingReports },
    flaggedContent,
  });
}

async function getUsage(req, res) {
  const florasByDay = await Flora.aggregate([
    { $match: { isDeleted: { $ne: true } } },
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

async function getUsageCharts(req, res) {
  const now = new Date();
  const dayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const florasByDay = [];
  for (let dayOffset = 6; dayOffset >= 0; dayOffset--) {
    const dayStart = new Date(now);
    dayStart.setDate(dayStart.getDate() - dayOffset);
    dayStart.setHours(0, 0, 0, 0);
    const nextDayStart = new Date(dayStart);
    nextDayStart.setDate(nextDayStart.getDate() + 1);
    const count = await Flora.countDocuments({
      isDeleted: { $ne: true },
      createdAt: { $gte: dayStart, $lt: nextDayStart },
    });
    florasByDay.push({ label: dayLabels[dayStart.getDay()], value: count });
  }

  const newUsersByWeek = [];
  for (let weekOffset = 3; weekOffset >= 0; weekOffset--) {
    const start = new Date(now);
    start.setDate(start.getDate() - (weekOffset + 1) * 7);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 7);
    const count = await User.countDocuments({
      createdAt: { $gte: start, $lt: end },
    });
    newUsersByWeek.push({ label: `W${4 - weekOffset}`, value: count });
  }

  res.json({ florasByDay, newUsersByWeek });
}

async function listUsers(req, res) {
  const { limit = 50, skip = 0, role, status } = req.query;
  const filter = {};
  if (role) filter.role = role;
  if (status) filter.accountStatus = status;

  const users = await User.find(filter)
    .select("-password")
    .sort({ createdAt: -1 })
    .limit(parseInt(limit) || 50)
    .skip(parseInt(skip) || 0)
    .lean();

  const usersWithCounts = await Promise.all(
    users.map(async (userDoc) => {
      const florasCount = await Flora.countDocuments({ authorId: userDoc._id });
      return { ...userDoc, florasCount };
    })
  );

  res.json(usersWithCounts);
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

  await logAdminActionSafe({
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

  await logAdminActionSafe({
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

  await logAdminActionSafe({
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
  const { limit = 50, skip = 0, status } = req.query;
  const filter = status ? { status } : {};

  const reports = await Report.find(filter)
    .populate("reportedBy", "username")
    .populate("reportedFloraId", "title authorUsername")
    .populate("resolution.resolvedBy", "username")
    .sort({ createdAt: -1 })
    .limit(parseInt(limit) || 50)
    .skip(parseInt(skip) || 0);

  const normalized = reports.map((reportDoc) => normalizeReportForAdminJson(reportDoc));

  res.json(normalized);
}

async function getReportSignal(req, res) {
  const [pendingCount, latestPending] = await Promise.all([
    Report.countDocuments({ status: "pending" }),
    Report.findOne({ status: "pending" }).sort({ createdAt: -1 }).select("createdAt").lean(),
  ]);
  res.json({
    pendingCount,
    latestPendingAt: latestPending?.createdAt || null,
  });
}

async function updateReport(req, res) {
  const rawId = (req.params.id && String(req.params.id).trim()) || "";
  if (!mongoose.Types.ObjectId.isValid(rawId)) {
    return res.status(400).json({ error: "Invalid report id" });
  }

  const { status, action, adminNotes, reason } = req.body;
  const $set = {
    "resolution.resolvedBy": req.user._id,
    "resolution.resolvedAt": new Date(),
  };
  if (status) {
    $set.status = status;
  }
  if (action !== undefined && action !== null && action !== "") {
    $set["resolution.action"] = action;
  }
  if (adminNotes !== undefined) {
    $set["resolution.adminNotes"] = adminNotes;
  }

  const report = await Report.findByIdAndUpdate(rawId, { $set }, { new: true, runValidators: true })
    .populate("reportedBy", "username")
    .populate("reportedFloraId", "title authorUsername")
    .populate("resolution.resolvedBy", "username");

  if (!report) {
    return res.status(404).json({ error: "Report not found" });
  }

  await logAdminActionSafe({
    req,
    action: "report_update",
    actionCategory: "content_moderation",
    targetType: "report",
    targetId: report._id,
    targetDescription: report.reason || report.category,
    details: { reason, additionalNotes: adminNotes },
  });

  res.json(normalizeReportForAdminJson(report));
}

async function listFlagged(req, res) {
  const { limit = 50, skip = 0 } = req.query;

  const flaggedFloraIds = await Report.distinct("reportedFloraId", {
    status: "pending",
  });

  const floras = await Flora.find({
    _id: { $in: flaggedFloraIds },
    isDeleted: { $ne: true },
  })
    .populate("authorId", "username displayName")
    .sort({ createdAt: -1 })
    .limit(parseInt(limit) || 50)
    .skip(parseInt(skip) || 0)
    .lean();

  const florasWithReports = await Promise.all(
    floras.map(async (floraDoc) => {
      const reportCount = await Report.countDocuments({
        reportedFloraId: floraDoc._id,
        status: "pending",
      });
      return { ...floraDoc, reportCount, author: floraDoc.authorId };
    })
  );

  res.json(florasWithReports);
}

async function listAdminFloras(req, res) {
  const { limit = 100, skip = 0, status, hidden } = req.query;
  const filter = { isDeleted: { $ne: true } };
  if (status) filter.status = status;
  if (hidden === "true") filter.isHidden = true;
  if (hidden === "false") filter.isHidden = false;

  const floras = await Flora.find(filter)
    .populate("authorId", "username displayName")
    .sort({ createdAt: -1 })
    .limit(parseInt(String(limit), 10) || 100)
    .skip(parseInt(String(skip), 10) || 0)
    .lean();

  const withAuthorDisplay = floras.map((floraDoc) => {
    const authorName =
      floraDoc.isAuthorAnonymized || floraDoc.authorUsername
        ? floraDoc.authorUsername || "@Anonymous"
        : floraDoc.authorId?.username
          ? floraDoc.authorId.username.startsWith("@")
            ? floraDoc.authorId.username
            : `@${floraDoc.authorId.username}`
          : "@Anonymous";
    return { ...floraDoc, authorUsername: authorName };
  });

  res.json(withAuthorDisplay);
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

  await logAdminActionSafe({
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

async function batchUpdateFloras(req, res) {
  const { ids = [], action } = req.body;
  if (!Array.isArray(ids) || ids.length === 0 || !action) {
    return res.status(400).json({ error: "Missing ids or action" });
  }
  if (!["hide", "unhide", "delete"].includes(action)) {
    return res.status(400).json({ error: "Invalid action" });
  }

  const results = { updated: 0, failed: [] };
  for (const id of ids) {
    try {
      const flora = await Flora.findById(id);
      if (!flora || flora.isDeleted) {
        results.failed.push(id);
        continue;
      }
      if (action === "hide") {
        flora.isHidden = true;
        await flora.save();
      } else if (action === "unhide") {
        if (flora.isDeleted) {
          results.failed.push(id);
          continue;
        }
        flora.isHidden = false;
        await flora.save();
      } else if (action === "delete") {
        await Report.deleteMany({ reportedFloraId: flora._id });
        await flora.deleteOne();
      }
      results.updated++;
      await logAdminActionSafe({
        req,
        action: `flora_batch_${action}`,
        actionCategory: "content_moderation",
        targetType: "flora",
        targetId: flora._id,
        targetDescription: flora.title,
        details: { batchAction: action },
      });
    } catch {
      results.failed.push(id);
    }
  }
  res.json(results);
}

async function batchUpdateReports(req, res) {
  const { ids = [], action } = req.body;
  if (!Array.isArray(ids) || ids.length === 0 || !action) {
    return res.status(400).json({ error: "Missing ids or action" });
  }
  if (!["resolve", "dismiss"].includes(action)) {
    return res.status(400).json({ error: "Invalid action" });
  }

  const status = action === "resolve" ? "resolved" : "dismissed";
  const results = { updated: 0, failed: [] };
  for (const id of ids) {
    try {
      if (!mongoose.Types.ObjectId.isValid(String(id).trim())) {
        results.failed.push(id);
        continue;
      }
      const report = await Report.findByIdAndUpdate(
        String(id).trim(),
        {
          $set: {
            status,
            "resolution.resolvedBy": req.user._id,
            "resolution.resolvedAt": new Date(),
          },
        },
        { new: true, runValidators: true }
      );
      if (!report) {
        results.failed.push(id);
        continue;
      }
      results.updated++;
      await logAdminActionSafe({
        req,
        action: `report_batch_${action}`,
        actionCategory: "content_moderation",
        targetType: "report",
        targetId: report._id,
        targetDescription: report.reason || report.category,
        details: { batchAction: action },
      });
    } catch {
      results.failed.push(id);
    }
  }
  res.json(results);
}

async function batchUpdateUsers(req, res) {
  const { ids = [], action } = req.body;
  if (!Array.isArray(ids) || ids.length === 0 || !action) {
    return res.status(400).json({ error: "Missing ids or action" });
  }
  if (!["suspend", "ban", "activate"].includes(action)) {
    return res.status(400).json({ error: "Invalid action" });
  }

  const statusMap = {
    suspend: "suspended",
    ban: "deleted",
    activate: "active",
  };
  const status = statusMap[action];
  const results = { updated: 0, failed: [] };
  for (const id of ids) {
    try {
      const user = await User.findById(id);
      if (!user) {
        results.failed.push(id);
        continue;
      }
      user.accountStatus = status;
      await user.save();
      results.updated++;
      await logAdminActionSafe({
        req,
        action: `user_batch_${action}`,
        actionCategory: "user_management",
        targetType: "user",
        targetId: user._id,
        targetDescription: user.username,
        details: { batchAction: action },
      });
    } catch {
      results.failed.push(id);
    }
  }
  res.json(results);
}

module.exports = {
  getMetrics,
  getUsage,
  getUsageCharts,
  listUsers,
  updateUserRole,
  updateUserStatus,
  softDeleteUser,
  listReports,
  getReportSignal,
  updateReport,
  listFlagged,
  listAdminFloras,
  updateFloraStatus,
  batchUpdateFloras,
  batchUpdateReports,
  batchUpdateUsers,
};
