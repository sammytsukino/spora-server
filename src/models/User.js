const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    username: { type: String, unique: true, required: true, trim: true },
    displayName: { type: String, trim: true },
    email: { type: String, unique: true, required: true, lowercase: true },
    password: { type: String, required: true },
    role: { type: String, enum: ["cultivator", "admin"], default: "cultivator" },
    accountStatus: {
      type: String,
      enum: ["active", "suspended", "deleted"],
      default: "active",
    },
    isAnonymized: { type: Boolean, default: false },
    stats: {
      florasCreated: { type: Number, default: 0 },
      cuttingsTaken: { type: Number, default: 0 },
      totalFloras: { type: Number, default: 0 },
    },
    lastLoginAt: { type: Date },
    deletedAt: { type: Date },
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", userSchema);
