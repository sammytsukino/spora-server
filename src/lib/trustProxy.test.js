const express = require("express");
const { applyTrustProxyIfProduction } = require("./trustProxy");

describe("applyTrustProxyIfProduction", () => {
  const origEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = origEnv;
  });

  it("sets trust proxy in production", () => {
    process.env.NODE_ENV = "production";
    const app = express();
    applyTrustProxyIfProduction(app);
    expect(app.get("trust proxy")).toBe(1);
  });

  it("does not set trust proxy outside production", () => {
    process.env.NODE_ENV = "test";
    const app = express();
    applyTrustProxyIfProduction(app);
    expect(app.get("trust proxy")).toBe(false);
  });
});
