const REFRESH_COOKIE_NAME = "spora_refresh";

function getRefreshCookieSameSite() {
  const override = process.env.REFRESH_COOKIE_SAMESITE?.trim().toLowerCase();
  if (override === "lax" || override === "strict") return override;
  if (override === "none") return "none";
  // SPA on another host (e.g. Vercel) + API on Render: subrequests need SameSite=None + Secure.
  return process.env.NODE_ENV === "production" ? "none" : "lax";
}

function getRefreshCookieBaseOptions() {
  const isProd = process.env.NODE_ENV === "production";
  const sameSite = getRefreshCookieSameSite();
  const secure = isProd || sameSite === "none";
  return {
    httpOnly: true,
    secure,
    sameSite,
    path: "/",
    maxAge: 7 * 24 * 60 * 60 * 1000,
  };
}

function setRefreshTokenCookie(res, refreshToken) {
  res.cookie(REFRESH_COOKIE_NAME, refreshToken, getRefreshCookieBaseOptions());
}

function clearRefreshTokenCookie(res) {
  const { secure, sameSite } = getRefreshCookieBaseOptions();
  res.clearCookie(REFRESH_COOKIE_NAME, {
    path: "/",
    httpOnly: true,
    sameSite,
    secure,
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
