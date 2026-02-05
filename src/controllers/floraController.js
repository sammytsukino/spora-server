const Flora = require("../models/Flora");

function buildFloraPayload(user, body) {
  const payload = {
    title: body.title,
    text: body.text,
    authorId: user._id,
    authorUsername: user.username,
    isAuthorAnonymized: false,
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
  const { status, authorId, generation } = req.query;
  const filter = {};
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

async function createFlora(req, res) {
  const { title, text } = req.body;
  if (!title || !text) {
    return res.status(400).json({ error: "Missing fields" });
  }

  const payload = buildFloraPayload(req.user, req.body);
  const flora = await Flora.create(payload);
  res.status(201).json(flora);
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

  res.json(flora);
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

  await flora.deleteOne();
  res.status(204).send();
}

module.exports = {
  listFloras,
  getFlora,
  createFlora,
  updateFlora,
  deleteFlora,
};
