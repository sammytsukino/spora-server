const { v2: cloudinary } = require("cloudinary");
const Flora = require("../models/Flora");
const Follow = require("../models/Follow");
const { scanSensitiveLanguage } = require("../lib/scanSensitiveLanguage");
const { syncLanguageScreenReport } = require("../services/languageScreenReport");

if (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
}

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

async function listFloras(req, res) {
  const { status, authorId, generation, followingOnly } = req.query;
  const filter = { isDeleted: { $ne: true } };
  if (status) {
    filter.status = status;
  } else {
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
    const followedIds = follows.map((f) => f.followingId);
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
  res.json(flora);
}

/** Dry-run screening for publish flow — does not create a flora. */
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
      console.warn("Failed to update parent flora childrenCount:", err?.message || err);
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
