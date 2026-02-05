const mongoose = require("mongoose");

const coAuthorSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    username: { type: String },
    generation: { type: Number },
    contributedAt: { type: Date },
    isAnonymized: { type: Boolean, default: false },
  },
  { _id: false }
);

const floraSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, maxlength: 100 },
    text: { type: String, required: true },
    authorId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    authorUsername: { type: String },
    isAuthorAnonymized: { type: Boolean, default: false },
    coAuthors: [coAuthorSchema],
    lineage: {
      generation: { type: Number, default: 0 },
      parentFloraId: { type: mongoose.Schema.Types.ObjectId, ref: "Flora" },
      rootFloraId: { type: mongoose.Schema.Types.ObjectId, ref: "Flora" },
      childrenCount: { type: Number, default: 0 },
    },
    status: {
      type: String,
      enum: ["blossoming", "sealed", "hidden"],
      default: "blossoming",
    },
    isHidden: { type: Boolean, default: false },
    generative: {
      soilId: { type: String },
      soilName: { type: String },
      seed: {
        sentiment: {
          score: { type: Number },
          label: { type: String },
        },
        morphology: {
          characterCount: { type: Number },
          wordCount: { type: Number },
          lineCount: { type: Number },
        },
        visual: {
          colorPalette: [{ type: String }],
          elementCount: { type: Number },
          movementSpeed: { type: Number },
          complexity: { type: Number },
        },
      },
    },
    license: {
      type: mongoose.Schema.Types.Mixed,
    },
    stats: {
      views: { type: Number, default: 0 },
      cuttingsTaken: { type: Number, default: 0 },
      downloads: { type: Number, default: 0 },
    },
    publishedAt: { type: Date },
    sealedAt: { type: Date },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Flora", floraSchema);
