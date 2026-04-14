const { parseCorsOrigin } = require("./parseCorsOrigin");

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
