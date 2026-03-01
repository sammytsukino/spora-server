const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    username: { type: String, unique: true, required: true, trim: true },
    displayName: { type: String, trim: true },
    avatar: { type: String, trim: true },
    bio: { type: String, trim: true, maxlength: 500 },
    followersCount: { type: Number, default: 0 },
    followingCount: { type: Number, default: 0 },
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
    emailVerified: { type: Boolean, default: false },
    emailVerificationToken: { type: String },
    emailVerificationExpires: { type: Date },
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", userSchema);
