const Flora = require("../models/Flora");
const Follow = require("../models/Follow");
const Report = require("../models/Report");
const { cloudinary, ensureCloudinaryConfigured } = require("../config/cloudinary");
const { scanSensitiveLanguage } = require("../lib/scanSensitiveLanguage");
const { syncLanguageScreenReport } = require("../services/languageScreenReport");

ensureCloudinaryConfigured();

function buildFloraPayload(user, body) {
  const payload = {
    title: body.title,
    text: body.text,
    authorId: user._id,
    authorUsername: user.username,
    isAuthorAnonymized: false,
    coAuthors: Array.isArray(body.coAuthors) ? body.coAuthors : [],
    lineage: body.lineage || { generation: 0, childrenCount: 0 },
    status: body.status || "blossoming",
    isHidden: body.isHidden || false,
    generative: body.generative || {},
    license: body.license || {},
  };

  if (payload.status === "sealed") {
    payload.publishedAt = new Date();
    payload.sealedAt = new Date();
  } else if (payload.status === "blossoming") {
    payload.publishedAt = new Date();
  }

  return payload;
}

async function validateCuttingPayload(payload) {
  const parentId = payload.lineage?.parentFloraId;
  if (!parentId) return null;

  const parent = await Flora.findById(parentId);
  if (!parent || parent.isDeleted) {
    return { status: 400, error: "Parent Flora not found" };
  }
  if (parent.status !== "blossoming") {
    return { status: 400, error: "Cuttings are only allowed from blossoming Floras" };
  }

  const parentText = String(parent.text || "");
  const childText = String(payload.text || "");
  if (!childText.startsWith(parentText)) {
    return { status: 400, error: "Parent text cannot be modified in a cutting" };
  }

  const added = childText.slice(parentText.length).replace(/^\n+/, "").trim();
  if (!added) {
    return { status: 400, error: "Cutting must include new text beyond the parent Flora" };
  }

  return null;
}

async function listFloras(req, res) {
  const { status, authorId, generation, followingOnly, includeHidden } = req.query;
  const filter = { isDeleted: { $ne: true } };
  const requesterIsAdmin = req.user?.role === "admin";
  const canIncludeHidden =
    requesterIsAdmin && (includeHidden === "true" || includeHidden === true);
  if (status) {
    filter.status = status;
  }
  if (!canIncludeHidden) {
    filter.isHidden = { $ne: true };
  }
  if (authorId) {
    filter.authorId = authorId;
  }
  if (generation !== undefined) {
    filter["lineage.generation"] = Number(generation);
  }

  if (followingOnly === "true" || followingOnly === true) {
    if (!req.user) {
      return res.status(401).json({ error: "Authentication required" });
    }
    const follows = await Follow.find({ followerId: req.user._id }).select("followingId").lean();
    const followedIds = follows.map((followDoc) => followDoc.followingId);
    if (followedIds.length === 0) {
      return res.json([]);
    }
    filter.authorId = { $in: followedIds };
  }

  const floras = await Flora.find(filter).sort({ createdAt: -1 }).limit(200);
  res.json(floras);
}

async function getFlora(req, res) {
  const flora = await Flora.findById(req.params.id);
  if (!flora) {
    return res.status(404).json({ error: "Flora not found" });
  }
  const requesterId = req.user?._id?.toString();
  const requesterIsAdmin = req.user?.role === "admin";
  const requesterIsOwner =
    requesterId && flora.authorId?.toString() === requesterId;
  if (flora.isDeleted) {
    return res.status(404).json({ error: "Flora not found" });
  }
  if (flora.isHidden && !requesterIsAdmin && !requesterIsOwner) {
    return res.status(404).json({ error: "Flora not found" });
  }
  res.json(flora);
}

function previewFloraScreening(req, res) {
  const { title, text } = req.body;
  if (title == null || text == null) {
    return res.status(400).json({ error: "Missing title or text" });
  }
  const scan = scanSensitiveLanguage({ title: String(title), text: String(text) });
  const contentScreening = {
    flagged: scan.matchedTerms.length > 0,
    matchCount: scan.matchedTerms.length,
    titleHits: scan.locations.title,
    textHits: scan.locations.text,
  };
  if (contentScreening.flagged) {
    contentScreening.matchedTerms = scan.matchedTerms;
  }
  res.json({ contentScreening });
}

