const { validatePassword, PASSWORD_MIN_LENGTH } = require("./passwordPolicy");
const {
  STRONG_FIXTURE,
  TOO_SHORT_FIXTURE,
  NO_UPPER_FIXTURE,
  NO_LOWER_FIXTURE,
  NO_DIGIT_FIXTURE,
  NO_SPECIAL_FIXTURE,
  WHITESPACE_FIXTURE,
} = require("../test-utils/passwordFixtures");

describe("validatePassword", () => {
  it("rejects non-string input", () => {
    expect(validatePassword(undefined)).toMatch(/required/i);
  });

  it("rejects passwords shorter than the minimum", () => {
    expect(validatePassword(TOO_SHORT_FIXTURE)).toMatch(
      new RegExp(`at least ${PASSWORD_MIN_LENGTH}`)
    );
  });

  it("rejects passwords without lowercase", () => {
    expect(validatePassword(NO_LOWER_FIXTURE)).toMatch(/lowercase/i);
  });

  it("rejects passwords without uppercase", () => {
    expect(validatePassword(NO_UPPER_FIXTURE)).toMatch(/uppercase/i);
  });

  it("rejects passwords without a number", () => {
    expect(validatePassword(NO_DIGIT_FIXTURE)).toMatch(/number/i);
  });

  it("rejects passwords without a special character", () => {
    expect(validatePassword(NO_SPECIAL_FIXTURE)).toMatch(/special/i);
  });

  it("rejects passwords containing whitespace", () => {
    expect(validatePassword(WHITESPACE_FIXTURE)).toMatch(/spaces/i);
  });

  it("accepts a password that meets every rule", () => {
    expect(validatePassword(STRONG_FIXTURE)).toBeNull();
  });
});
