const {
  parseCorsOrigin,
  resolveCorsOrigin,
  isLocalDevOrigin,
} = require("./parseCorsOrigin");

describe("parseCorsOrigin", () => {
  const orig = process.env.CORS_ORIGIN;

  afterEach(() => {
    if (orig === undefined) delete process.env.CORS_ORIGIN;
    else process.env.CORS_ORIGIN = orig;
  });

  it("returns true when CORS_ORIGIN is unset", () => {
    delete process.env.CORS_ORIGIN;
    expect(parseCorsOrigin()).toBe(true);
  });

  it("returns true when CORS_ORIGIN is blank", () => {
    process.env.CORS_ORIGIN = "  ";
    expect(parseCorsOrigin()).toBe(true);
  });

  it("returns true when CORS_ORIGIN is only commas/spaces", () => {
    process.env.CORS_ORIGIN = " , , ";
    expect(parseCorsOrigin()).toBe(true);
  });

  it("returns a single string for one origin", () => {
    process.env.CORS_ORIGIN = "https://app.example.com";
    expect(parseCorsOrigin()).toBe("https://app.example.com");
  });

  it("trims a single origin", () => {
    process.env.CORS_ORIGIN = "  https://a.com  ";
    expect(parseCorsOrigin()).toBe("https://a.com");
  });

  it("returns an array for multiple origins", () => {
    process.env.CORS_ORIGIN =
      "https://a.vercel.app, https://b.vercel.app";
    expect(parseCorsOrigin()).toEqual([
      "https://a.vercel.app",
      "https://b.vercel.app",
    ]);
  });
});

describe("resolveCorsOrigin", () => {
  const origCors = process.env.CORS_ORIGIN;
  const origEnv = process.env.NODE_ENV;

  afterEach(() => {
    if (origCors === undefined) delete process.env.CORS_ORIGIN;
    else process.env.CORS_ORIGIN = origCors;
    if (origEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = origEnv;
  });

  it("in development allows any localhost port not listed explicitly", (done) => {
    process.env.NODE_ENV = "development";
    process.env.CORS_ORIGIN = "http://localhost:5173";
    const origin = resolveCorsOrigin();
    expect(typeof origin).toBe("function");
    origin("http://localhost:5174", (err, ok) => {
      expect(err).toBeNull();
      expect(ok).toBe(true);
      done();
    });
  });

  it("in production returns a fixed allowlist (no localhost wildcard)", () => {
    process.env.NODE_ENV = "production";
    process.env.CORS_ORIGIN = "http://localhost:5173";
    expect(resolveCorsOrigin()).toBe("http://localhost:5173");
  });
});

describe("isLocalDevOrigin", () => {
  it("accepts localhost http origins", () => {
    expect(isLocalDevOrigin("http://localhost:5174")).toBe(true);
    expect(isLocalDevOrigin("http://127.0.0.1:5173")).toBe(true);
  });

  it("rejects https and remote hosts", () => {
    expect(isLocalDevOrigin("https://localhost:5173")).toBe(false);
    expect(isLocalDevOrigin("http://evil.com")).toBe(false);
  });
});
