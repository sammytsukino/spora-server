const Report = require("../models/Report");

async function createReport(req, res) {
  const { reportedFloraId, reason, category, description } = req.body;
  if (!reportedFloraId || !category) {
    return res.status(400).json({ error: "Missing fields" });
  }

  const report = await Report.create({
    reportedFloraId,
    reportedBy: req.user._id,
    reason,
    category,
    description,
  });

  res.status(201).json(report);
}

module.exports = { createReport };
