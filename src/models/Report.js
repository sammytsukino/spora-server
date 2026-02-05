const mongoose = require("mongoose");

const reportSchema = new mongoose.Schema(
  {
    reportedFloraId: { type: mongoose.Schema.Types.ObjectId, ref: "Flora" },
    reportedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    reason: { type: String },
    category: {
      type: String,
      enum: ["spam", "inappropriate", "copyright", "harassment"],
    },
    description: { type: String },
    status: {
      type: String,
      enum: ["pending", "reviewing", "resolved", "dismissed"],
      default: "pending",
    },
    resolution: {
      resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      resolvedAt: { type: Date },
      action: { type: String },
      adminNotes: { type: String },
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Report", reportSchema);
