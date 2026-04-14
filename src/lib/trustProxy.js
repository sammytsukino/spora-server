function applyTrustProxyIfProduction(app) {
  if (process.env.NODE_ENV === "production") {
    app.set("trust proxy", 1);
  }
}

module.exports = { applyTrustProxyIfProduction };
