/**
 * Render / Heroku / Vercel sit behind a reverse proxy; trust first hop for req.ip / secure.
 * @param {import("express").Express} app
 */
function applyTrustProxyIfProduction(app) {
  if (process.env.NODE_ENV === "production") {
    app.set("trust proxy", 1);
  }
}

module.exports = { applyTrustProxyIfProduction };
