const {
  scanSensitiveLanguage,
  tokenize,
  clearTermsCache,
} = require("./scanSensitiveLanguage");

describe("tokenize", () => {
  it("splits unicode letters and strips case", () => {
    expect(tokenize("Hello café Ñoño")).toEqual(["hello", "café", "ñoño"]);
  });

  it("returns empty for non-string", () => {
    expect(tokenize(null)).toEqual([]);
  });
});

describe("scanSensitiveLanguage", () => {
  afterEach(() => {
    clearTermsCache();
  });

  it("matches single word as whole token only", () => {
    const scanResult = scanSensitiveLanguage({
      title: "Something BADWORD here",
      text: "ok",
      terms: ["badword"],
    });
    expect(scanResult.matchedTerms).toEqual(["badword"]);
    expect(scanResult.locations.title).toBe(1);
    expect(scanResult.locations.text).toBe(0);
  });

  it("does not match substring inside another word", () => {
    const scanResult = scanSensitiveLanguage({
      title: "Class assignment",
      text: "",
      terms: ["ass"],
    });
    expect(scanResult.matchedTerms).toEqual([]);
  });

  it("matches case-insensitive", () => {
    const scanResult = scanSensitiveLanguage({
      title: "",
      text: "Xyzzy FoO",
      terms: ["foo"],
    });
    expect(scanResult.matchedTerms).toEqual(["foo"]);
  });

  it("matches multi-word phrase with word boundaries", () => {
    const scanResult = scanSensitiveLanguage({
      title: "start bad phrase end",
      text: "no match here",
      terms: ["bad phrase"],
    });
    expect(scanResult.matchedTerms).toEqual(["bad phrase"]);
    expect(scanResult.locations.title).toBe(1);
  });

  it("does not match phrase as substring without word boundaries", () => {
    const scanResult = scanSensitiveLanguage({
      title: "xbad phrasey",
      text: "",
      terms: ["bad phrase"],
    });
    expect(scanResult.matchedTerms).toEqual([]);
  });

  it("counts title and text separately when both hit", () => {
    const scanResult = scanSensitiveLanguage({
      title: "alpha",
      text: "beta alpha",
      terms: ["alpha", "beta"],
    });
    expect(scanResult.matchedTerms.sort()).toEqual(["alpha", "beta"]);
    expect(scanResult.locations.title).toBe(1);
    expect(scanResult.locations.text).toBe(2);
  });
});
