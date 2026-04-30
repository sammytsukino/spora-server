const Report = require("../models/Report");
const User = require("../models/User");
const { sendAdminNewReportEmail } = require("../services/emailService");

async function createReport(req, res) {
  const { reportedFloraId, reason, category, description } = req.body;
  if (!reportedFloraId || !category) {
    return res.status(400).json({ error: "Missing fields" });
  }

  const report = await Report.create({
    reportedFloraId,
    reportedBy: req.user._id,
    source: "user",
    reason,
    category,
    description,
  });

  try {
    const [admins, reporter] = await Promise.all([
      User.find({
        role: "admin",
        accountStatus: "active",
        email: { $exists: true, $ne: null },
      })
        .select("email")
        .lean(),
      User.findById(req.user._id).select("username").lean(),
    ]);
    const recipients = admins
      .map((adminUser) => adminUser.email)
      .filter((email) => typeof email === "string" && email.trim() !== "");
    if (recipients.length > 0) {
      await sendAdminNewReportEmail({
        recipients,
        reportId: String(report._id),
        reportedFloraId: String(report.reportedFloraId),
        category: report.category,
        reason: report.reason,
        reportedByUsername: reporter?.username || undefined,
      });
    }
  } catch (err) {
    console.warn("[Report] Failed to send admin notification email:", err?.message || err);
  }

  res.status(201).json(report);
}

module.exports = { createReport };
