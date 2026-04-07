const REFRESH_COOKIE_NAME = "spora_refresh";

function getRefreshCookieBaseOptions() {
  const isProd = process.env.NODE_ENV === "production";
  return {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax",
    path: "/",
    maxAge: 7 * 24 * 60 * 60 * 1000,
  };
}

function setRefreshTokenCookie(res, refreshToken) {
  res.cookie(REFRESH_COOKIE_NAME, refreshToken, getRefreshCookieBaseOptions());
}

function clearRefreshTokenCookie(res) {
  const isProd = process.env.NODE_ENV === "production";
  res.clearCookie(REFRESH_COOKIE_NAME, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: isProd,
  });
}

/**
 * Prefer httpOnly cookie; in non-production also accept body (dev / legacy clients).
 */
function getRefreshTokenFromRequest(req) {
  const fromCookie = req.cookies && req.cookies[REFRESH_COOKIE_NAME];
  if (fromCookie && typeof fromCookie === "string") return fromCookie.trim();
  if (process.env.NODE_ENV !== "production") {
    const body = req.body && req.body.refreshToken;
    if (body && typeof body === "string") return body.trim();
  }
  return null;
}

module.exports = {
  REFRESH_COOKIE_NAME,
  setRefreshTokenCookie,
  clearRefreshTokenCookie,
  getRefreshTokenFromRequest,
};
