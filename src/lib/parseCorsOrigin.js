function parseCorsOrigin() {
  const raw = process.env.CORS_ORIGIN?.trim();
  if (!raw) return true;
  const originList = raw.split(",").map((origin) => origin.trim()).filter(Boolean);
  if (originList.length === 0) return true;
  if (originList.length === 1) return originList[0];
  return originList;
}

module.exports = { parseCorsOrigin };