async function createFlora(req, res) {
  const { title, text, thumbnailData } = req.body;
  if (!title || !text) {
    return res.status(400).json({ error: "Missing fields" });
  }

  const payload = buildFloraPayload(req.user, req.body);

  const cuttingError = await validateCuttingPayload(payload);
  if (cuttingError) {
    return res.status(cuttingError.status).json({ error: cuttingError.error });
  }

  if (thumbnailData && typeof thumbnailData === "string") {
    const hasCloudinary = process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET;
    if (hasCloudinary) {
      try {
        const publicId = `spora/floras/thumb_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
        const result = await cloudinary.uploader.upload(thumbnailData, {
          folder: "spora/floras",
          public_id: publicId.split("/").pop(),
          resource_type: "image",
        });
        if (result?.secure_url) {
          payload.thumbnailUrl = result.secure_url;
        }
      } catch (err) {
        console.warn("Cloudinary thumbnail upload failed:", err?.message || err);
      }
    }
  }

  const flora = await Flora.create(payload);

  if (payload.lineage?.parentFloraId) {
    try {
      await Flora.findByIdAndUpdate(payload.lineage.parentFloraId, {
        $inc: { "lineage.childrenCount": 1 },
      });
    } catch (err) {
      console.warn("Failed to update parent Flora childrenCount:", err?.message || err);
    }
  }

  const scan = scanSensitiveLanguage({ title: flora.title, text: flora.text });
  const contentScreening = {
    flagged: scan.matchedTerms.length > 0,
    matchCount: scan.matchedTerms.length,
    titleHits: scan.locations.title,
    textHits: scan.locations.text,
  };
  if (contentScreening.flagged) {
    contentScreening.matchedTerms = scan.matchedTerms;
  }
  try {
    await syncLanguageScreenReport(flora._id, flora.title, flora.text);
  } catch (err) {
    console.warn("Language screen report sync failed:", err?.message || err);
  }

  res.status(201).json({ ...flora.toObject(), contentScreening });
}

async function updateFlora(req, res) {
  const flora = await Flora.findById(req.params.id);
  if (!flora) {
    return res.status(404).json({ error: "Flora not found" });
  }

  const isOwner = flora.authorId?.toString() === req.user._id.toString();
  const isAdmin = req.user.role === "admin";
  if (!isOwner && !isAdmin) {
    return res.status(403).json({ error: "Forbidden" });
  }

  if (!isAdmin && flora.status !== "blossoming") {
    return res.status(403).json({ error: "Flora is not open for edits" });
  }

  if (flora.publishedAt && req.body.text && req.body.text !== flora.text) {
    return res.status(400).json({ error: "Text is immutable after publish" });
  }

  const updates = { ...req.body };
  if (updates.status === "sealed" && !flora.sealedAt) {
    updates.sealedAt = new Date();
    updates.publishedAt = updates.publishedAt || flora.publishedAt || new Date();
  }
  if (updates.status === "blossoming" && !flora.publishedAt) {
    updates.publishedAt = new Date();
  }

  Object.assign(flora, updates);
  await flora.save();

  const scanPatch = scanSensitiveLanguage({ title: flora.title, text: flora.text });
  const contentScreeningPatch = {
    flagged: scanPatch.matchedTerms.length > 0,
    matchCount: scanPatch.matchedTerms.length,
    titleHits: scanPatch.locations.title,
    textHits: scanPatch.locations.text,
  };
  if (contentScreeningPatch.flagged) {
    contentScreeningPatch.matchedTerms = scanPatch.matchedTerms;
  }
  try {
    await syncLanguageScreenReport(flora._id, flora.title, flora.text);
  } catch (err) {
    console.warn("Language screen report sync failed:", err?.message || err);
  }

  res.json({ ...flora.toObject(), contentScreening: contentScreeningPatch });
}

async function deleteFlora(req, res) {
  const flora = await Flora.findById(req.params.id);
  if (!flora) {
    return res.status(404).json({ error: "Flora not found" });
  }

  const isOwner = flora.authorId?.toString() === req.user._id.toString();
  const isAdmin = req.user.role === "admin";
  if (!isOwner && !isAdmin) {
    return res.status(403).json({ error: "Forbidden" });
  }

  if (!isAdmin && flora.status !== "blossoming") {
    return res.status(403).json({ error: "Flora is not open for deletion" });
  }

  await Report.deleteMany({ reportedFloraId: flora._id });
  await flora.deleteOne();
  res.status(204).send();
}

module.exports = {
  listFloras,
  getFlora,
  previewFloraScreening,
  createFlora,
  updateFlora,
  deleteFlora,
};
