function parseCorsOriginList() {
  const raw = process.env.CORS_ORIGIN?.trim();
  if (!raw) return null;
  const originList = raw.split(",").map((origin) => origin.trim()).filter(Boolean);
  if (originList.length === 0) return null;
  return originList;
}

function parseCorsOrigin() {
  const originList = parseCorsOriginList();
  if (!originList) return true;
  if (originList.length === 1) return originList[0];
  return originList;
}

function isLocalDevOrigin(origin) {
  try {
    const url = new URL(origin);
    return (
      url.protocol === "http:" &&
      (url.hostname === "localhost" || url.hostname === "127.0.0.1")
    );
  } catch {
    return false;
  }
}

function resolveCorsOrigin() {
  const originList = parseCorsOriginList();
  if (!originList) return true;

  if (process.env.NODE_ENV === "production") {
    return originList.length === 1 ? originList[0] : originList;
  }

  const allowed = new Set(originList);
  return (origin, callback) => {
    if (!origin) return callback(null, true);
    if (allowed.has(origin)) return callback(null, true);
    if (isLocalDevOrigin(origin)) return callback(null, true);
    callback(new Error(`CORS blocked origin: ${origin}`));
  };
}

module.exports = { parseCorsOrigin, parseCorsOriginList, resolveCorsOrigin, isLocalDevOrigin };
