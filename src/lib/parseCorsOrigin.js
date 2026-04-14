function parseCorsOrigin() {
  const raw = process.env.CORS_ORIGIN?.trim();
  if (!raw) return true;
  const list = raw.split(",").map((s) => s.trim()).filter(Boolean);
  if (list.length === 0) return true;
  if (list.length === 1) return list[0];
  return list;
}

module.exports = { parseCorsOrigin };
