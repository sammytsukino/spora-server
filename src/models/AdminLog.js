const mongoose = require("mongoose");

const adminLogSchema = new mongoose.Schema(
  {
    adminId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    adminUsername: { type: String },
    action: { type: String },
    actionCategory: {
      type: String,
      enum: ["user_management", "content_moderation"],
    },
    targetType: { type: String, enum: ["user", "flora", "report"] },
    targetId: { type: mongoose.Schema.Types.ObjectId },
    targetDescription: { type: String },
    details: {
      reason: { type: String },
      additionalNotes: { type: String },
    },
    ipAddress: { type: String },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

module.exports = mongoose.model("AdminLog", adminLogSchema);
