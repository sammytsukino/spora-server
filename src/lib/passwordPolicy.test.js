const { validatePassword, PASSWORD_MIN_LENGTH } = require("./passwordPolicy");

describe("validatePassword", () => {
  it("rejects non-string input", () => {
    expect(validatePassword(undefined)).toMatch(/required/i);
  });

  it("rejects passwords shorter than the minimum", () => {
    expect(validatePassword("Aa1!")).toMatch(
      new RegExp(`at least ${PASSWORD_MIN_LENGTH}`)
    );
  });

  it("rejects passwords without lowercase", () => {
    expect(validatePassword("ABCDEF1234!")).toMatch(/lowercase/i);
  });

  it("rejects passwords without uppercase", () => {
    expect(validatePassword("abcdef1234!")).toMatch(/uppercase/i);
  });

  it("rejects passwords without a number", () => {
    expect(validatePassword("Abcdefghi!")).toMatch(/number/i);
  });

  it("rejects passwords without a special character", () => {
    expect(validatePassword("Abcdefghi1")).toMatch(/special/i);
  });

  it("rejects passwords containing whitespace", () => {
    expect(validatePassword("Sp0ra! Test")).toMatch(/spaces/i);
  });

  it("accepts a password that meets every rule", () => {
    expect(validatePassword("Sp0ra!Garden2026")).toBeNull();
  });
});
