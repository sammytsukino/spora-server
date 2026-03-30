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
    const r = scanSensitiveLanguage({
      title: "Something BADWORD here",
      text: "ok",
      terms: ["badword"],
    });
    expect(r.matchedTerms).toEqual(["badword"]);
    expect(r.locations.title).toBe(1);
    expect(r.locations.text).toBe(0);
  });

  it("does not match substring inside another word", () => {
    const r = scanSensitiveLanguage({
      title: "Class assignment",
      text: "",
      terms: ["ass"],
    });
    expect(r.matchedTerms).toEqual([]);
  });

  it("matches case-insensitive", () => {
    const r = scanSensitiveLanguage({
      title: "",
      text: "Xyzzy FoO",
      terms: ["foo"],
    });
    expect(r.matchedTerms).toEqual(["foo"]);
  });

  it("matches multi-word phrase with word boundaries", () => {
    const r = scanSensitiveLanguage({
      title: "start bad phrase end",
      text: "no match here",
      terms: ["bad phrase"],
    });
    expect(r.matchedTerms).toEqual(["bad phrase"]);
    expect(r.locations.title).toBe(1);
  });

  it("does not match phrase as substring without word boundaries", () => {
    const r = scanSensitiveLanguage({
      title: "xbad phrasey",
      text: "",
      terms: ["bad phrase"],
    });
    expect(r.matchedTerms).toEqual([]);
  });

  it("counts title and text separately when both hit", () => {
    const r = scanSensitiveLanguage({
      title: "alpha",
      text: "beta alpha",
      terms: ["alpha", "beta"],
    });
    expect(r.matchedTerms.sort()).toEqual(["alpha", "beta"]);
    expect(r.locations.title).toBe(1);
    expect(r.locations.text).toBe(2);
  });
});
